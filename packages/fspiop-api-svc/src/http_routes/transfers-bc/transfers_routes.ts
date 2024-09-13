/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    Constants,
    decodeIlpPacket,
    Enums,
    FspiopJwsSignature,
    FspiopValidator,
    PostQuote,
    ValidationdError,
    FspiopTransformer
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    TransferFulfilRequestedEvt,
    TransferFulfilRequestedEvtPayload,
    TransferPrepareRequestedEvt,
    TransferPrepareRequestedEvtPayload,
    TransferQueryReceivedEvt,
    TransferQueryReceivedEvtPayload,
    TransferRejectRequestedEvt,
    TransferRejectRequestedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {FSPIOPErrorCodes} from "../validation";
import {IMessageProducer, MessageInboundProtocol} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";
import {
    TransferFulfilRequestedDTO,
    TransferPrepareRequestedDTO,
    TransferQueryReceivedDTO,
    TransferRejectRequestedDTO
} from "./transfers_routes_dto";
import {BaseRoutesFastify} from "../_base_routerfastify";

import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {IMetrics, SpanStatusCode} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {SpanKind} from "@opentelemetry/api";
import {DecodedIlpPacketTransfer} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";


export class TransfersRoutes extends BaseRoutesFastify {

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        metrics: IMetrics,
        logger: ILogger
    ) {
        super(producer, validator, jwsHelper, metrics, logger);
    }

    public async bindRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void>{
        // bind common hooks like content-type validation and tracing extraction
        this._addHooks(fastify);

        // GET Transfer by ID
        fastify.get("/:id", this.transferQueryReceived.bind(this));

        // POST Transfers
        fastify.post("/", this.transferPrepareRequested.bind(this));

        // PUT Transfers
        fastify.put("/:id", this.transferFulfilRequested.bind(this));

        // Errors
        fastify.put("/:id/error", this.transferRejectRequested.bind(this));
    }

    private async transferPrepareRequested(req: FastifyRequest<TransferPrepareRequestedDTO>, reply: FastifyReply): Promise<void> {
        this._logger.debug("Got transferPrepareRequested request");
        const parentSpan = this._getActiveSpan();

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // Data Model
            const transferId = req.body.transferId;
            const payeeFsp = req.body.payeeFsp;
            const payerFsp = req.body.payerFsp;
            const amount = req.body.amount;
            const ilpPacket = req.body.ilpPacket;
            const condition = req.body.condition;
            const expirationStr = req.body.expiration;
            const extensionList = req.body.extensionList;

            const decodedIlpPacket:DecodedIlpPacketTransfer = decodeIlpPacket(ilpPacket);

            const payerIdType = decodedIlpPacket.payer.partyIdInfo.partyIdType;
            const payeeIdType = decodedIlpPacket.payee.partyIdInfo.partyIdType;
            const transferType = decodedIlpPacket.transactionType.scenario;

            if (!transferId || !payeeFsp || !payerFsp || !amount || !ilpPacket || !condition || !expirationStr || !requesterFspId || !payerIdType || !payeeIdType || !transferType ) {

                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            let expirationTimestamp : number;
            try{
                expirationTimestamp = Date.parse(expirationStr).valueOf();
                if(expirationTimestamp < Date.now()) {
                    
                    const msg = `Invalid expiration time received for transfer with transferId: ${transferId}- expiration is in the past`;
                    this._logger.warn(msg);
                    throw new Error(msg);
                }
            }catch (err: unknown){
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            // Validation
            this._validator.currencyAndAmount(amount);
            this._validator.validateIlpAgainstTransferRequest(req.body, decodedIlpPacket);
            this._validator.validateCondition(condition);

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: TransferPrepareRequestedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                transferId: transferId,
                payeeFsp: payeeFsp,
                payerFsp: payerFsp,
                amount: amount.amount,
                currencyCode: amount.currency,
                expiration: expirationTimestamp,
                payerIdType: payerIdType,
                payeeIdType: payeeIdType,
                transferType: transferType,
                extensions: extensionList?.extension ? extensionList.extension : [] // TODO: Create conversion from fspiopopaquestate to our internal extensions (plural) 
            };

            const msg = new TransferPrepareRequestedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders,
                    ilpPacket: ilpPacket,
                    condition: condition,
                    extensionList: extensionList,
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttribute("transferId", transferId);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);

            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("transferPrepareRequested sent message");

            reply.code(202).send(null);

            this._logger.debug("transferPrepareRequested responded");

        } catch (error: unknown) {

            if(error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }

            return;
        }
    }

    private async transferFulfilRequested(req: FastifyRequest<TransferFulfilRequestedDTO>, reply: FastifyReply): Promise<void> {
        this._logger.debug("Got transferFulfilRequested request");
        const parentSpan = this._getActiveSpan();

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;
            const acceptedHeader = clonedHeaders[Constants.FSPIOP_HEADERS_ACCEPT] as string;

            // Date Model
            const transferId = req.params.id;
            const transferState = req.body.transferState;
            const fulfilment = req.body.fulfilment;
            const completedTimestamp = req.body.completedTimestamp;
            const extensionList = req.body.extensionList;

            if (!transferId || !transferState || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: TransferFulfilRequestedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                transferId: transferId,
                transferState: transferState,
                completedTimestamp: new Date(completedTimestamp).valueOf(),
                notifyPayee: transferState as Enums.TransferStateEnum === Enums.TransferStateEnum.RESERVED && Constants.ALLOWED_PATCH_ACCEPTED_TRANSFER_HEADERS.includes(acceptedHeader)
            };

            const msg = new TransferFulfilRequestedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders,
                    fulfilment: fulfilment,
                    extensionList: extensionList,
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"transferId": transferId});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("transferFulfilRequested sent message");

            reply.code(200).send(null);

            this._logger.debug("transferFulfilRequested responded");

        } catch (error: unknown) {

            const transformError = FspiopTransformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }

    private async transferRejectRequested(req: FastifyRequest<TransferRejectRequestedDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();

        this._logger.debug("Got transferRejectRequested request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // Date Model
            const transferId = req.params.id;
            const errorInformation = req.body.errorInformation;

            if (!transferId || !errorInformation || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: TransferRejectRequestedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                transferId: transferId,
                errorInformation: errorInformation
            };

            const msg = new TransferRejectRequestedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"transferId": transferId});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("transferRejectRequested sent message");

            reply.code(200).send(null);

            this._logger.debug("transferRejectRequested responded");

        } catch (error: unknown) {

            const transformError = FspiopTransformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }

    private async transferQueryReceived(req: FastifyRequest<TransferQueryReceivedDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();

        this._logger.debug("Got transferQueryReceived request");

        try {
            const clonedHeaders = { ...req.headers };
            const transferId = req.params.id;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];


            if (!transferId || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            const msgPayload: TransferQueryReceivedEvtPayload = {
                transferId: transferId,
            };

            const msg = new TransferQueryReceivedEvt(msgPayload);

            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"transferId": transferId});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("transferQueryReceived sent message");

            reply.code(202).send(null);

            this._logger.debug("transferQueryReceived responded");

        } catch (error: unknown) {

            const transformError = FspiopTransformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }
}
