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
    Transformer,
    ValidationdError
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
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {FastifyPluginAsync, FastifyReply, FastifyRequest} from "fastify";
import {
    TransferFulfilRequestedDTO,
    TransferPrepareRequestedDTO,
    TransferQueryReceivedDTO,
    TransferRejectRequestedDTO
} from "./transfers_routes_dto";
import {BaseRoutesFastify} from "../_base_routerfastify";

import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {IMetrics, SpanStatusCode, Tracer} from "@mojaloop/platform-shared-lib-observability-types-lib";



export class TransfersRoutes extends BaseRoutesFastify {
    private readonly _tracer: Tracer;

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        metrics: IMetrics,
        logger: ILogger
    ) {
        super(producer, validator, jwsHelper, metrics, logger);

        this._tracer = OpenTelemetryClient.getInstance().getTracer(this.constructor.name);
    }

    public bindRoutes: FastifyPluginAsync = async (fastify) => {
        // hook header validation from base class - MANDATORY for FSPIOP Routes
        fastify.addHook("preHandler", this._preHandler.bind(this));

        // GET Transfer by ID
        fastify.get("/:id", this.transferQueryReceived.bind(this));

        // POST Transfers
        fastify.post("/", this.transferPrepareRequested.bind(this));

        // PUT Transfers
        fastify.put("/:id", this.transferFulfilRequested.bind(this));

        // Errors
        fastify.put("/:id/error", this.transferRejectRequested.bind(this));
    };

    private async transferPrepareRequested(req: FastifyRequest<TransferPrepareRequestedDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got transferPrepareRequested request");
        const parentSpan = OpenTelemetryClient.getInstance().startSpan(this._tracer, "POST transfers prepare");

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Data Model
            const transferId = req.body["transferId"] || null;
            const payeeFsp = req.body["payeeFsp"] || null;
            const payerFsp = req.body["payerFsp"] || null;
            const amount = req.body["amount"] || null;
            const ilpPacket = req.body["ilpPacket"];
            const condition = req.body["condition"] || null;
            const expiration = req.body["expiration"] || null;
            const extensionList = req.body["extensionList"] || null;

            //TODO: validate ilpPacket

            const decodedIlpPacket:PostQuote = decodeIlpPacket(ilpPacket);

            const payerIdType = decodedIlpPacket.payer.partyIdInfo.partyIdType;
            const payeeIdType = decodedIlpPacket.payee.partyIdInfo.partyIdType;
            const transferType = decodedIlpPacket.transactionType.scenario;

            if (!transferId || !payeeFsp || !payerFsp || !amount || !ilpPacket || !condition || !expiration || !requesterFspId || !payerIdType || !payeeIdType || !transferType ) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);

                parentSpan.setStatus({ code: SpanStatusCode.ERROR }).end();
                return;
            }

            this._validator.currencyAndAmount(amount);

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
                ilpPacket: ilpPacket,
                condition: condition,
                expiration: expiration,
                extensionList: extensionList,
                payerIdType: payerIdType,
                payeeIdType: payeeIdType,
                transferType: transferType
            };

            const msg = new TransferPrepareRequestedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders,
                tracing: {}
            };

            parentSpan.setAttribute("transferId", transferId);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInject(childSpan, msg.fspiopOpaqueState.tracing);

            await this.kafkaProducer.send(msg);
            childSpan.end();

            this.logger.debug("transferPrepareRequested sent message");

            reply.code(202).send(null);

            this.logger.debug("transferPrepareRequested responded");

            parentSpan.end();
        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }

            parentSpan.setStatus({ code: SpanStatusCode.ERROR }).end();
            return;
        }
    }

    private async transferFulfilRequested(req: FastifyRequest<TransferFulfilRequestedDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got transferFulfilRequested request");
        const parentSpan = OpenTelemetryClient.getInstance().startSpanWithPropagationInput(this._tracer, "PUT transfers fulfil", req.headers);

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
            const acceptedHeader = clonedHeaders[Constants.FSPIOP_HEADERS_ACCEPT] as string;

            // Date Model
            const transferId = req.params["id"] as string || null;
            const transferState = req.body["transferState"] || null;
            const fulfilment = req.body["fulfilment"] || null;
            const completedTimestamp = req.body["completedTimestamp"] || null;
            const extensionList = req.body["extensionList"] || null;


            if (!transferId || !transferState || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                parentSpan.setStatus({ code: SpanStatusCode.ERROR }).end();
                return;
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: TransferFulfilRequestedEvtPayload = {
                transferId: transferId,
                transferState: transferState,
                fulfilment: fulfilment,
                completedTimestamp: new Date(completedTimestamp).valueOf(),
                extensionList: extensionList,
                notifyPayee: transferState as Enums.TransferStateEnum === Enums.TransferStateEnum.RESERVED && Constants.ALLOWED_PATCH_ACCEPTED_TRANSFER_HEADERS.includes(acceptedHeader)
            };

            const msg = new TransferFulfilRequestedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders,
                tracing: {}
            };

            parentSpan.setAttributes({"transferId": transferId});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan);
            OpenTelemetryClient.getInstance().propagationInject(childSpan, msg.fspiopOpaqueState.tracing);
            await this.kafkaProducer.send(msg);
            childSpan.end();

            this.logger.debug("transferFulfilRequested sent message");

            reply.code(200).send(null);

            this.logger.debug("transferFulfilRequested responded");

            parentSpan.end();
        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
            parentSpan.setStatus({ code: SpanStatusCode.ERROR }).end();
        }
    }

    private async transferRejectRequested(req: FastifyRequest<TransferRejectRequestedDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got transferRejectRequested request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const transferId = req.params["id"] as string || null;
            const errorInformation = req.body["errorInformation"] || null;

            if (!transferId || !errorInformation || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
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
                transferId: transferId,
                errorInformation: errorInformation
            };

            const msg = new TransferRejectRequestedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("transferRejectRequested sent message");

            reply.code(200).send(null);

            this.logger.debug("transferRejectRequested responded");

        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }

    private async transferQueryReceived(req: FastifyRequest<TransferQueryReceivedDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got transferQueryReceived request");
        try {
            const clonedHeaders = { ...req.headers };
            const transferId = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;


            if (!transferId || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
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
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("transferQueryReceived sent message");

            reply.code(202).send(null);

            this.logger.debug("transferQueryReceived responded");

        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }
}
