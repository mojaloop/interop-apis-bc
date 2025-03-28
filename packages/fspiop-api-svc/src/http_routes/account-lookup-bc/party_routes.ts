/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    Constants,
    FspiopJwsSignature,
    FspiopValidator,
    ValidationdError,
    FspiopTransformer
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    PartyQueryReceivedEvt,
    PartyQueryReceivedEvtPayload,
    PartyInfoAvailableEvt,
    PartyInfoAvailableEvtPayload,
    PartyRejectedEvt,
    PartyRejectedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {FSPIOPErrorCodes} from "../validation";
import {IMessageProducer, MessageInboundProtocol} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {IMetrics, SpanStatusCode} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {FastifyInstance, FastifyPluginAsync, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";
import {
    GetPartyByTypeAndIdAndSubIdQueryRejectDTO,
    GetPartyByTypeAndIdQueryRejectDTO,
    GetPartyInfoAvailableByTypeAndIdAndSubIdDTO,
    GetPartyInfoAvailableByTypeAndIdDTO,
    GetPartyQueryReceivedByTypeAndIdDTO,
    GetPartyQueryReceivedByTypeAndIdSubIdDTO
} from "./party_route_dto";
import {BaseRoutesFastify} from "../_base_routerfastify";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {SpanKind} from "@opentelemetry/api";

export class PartyRoutes extends BaseRoutesFastify {

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        metrics: IMetrics,
        logger: ILogger
    ) {
        super(producer, validator, jwsHelper, metrics, logger);
    }

    public async bindRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
        // bind common hooks like content-type validation and tracing extraction
        this._addHooks(fastify);

        // GET Party by Type & ID
        fastify.get("/:type/:id", this.getPartyQueryReceivedByTypeAndId.bind(this));

        // GET Parties by Type, ID & SubId
        fastify.get("/:type/:id/:subid", this.getPartyQueryReceivedByTypeAndIdSubId.bind(this));

        // PUT ERROR Party by Type & ID
        fastify.put("/:type/:id/error", this.getPartyByTypeAndIdQueryReject.bind(this));

        // PUT ERROR Parties by Type, ID & SubId
        fastify.put("/:type/:id/:subid/error", this.getPartyByTypeAndIdAndSubIdQueryReject.bind(this));

        // PUT Party by Type & ID
        fastify.put("/:type/:id", this.getPartyInfoAvailableByTypeAndId.bind(this));

        // PUT Parties by Type, ID & SubId
        fastify.put("/:type/:id/:subid", this.getPartyInfoAvailableByTypeAndIdAndSubId.bind(this));
        // next();
        // });
    }

    private async getPartyQueryReceivedByTypeAndId(req: FastifyRequest<GetPartyQueryReceivedByTypeAndIdDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        const mainTimer = this._histogram.startTimer({callName: "getPartyQueryReceivedByTypeAndId"});
        this._logger.debug("Got getPartyQueryReceivedByTypeAndId request");

        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Data Model
            const type = req.params.type;
            const id = req.params.id;
            const currency = req.query.currency;

            if (!type || !id || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                mainTimer({success: "false"});
                reply.code(400).send(transformError);
                return;
            }

            if (currency) {
                const currencyTimer = this._histogram.startTimer({callName: "getPartyInfoAvailableByTypeAndId - currency"});
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
                currencyTimer({success: "true"});
            }

            const msgPayload: PartyQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency,
            };

            const msg = new PartyQueryReceivedEvt(msgPayload);

            // TODO: Review this rule that matches ttk use cases
            // clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = requesterFspId as string;

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1";
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: destinationFspId,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttribute("partyId", id);
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            // inject tracing headers
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);

            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("getPartyQueryReceivedByTypeAndId sent message");

            reply.code(202).send(null);

            const took = mainTimer({success: "true"});
            this._logger.debug(`getPartyQueryReceivedByTypeAndId responded - took: ${took}`);
        } catch (error: unknown) {
            if (error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            mainTimer({success: "false"});
            return;
        }
    }

    private async getPartyQueryReceivedByTypeAndIdSubId(req: FastifyRequest<GetPartyQueryReceivedByTypeAndIdSubIdDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        const mainTimer = this._histogram.startTimer({callName: "getPartyQueryReceivedByTypeAndIdSubId"});
        this._logger.debug("Got getPartyQueryReceivedByTypeAndIdSubId request");

        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Data Model
            const type = req.params.type;
            const id = req.params.id;
            const partySubIdOrType = req.params.subid;
            const currency = req.query.currency;

            if (!type || !id || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                mainTimer({success: "false"});
                return;
            }

            if (currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: PartyQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new PartyQueryReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1";
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: destinationFspId,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("getPartyQueryReceivedByTypeAndIdSubId sent message");

            reply.code(202).send(null);

            const took = mainTimer({success: "true"});
            this._logger.debug(`getPartyQueryReceivedByTypeAndIdSubId responded - took: ${took}`);
        } catch (error: unknown) {
            if (error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            mainTimer({success: "false"});
            return;
        }
    }


    private async getPartyInfoAvailableByTypeAndId(req: FastifyRequest<GetPartyInfoAvailableByTypeAndIdDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        const mainTimer = this._histogram.startTimer({callName: "getPartyInfoAvailableByTypeAndId"});
        this._logger.debug("Got getPartyInfoAvailableByTypeAndId request");

        try {
            const headersTimer = this._histogram.startTimer({callName: "getPartyInfoAvailableByTypeAndId - headers"});

            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Data Model
            const type = req.params.type;
            const id = req.params.id;
            const ownerFspId = req.body.party.partyIdInfo.fspId;
            const currency = req.query.currency;
            const name = req.body.party.name;
            const merchantClassificationCode = req.body.party.merchantClassificationCode;
            const firstName = req.body.party.personalInfo.complexName.firstName;
            const middleName = req.body.party.personalInfo.complexName.middleName;
            const lastName = req.body.party.personalInfo.complexName.lastName;
            const partyDoB = req.body.party.personalInfo.dateOfBirth;
            const extensionList = req.body.party.partyIdInfo.extensionList;
            const kycInfo = req.body.party.personalInfo.kycInformation;
            const supportedCurrencies = req.body.party.supportedCurrencies;

            headersTimer({success: "true"});

            if (!type || !id || !requesterFspId || !ownerFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                mainTimer({success: "false"});
                return;
            }

            if (currency) {
                const currencyTimer = this._histogram.startTimer({callName: "getPartyInfoAvailableByTypeAndId - currency"});
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
                currencyTimer({success: "true"});
            }

            if (this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: PartyInfoAvailableEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                ownerFspId: ownerFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency,
                merchantClassificationCode: merchantClassificationCode,
                name: name,
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                partyDoB: partyDoB,
                kycInfo: kycInfo,
                supportedCurrencies: supportedCurrencies,
                extensions: FspiopTransformer.convertToFlatExtensions(extensionList)
            };


            const msg = new PartyInfoAvailableEvt(msgPayload);

            // this is a response from the original destination, so we swap requester and destination
            msg.inboundProtocolType = "FSPIOP_v1_1";
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders,
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("getPartyInfoAvailableByTypeAndId sent message");

            reply.code(202).send(null);

            const took = mainTimer({success: "true"});
            this._logger.debug(`getPartyInfoAvailableByTypeAndId responded - took ${took}`);
        } catch (error: unknown) {

            if (error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            mainTimer({success: "false"});
            return;
        }
    }

    private async getPartyInfoAvailableByTypeAndIdAndSubId(req: FastifyRequest<GetPartyInfoAvailableByTypeAndIdAndSubIdDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        const mainTimer = this._histogram.startTimer({callName: "getPartyInfoAvailableByTypeAndIdAndSubId"});
        this._logger.debug("Got getPartyInfoAvailableByTypeAndIdAndSubId request");

        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const type = req.params.type;
            const id = req.params.id;
            const partySubIdOrType = req.params.subid;
            const ownerFspId = req.body.party.partyIdInfo.fspId;
            const currency = req.query.currency;
            const merchantClassificationCode = req.body.party.merchantClassificationCode;
            const name = req.body.party.name;
            const firstName = req.body.party.personalInfo.complexName.firstName;
            const middleName = req.body.party.personalInfo.complexName.middleName;
            const lastName = req.body.party.personalInfo.complexName.lastName;
            const partyDoB = req.body.party.personalInfo.dateOfBirth;
            const extensionList = req.body.party.partyIdInfo.extensionList;
            const kycInfo = req.body.party.personalInfo.kycInformation;
            const supportedCurrencies = req.body.party.supportedCurrencies;

            if (!type || !id || !requesterFspId || !ownerFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                mainTimer({success: "false"});
                return;
            }

            if (currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if (this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: PartyInfoAvailableEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                ownerFspId: ownerFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency,
                merchantClassificationCode: merchantClassificationCode,
                name: name,
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                partyDoB: partyDoB,
                kycInfo: kycInfo,
                supportedCurrencies: supportedCurrencies,
                extensions: FspiopTransformer.convertToFlatExtensions(extensionList)
            };

            const msg = new PartyInfoAvailableEvt(msgPayload);

            // this is a response from the original destination, so we swap requester and destination
            msg.inboundProtocolType = "FSPIOP_v1_1";
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    headers: clonedHeaders,
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("getPartyInfoAvailableByTypeAndIdAndSubId sent message");

            reply.code(202).send(null);

            const took = mainTimer({success: "true"});
            this._logger.debug(`getPartyInfoAvailableByTypeAndIdAndSubId responded - took ${took}`);
        } catch (error: unknown) {

            if (error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            mainTimer({success: "false"});
            return;
        }
    }

    private async getPartyByTypeAndIdQueryReject(req: FastifyRequest<GetPartyByTypeAndIdQueryRejectDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        const mainTimer = this._histogram.startTimer({callName: "getPartyByTypeAndIdQueryReject"});
        this._logger.debug("Got getPartyByTypeAndIdQueryReject request");

        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const type = req.params.type;
            const id = req.params.id;
            const currency = req.query.currency;
            const errorInformation = req.body.errorInformation;

            if (!type || !id || !requesterFspId || !errorInformation) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                mainTimer({success: "false"});
                return;
            }

            if (currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if (this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }
            const msgPayload: PartyRejectedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency,
                errorInformation: {
                    errorCode: errorInformation.errorCode,
                    errorDescription: errorInformation.errorDescription,
                    extensions: FspiopTransformer.convertToFlatExtensions(errorInformation.extensionList)
                },
            };

            const msg = new PartyRejectedEvt(msgPayload);

            msg.validatePayload();

            msg.inboundProtocolType = "FSPIOP_v1_1";
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: destinationFspId,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("partyByTypeAndIdReject sent message");

            reply.code(202).send(null);

            const took = mainTimer({success: "true"});
            this._logger.debug(`getPartyByTypeAndIdQueryReject responded - took: ${took}`);
        } catch (error: unknown) {

            if (error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            mainTimer({success: "false"});
            return;
        }
    }

    private async getPartyByTypeAndIdAndSubIdQueryReject(req: FastifyRequest<GetPartyByTypeAndIdAndSubIdQueryRejectDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        const mainTimer = this._histogram.startTimer({callName: "getPartyByTypeAndIdAndSubIdQueryReject"});
        this._logger.debug("Got getPartyByTypeAndIdAndSubIdQueryReject request");

        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Data Model
            const type = req.params.type;
            const id = req.params.id;
            const currency = req.query.currency;
            const partySubIdOrType = req.params.subid;
            const errorInformation = req.body.errorInformation;

            if (!type || !id || !requesterFspId || !errorInformation) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                mainTimer({success: "false"});
                return;
            }

            if (currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if (this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: PartyRejectedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency,
                errorInformation: {
                    errorCode: errorInformation.errorCode,
                    errorDescription: errorInformation.errorDescription,
                    extensions: FspiopTransformer.convertToFlatExtensions(errorInformation.extensionList)
                },
            };

            const msg = new PartyRejectedEvt(msgPayload);

            msg.validatePayload();

            msg.inboundProtocolType = "FSPIOP_v1_1";
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: destinationFspId,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("partyByTypeAndIdAndSubIdReject sent message");

            reply.code(202).send(null);

            const took = mainTimer({success: "true"});
            this._logger.debug(`getPartyByTypeAndIdAndSubIdQueryReject responded - took: ${took}`);
        } catch (error: unknown) {

            if (error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            mainTimer({success: "false"});
            return;
        }
    }

}
