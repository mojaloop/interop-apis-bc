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

import {
    AccountLookUpUnableToGetParticipantFromOracleErrorEvent,
    AccountLookUpUnknownErrorEvent,
    AccountLookupBCDestinationParticipantNotFoundErrorEvent,
    AccountLookupBCInvalidDestinationParticipantErrorEvent,
    AccountLookupBCInvalidMessagePayloadErrorEvent,
    AccountLookupBCInvalidMessageTypeErrorEvent,
    AccountLookupBCInvalidRequesterParticipantErrorEvent,
    AccountLookupBCRequesterParticipantNotFoundErrorEvent,
    AccountLookupBCUnableToAssociateParticipantErrorEvent,
    AccountLookupBCUnableToDisassociateParticipantErrorEvent,
    AccountLookupBCUnableToGetOracleAdapterErrorEvent,
    AccountLookupBCRequiredRequesterParticipantIsNotApprovedErrorEvent,
    AccountLookupBCRequiredRequesterParticipantIsNotActiveErrorEvent,
    AccountLookupBCRequiredDestinationParticipantIsNotApprovedErrorEvent,
    AccountLookupBCRequiredDestinationParticipantIsNotActiveErrorEvent,
    PartyRejectedResponseEvt,
    ParticipantRejectedResponseEvt,
    ParticipantAssociationCreatedEvt,
    ParticipantAssociationRemovedEvt,
    ParticipantQueryResponseEvt,
    PartyInfoRequestedEvt,
    PartyQueryResponseEvt,
    AccountLookupBCRequiredRequesterParticipantIdMismatchErrorEvent,
    AccountLookupBCRequiredDestinationParticipantIdMismatchErrorEvent,
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { BaseEventHandler, HandlerNames } from "./base_event_handler";
import { Constants, Enums, FspiopJwsSignature, FspiopTransformer, Request } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IDomainMessage, IMessage, IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { MLKafkaJsonConsumerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import { IParticipantService } from "../interfaces/infrastructure";
import {IMetrics, SpanStatusCode} from "@mojaloop/platform-shared-lib-observability-types-lib";
import { getAccountLookupBCErrorMapping } from "../error_mappings/account-lookup";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import * as OpentelemetryApi from "@opentelemetry/api";

export class AccountLookupEventHandler extends BaseEventHandler {


    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producer: IMessageProducer,
            kafkaTopics : string[],
            participantService: IParticipantService,
            jwsHelper: FspiopJwsSignature,
            metrics: IMetrics
    ) {
        super(logger, consumerOptions, producer, kafkaTopics,
            participantService, HandlerNames.AccountLookUp, jwsHelper,
            metrics
        );
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const startTime = Date.now();
        this._histogram.observe({callName:"msgDelay"}, (startTime - sourceMessage.msgTimestamp)/1000);
        const processMessageTimer = this._histogram.startTimer({callName: "processMessage"});

        if (this._logger.isDebugEnabled()) {
            const msgDelayMs = Date.now() - sourceMessage.msgTimestamp;
            this._logger.debug(`Got message in AccountLookupEventHandler - msgName: ${sourceMessage.msgName} - msgDelayMs: ${msgDelayMs}`);
        }

        // set specific span attributes
        this._getActiveSpan().setAttributes({
            "entityId": sourceMessage.payload.quoteId,
            "quoteId": sourceMessage.payload.quoteId,
        });


        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(message.inboundProtocolType !== "FSPIOP_v1_1" || !message.inboundProtocolOpaqueState || !message.inboundProtocolOpaqueState.fspiopOpaqueState || !message.inboundProtocolOpaqueState.fspiopOpaqueState.headers){
                this._logger.warn(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                processMessageTimer({success: "false"});
                return Promise.resolve();
            }

            switch (message.msgName) {
                case ParticipantAssociationCreatedEvt.name:
                    await this._handleParticipantAssociationRequestReceivedEvt(new ParticipantAssociationCreatedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case ParticipantAssociationRemovedEvt.name:
                    await this._handleParticipantDisassociateRequestReceivedEvt(new ParticipantAssociationRemovedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case PartyInfoRequestedEvt.name:
                    await this._handlePartyInfoRequestedEvt(new PartyInfoRequestedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case PartyQueryResponseEvt.name:
                    await this._handlePartyQueryResponseEvt(new PartyQueryResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case ParticipantQueryResponseEvt.name:
                    await this._handleParticipantQueryResponseEvt(new ParticipantQueryResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case PartyRejectedResponseEvt.name:
                    await this._handlePartyRejectedResponseEvt(new PartyRejectedResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case ParticipantRejectedResponseEvt.name:
                    await this._handleParticipantRejectedResponseEvt(new ParticipantRejectedResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case AccountLookUpUnknownErrorEvent.name:
                case AccountLookupBCInvalidMessagePayloadErrorEvent.name:
                case AccountLookupBCInvalidMessageTypeErrorEvent.name:
                case AccountLookupBCUnableToAssociateParticipantErrorEvent.name:
                case AccountLookupBCUnableToDisassociateParticipantErrorEvent.name:
                case AccountLookupBCUnableToGetOracleAdapterErrorEvent.name:
                case AccountLookUpUnableToGetParticipantFromOracleErrorEvent.name:
                case AccountLookupBCDestinationParticipantNotFoundErrorEvent.name:
                case AccountLookupBCInvalidDestinationParticipantErrorEvent.name:
                case AccountLookupBCRequesterParticipantNotFoundErrorEvent.name:
                case AccountLookupBCInvalidRequesterParticipantErrorEvent.name:
                case AccountLookupBCRequiredRequesterParticipantIdMismatchErrorEvent.name:
                case AccountLookupBCRequiredRequesterParticipantIsNotApprovedErrorEvent.name:
                case AccountLookupBCRequiredRequesterParticipantIsNotActiveErrorEvent.name:
                case AccountLookupBCRequiredDestinationParticipantIdMismatchErrorEvent.name:
                case AccountLookupBCRequiredDestinationParticipantIsNotApprovedErrorEvent.name:
                case AccountLookupBCRequiredDestinationParticipantIsNotActiveErrorEvent.name:
                    await this._handleErrorReceivedEvt(message, message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }

            const took = processMessageTimer({success: "true"}) * 1000;
            this._logger.isDebugEnabled() && this._logger.debug(`  Completed processMessage in - took: ${took} ms`);
        } catch (error: unknown) {
            this._logger.error(error, "processMessage Error");

            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = message.inboundProtocolOpaqueState.fspiopOpaqueState.headers;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const partyType = message.payload.partyType as string;
            const partyId = message.payload.partyId as string;
            const partySubType = message.payload.partySubType as string;

            this._getActiveSpan().setStatus({ code: SpanStatusCode.ERROR });

            processMessageTimer({success: "false"});

            await this._sendErrorFeedbackToFsp({
                message: message,
                headers: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers,
                id: [partyType, partyId, partySubType],
                errorResponse: {
                    errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                    errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name,
                    sourceFspId: requesterFspId,
                    destinationFspId: null
                }
            });
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost
        return;
    }

    async _handleErrorReceivedEvt(message: IDomainMessage, fspiopOpaqueState: any):Promise<void> {
        this._logger.debug("_handleAccountLookupErrorReceivedEvt -> start");

        const { payload } = message;

        // Headers
        const clonedHeaders = fspiopOpaqueState.headers;
        const sourceFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

        // Data model
        const partyType = payload.partyType as string;
        const partyId = payload.partyId as string;
        const partySubType = payload.partySubType as string;

        // TODO validate vars above

        const errorResponse = this.buildErrorResponseBasedOnErrorEvent(message, sourceFspId, destinationFspId);

        await this._sendErrorFeedbackToFsp({
            message: message,
            headers: clonedHeaders,
            id: [partyType, partyId, partySubType],
            errorResponse: errorResponse
        });

        this._logger.debug("_handleAccountLookupErrorReceivedEvt -> end");

        return;
    }

    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    private buildErrorResponseBasedOnErrorEvent(message: IDomainMessage, sourceFspId:string, destinationFspId:string): { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } {
        const errorResponse: { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } =
        {
            errorCode : Enums.CommunicationErrors.COMMUNICATION_ERROR.code,
            errorDescription : Enums.CommunicationErrors.COMMUNICATION_ERROR.name,
            sourceFspId : sourceFspId,
            destinationFspId: null
        };

        const errorMapping = getAccountLookupBCErrorMapping(message.payload.errorCode);

        if(errorMapping) {
            errorResponse.errorCode = errorMapping.errorCode;
            errorResponse.errorDescription = errorMapping.errorDescription;
        }

        return errorResponse;
    }

    private async _handleParticipantAssociationRequestReceivedEvt(message: ParticipantAssociationCreatedEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.debug("_handleParticipantAssociationRequestReceivedEvt -> start");

        try {

            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
            clonedHeaders[Constants.FSPIOP_HEADERS_HTTP_METHOD] = Enums.FspiopRequestMethodsEnum.PUT;

            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            const transformedPayload = FspiopTransformer.transformPayloadParticipantPut(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleParticipantAssociationRequestReceivedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error,"_handleParticipantAssociationRequestReceivedEvt -> error");
            throw Error("_handleParticipantAssociationRequestReceivedEvt -> error");
        }

        return;
    }

    private async _handleParticipantDisassociateRequestReceivedEvt(message: ParticipantAssociationRemovedEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.debug("_handleParticipantDisassociateRequestReceivedEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
            clonedHeaders[Constants.FSPIOP_HEADERS_HTTP_METHOD] = Enums.FspiopRequestMethodsEnum.PUT;

            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadPartyDisassociationPut(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleParticipantDisassociateRequestReceivedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error,"_handleParticipantDisassociateRequestReceivedEvt -> error");
            throw Error("_handleParticipantDisassociateRequestReceivedEvt -> error");
        }

        return;
    }

    private async _handlePartyInfoRequestedEvt(message: PartyInfoRequestedEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.debug("_handlePartyInfoRequestedEvt -> start");
        const mainTimer = this._histogram.startTimer({ callName: "handlePartyInfoRequestedEvt"});

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];

            // Data model
            const { payload } = message;

            // NOTE: Special case in getting the destination fsp id, as this is a lookup so only the payload will
            // have the information as we don't want any bounded context to ever change the opaque state
            const destinationFspId = payload.destinationFspId;

            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;

            // TODO handle the case where destinationFspId is null and remove ! below

            if(!destinationFspId){
                this._logger.debug("_handlePartyInfoRequestedEvt -> required destination fspId is missing from the header");
                throw Error("required destination fspId is missing from the header");
            }

            const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadPartyInfoRequestedPut(payload);

            if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = destinationFspId;
            }

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.GET, transformedPayload
            );

            this._logger.debug("_handlePartyInfoRequestedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handlePartyInfoRequestedEvt -> error");
            mainTimer({success:"false"});

            throw Error("_handlePartyInfoRequestedEvt -> error");
        }
    }

    private async _handlePartyQueryResponseEvt(message: PartyQueryResponseEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.debug("_handlePartyQueryResponseEvt -> start");
        const mainTimer = this._histogram.startTimer({ callName: "handlePartyQueryResponseEvt"});

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            const { extensionList } = fspiopOpaqueState;
            const protocolValues = { extensionList };

            const partyType = payload.partyType ;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;

            // TODO validate vars above

            const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadPartyInfoReceivedPut(payload, protocolValues);

            if(fspiopOpaqueState) {
                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = destinationFspId;
                }
            }

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handlePartyQueryResponseEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handlePartyQueryResponseEvt -> error");
            mainTimer({success:"false"});

            throw Error("_handlePartyQueryResponseEvt -> error");
        }
    }


    private async _handleParticipantQueryResponseEvt(message: ParticipantQueryResponseEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.debug("_handleParticipantQueryResponseEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
            clonedHeaders[Constants.FSPIOP_HEADERS_HTTP_METHOD] = Enums.FspiopRequestMethodsEnum.PUT;

            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;


            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadParticipantPut(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE], clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION],
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleParticipantQueryResponseEvt -> end");
        } catch (error: unknown) {
            this._logger.error(error,"_handleParticipantQueryResponseEvt -> error");
            throw Error("_handleParticipantQueryResponseEvt -> error");
        }

        return;
    }

    private async _handlePartyRejectedResponseEvt(message: PartyRejectedResponseEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.info("_handlePartyRejectedResponseEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            const partyType = payload.partyType ;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;


            const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            if(!destinationEndpoint) {
                throw Error(`fspId ${destinationFspId} has no valid participant associated`);
            }

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadPartyRejectedPut(payload);

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);
            urlBuilder.hasError(true);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.info("_handlePartyRejectedResponseEvt -> end");
        } catch (error: unknown) {
            this._logger.error(error,"_handlePartyRejectedResponseEvt -> error");
            throw Error("_handlePartyRejectedResponseEvt -> error");
        }

        return;
    }

    private async _handleParticipantRejectedResponseEvt(message: ParticipantRejectedResponseEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.info("_handleParticipantRejectedResponseEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            const partyType = payload.partyType ;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;

            const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            if(!destinationEndpoint) {
                throw Error(`fspId ${destinationFspId} has no valid participant associated`);
            }

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadParticipantRejectedPut(payload);

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
            urlBuilder.setLocation([partyType, partyId, partySubType]);
            urlBuilder.hasError(true);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.info("_handleParticipantRejectedResponseEvt -> end");
        } catch (error: unknown) {
            this._logger.error(error,"_handleParticipantRejectedResponseEvt -> error");
            throw Error("_handleParticipantRejectedResponseEvt -> error");
        }

        return;
    }

}
