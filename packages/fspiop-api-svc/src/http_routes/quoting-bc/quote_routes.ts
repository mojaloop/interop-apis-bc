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

import {
    Constants,
    FspiopJwsSignature,
    FspiopValidator,
    ValidationdError,
    decodeIlpPacket,
    validateDecodedIlpPacket,
    FspiopTransformer,
    DecodedIlpPacketQuote
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    QuoteRejectedEvt,
    QuoteRejectedEvtPayload,
    QuoteQueryReceivedEvt,
    QuoteQueryReceivedEvtPayload,
    QuoteRequestReceivedEvt,
    QuoteRequestReceivedEvtPayload,
    QuoteResponseReceivedEvt,
    QuoteResponseReceivedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { FSPIOPErrorCodes } from "../validation";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {IMessageProducer, MessageInboundProtocol} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {IMetrics, SpanStatusCode} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {FastifyInstance, FastifyPluginAsync, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";
import { QuoteQueryReceivedDTO, QuoteRejectRequestDTO, QuoteRequestReceivedDTO, QuoteResponseReceivedDTO } from "./quotes_routes_dto";
import {BaseRoutesFastify} from "../_base_routerfastify";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {SpanKind} from "@opentelemetry/api";

export class QuoteRoutes extends BaseRoutesFastify {

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

        // GET Quote by ID
        fastify.get("/:id", this.quoteQueryReceived.bind(this));

        // POST Quote Calculation
        fastify.post("/", this.quoteRequestReceived.bind(this));

        // PUT Quote Created
        fastify.put("/:id", this.quoteResponseReceived.bind(this));

        // Errors
        fastify.put("/:id/error", this.quoteRejectRequest.bind(this));
    }

    private async quoteRequestReceived(req: FastifyRequest<QuoteRequestReceivedDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();

        this._logger.debug("Got quoteRequestReceived request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Date Model
            const quoteId = req.body.quoteId;
            const transactionId = req.body.transactionId;
            const transactionRequestId = req.body.transactionRequestId;
            const payee = req.body.payee;
            const payer = req.body.payer;
            const amountType = req.body.amountType;
            const amount: { currency: string, amount: string } = req.body.amount;
            const fees = req.body.fees;
            const transactionType = req.body.transactionType;
            const geoCode = req.body.geoCode;
            const note = req.body.note;
            const expiration = req.body.expiration;
            const converter = req.body.converter;
            const currencyConversion = req.body.currencyConversion;
            const extensionList = req.body.extensionList;

            if (!requesterFspId || !quoteId || !transactionId || !payee || !payer || !amountType || !amount || !transactionType) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            this._validator.currencyAndAmount(amount);

            if(fees) {
                this._validator.currencyAndAmount(fees);
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: QuoteRequestReceivedEvtPayload = {
                quoteId: quoteId,
                transactionId: transactionId,
                transactionRequestId: transactionRequestId,
                payee: payee,
                payer: payer,
                amountType: amountType,
                amount: amount,
                fees: fees,
                transactionType: transactionType,
                geoCode: geoCode,
                note: note,
                expiration: expiration,
                converter: converter,
                currencyConversion: currencyConversion
            };

            const msg = new QuoteRequestReceivedEvt(msgPayload);

            // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
            // we can use the builtin method of validatePayload of the evt messages to make sure consistency
            // is shared between both
            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders,
                    extensionList: extensionList,
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttribute("quoteId", quoteId);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);

            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("quoteRequestReceived sent message");

            reply.code(202).send(null);

            this._logger.debug("quoteRequestReceived responded");

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

    private async quoteResponseReceived(req: FastifyRequest<QuoteResponseReceivedDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got quoteResponseReceived request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // Date Model
            const quoteId = req.params.id;
            const transferAmount = req.body.transferAmount;
            const expiration = req.body.expiration;
            const note = req.body.note;
            const ilpPacket = req.body.ilpPacket;
            const condition = req.body.condition;
            const payeeReceiveAmount = req.body.payeeReceiveAmount;
            const payeeFspFee = req.body.payeeFspFee;
            const payeeFspCommission = req.body.payeeFspCommission;
            const geoCode = req.body.geoCode;
            const extensionList = req.body.extensionList;

            const decodedIlpPacket:DecodedIlpPacketQuote = decodeIlpPacket(ilpPacket);

            if (!requesterFspId || !quoteId || !transferAmount || !expiration || !ilpPacket || !condition) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }
            
            // Validation
            this._validator.currencyAndAmount(transferAmount);
            this._validator.validateIlpAgainstQuoteResponse(req.body, decodedIlpPacket);
            this._validator.validateCondition(condition);

            if(payeeReceiveAmount) {
                this._validator.currencyAndAmount(payeeReceiveAmount);
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: QuoteResponseReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                quoteId: quoteId,
                transferAmount: transferAmount,
                note: note,
                expiration: expiration,
                payeeReceiveAmount: payeeReceiveAmount,
                payeeFspFee: payeeFspFee,
                payeeFspCommission: payeeFspCommission,
                geoCode: geoCode,
            };

            const msg = new QuoteResponseReceivedEvt(msgPayload);

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

            parentSpan.setAttribute("quoteId", quoteId);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);

            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("quoteResponseReceived sent message");

            reply.code(200).send(null);

            this._logger.debug("quoteResponseReceived responded");
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

    private async quoteQueryReceived(req: FastifyRequest<QuoteQueryReceivedDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got quoteQueryReceived request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string; // NOTE: We do this because the destination is coming as null

            // Date Model
            const quoteId = req.params.id;

            if (!quoteId || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            const msgPayload: QuoteQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                quoteId: quoteId,
            };

            const msg = new QuoteQueryReceivedEvt(msgPayload);

            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttribute("quoteId", quoteId);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);

            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("quoteQueryReceived sent message");

            reply.code(202).send(null);

            this._logger.debug("quoteQueryReceived responded");
        } catch (error: unknown) {

            const transformError = FspiopTransformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }

    private async quoteRejectRequest(req: FastifyRequest<QuoteRejectRequestDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got quote rejected request");

        try{
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string; // NOTE: We do this because the destination is coming as null

            // Date Model
            const quoteId = req.params.id;
            const errorInformation = req.body.errorInformation;

            if(!quoteId || !errorInformation || !requesterFspId) {
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

            const msgPayload: QuoteRejectedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                quoteId: quoteId,
                errorInformation: errorInformation
            };

            const msg =  new QuoteRejectedEvt(msgPayload);

            msg.validatePayload();

            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttribute("quoteId", quoteId);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);

            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("quote rejected sent message");

            reply.code(202).send(null);

            this._logger.debug("quote rejected responded");

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
