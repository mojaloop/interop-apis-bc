/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License")

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

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

import {FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { Constants, FspiopJwsSignature, FspiopValidator, FspiopTransformer, ValidationdError, ExtensionList } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    ParticipantQueryReceivedEvtPayload,
    ParticipantQueryReceivedEvt,
    ParticipantDisassociateRequestReceivedEvt,
    ParticipantDisassociateRequestReceivedEvtPayload,
    ParticipantAssociationRequestReceivedEvt,
    ParticipantAssociationRequestReceivedEvtPayload,
    ParticipantRejectedEvt,
    ParticipantRejectedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { FSPIOPErrorCodes } from "../validation";
import { IMessageProducer, MessageInboundProtocol } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {IMetrics, SpanStatusCode} from "@mojaloop/platform-shared-lib-observability-types-lib";
import { BaseRoutesFastify } from "../_base_routerfastify";
import { GetParticipantByTypeAndIdAndSubIdDTO, GetParticipantByTypeAndIdDTO, ParticipantByTypeAndIdAndSubIdRejectDTO } from "./participant_route_dto";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {SpanKind} from "@opentelemetry/api";

export class ParticipantRoutes extends BaseRoutesFastify {

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

        // POST Associate Party Party by Type & ID
        fastify.post("/:type/:id", this.associatePartyByTypeAndId.bind(this));

        // POST Associate Party Party by Type, ID & SubId
        fastify.post("/:type/:id/:subid", this.associatePartyByTypeAndIdAndSubId.bind(this));

        // Requests
        // GET Participant by Type & ID
        fastify.get("/:type/:id", this.getParticipantsByTypeAndID.bind(this));

        // GET Participants by Type, ID & SubId
        fastify.get("/:type/:id/:subid", this.getParticipantsByTypeAndIDAndSubId.bind(this));

        // DELETE Disassociate Party Party by Type & ID
        fastify.delete("/:type/:id", this.disassociatePartyByTypeAndId.bind(this));

        // DELETE Disassociate Party Party by Type, ID & SubId
        fastify.delete("/:type/:id/:subid", this.disassociatePartyByTypeAndIdAndSubId.bind(this));

        // PUT ERROR Participant by Type & ID
        fastify.put("/:type/:id/error", this.participantRequestByTypeAndIdReject.bind(this));

        // PUT ERROR Participant by Type, ID & SubId
        fastify.put("/:type/:id/:subid/error", this.participantRequestByTypeAndIdAndSubIdReject.bind(this));
    }

    private async getParticipantsByTypeAndID(req: FastifyRequest<GetParticipantByTypeAndIdDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got getParticipantsByTypeAndID request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            // Date Model
            const type = req.params.type;
            const id = req.params.id;

            const currency = req.query.currency;

            if (!type || !id || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: ParticipantQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency
            };

            const msg = new ParticipantQueryReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: null,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("getParticipantsByTypeAndID sent message");

            reply.code(202).send(null);

            this._logger.debug("getParticipantsByTypeAndID responded");

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

    private async getParticipantsByTypeAndIDAndSubId(req: FastifyRequest<GetParticipantByTypeAndIdAndSubIdDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got getParticipantsByTypeAndID request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            // Date Model
            const type = req.params.type;
            const id = req.params.id;
            const partySubIdOrType = req.params.subid;

            const currency = req.query.currency;

            if (!type || !id || !requesterFspId || !partySubIdOrType) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: ParticipantQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new ParticipantQueryReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: null,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("getParticipantsByTypeAndID sent message");

            reply.code(202).send(null);

            this._logger.debug("getParticipantsByTypeAndID responded");

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

    private async associatePartyByTypeAndId(req: FastifyRequest<{ Params: { type: string; id: string }, Querystring: { currency: string }, Body: { fspId: string, currency: string, extensionList: ExtensionList } }>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got associatePartyByTypeAndId request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            // Date Model
            const type = req.params.type;
            const id = req.params.id;
            const ownerFspId = req.body.fspId;
            const currency = req.body.currency;
            const extensionList = req.body.extensionList;
            
            if (!type || !id || !ownerFspId || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: ParticipantAssociationRequestReceivedEvtPayload = {
                ownerFspId: ownerFspId,
                partyId: id,
                partyType: type,
                partySubType: null,
                currency: currency,
                extensions: FspiopTransformer.convertToFlatExtensions(extensionList)
            };

            const msg = new ParticipantAssociationRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: null,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("associatePartyByTypeAndId sent message");

            reply.code(202).send(null);

            this._logger.debug("associatePartyByTypeAndId responded");

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

    private async associatePartyByTypeAndIdAndSubId(req: FastifyRequest<{ Params: { type: string; id: string, subid: string }, Querystring: { currency: string }, Body: { fspId: string, currency: string, extensionList: ExtensionList } }>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got associatePartyByTypeAndId request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            // Date Model
            const type = req.params.type;
            const id = req.params.id;
            const partySubIdOrType = req.params.subid;
            const ownerFspId = req.body.fspId;
            const currency = req.body.currency;
            const extensionList = req.body.extensionList;

            if (!type || !id || !ownerFspId || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: ParticipantAssociationRequestReceivedEvtPayload = {
                ownerFspId: ownerFspId,
                partyId: id,
                partyType: type,
                partySubType: partySubIdOrType,
                currency: currency,
                extensions: FspiopTransformer.convertToFlatExtensions(extensionList)
            };

            const msg = new ParticipantAssociationRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: null,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("associatePartyByTypeAndId sent message");

            reply.code(202).send(null);

            this._logger.debug("associatePartyByTypeAndId responded");

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

    private async disassociatePartyByTypeAndId(req: FastifyRequest<{ Params: { type: string; id: string }, Querystring: { currency: string } }>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got disassociatePartyByTypeAndId request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            // Date Model
            const type = req.params.type ;
            const id = req.params.id ;
            const currency = req.query.currency;

            if (!type || !id || !requesterFspId) {
                const transformError = FspiopTransformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: ParticipantDisassociateRequestReceivedEvtPayload = {
                ownerFspId: requesterFspId,
                partyId: id,
                partyType: type,
                partySubType: null,
                currency: currency
            };

            const msg = new ParticipantDisassociateRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: null,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("disassociatePartyByTypeAndId sent message");

            reply.code(202).send(null);

            this._logger.debug("disassociatePartyByTypeAndId responded");

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

    private async disassociatePartyByTypeAndIdAndSubId(req: FastifyRequest<{ Params: { type: string; id: string, subid: string }, Querystring: { currency: string }}>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got disassociatePartyByTypeAndIdAndSubId request");
        try {
            // Headers
            const clonedHeaders = {...req.headers};
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            // Date Model
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
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: ParticipantDisassociateRequestReceivedEvtPayload = {
                ownerFspId: requesterFspId,
                partyId: id,
                partyType: type,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new ParticipantDisassociateRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.inboundProtocolType = "FSPIOP_v1_1"; 
            msg.inboundProtocolOpaqueState = {
                fspiopOpaqueState: {
                    requesterFspId: requesterFspId,
                    destinationFspId: null,
                    headers: clonedHeaders
                }
            };
            msg.tracingInfo = {};

            parentSpan.setAttributes({"partyId": id});
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "kafka send", parentSpan, SpanKind.PRODUCER);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, msg.tracingInfo);
            await this._kafkaProducer.send(msg);
            childSpan.end();

            this._logger.debug("disassociatePartyByTypeAndIdAndSubId sent message");

            reply.code(202).send(null);

            this._logger.debug("disassociatePartyByTypeAndIdAndSubId responded");
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

    private async participantRequestByTypeAndIdReject(req: FastifyRequest<ParticipantByTypeAndIdAndSubIdRejectDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got participantRequestByTypeAndIdReject request");

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
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
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: ParticipantRejectedEvtPayload = {
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

            const msg = new ParticipantRejectedEvt(msgPayload);

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

            this._logger.debug("participantRequestByTypeAndIdReject sent message");

            reply.code(202).send(null);

            this._logger.debug("participantRequestByTypeAndIdReject responded");

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

    private async participantRequestByTypeAndIdAndSubIdReject(req: FastifyRequest<ParticipantByTypeAndIdAndSubIdRejectDTO>, reply: FastifyReply): Promise<void> {
        const parentSpan = this._getActiveSpan();
        this._logger.debug("Got participantRequestByTypeAndIdAndSubIdReject request");

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
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
                return;
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: ParticipantRejectedEvtPayload = {
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

            const msg = new ParticipantRejectedEvt(msgPayload);

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

            this._logger.debug("getPartyByTypeAndIdAndSubIdQueryReject sent message");

            reply.code(202).send(null);

            this._logger.debug("getPartyByTypeAndIdAndSubIdQueryReject responded");

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
}
