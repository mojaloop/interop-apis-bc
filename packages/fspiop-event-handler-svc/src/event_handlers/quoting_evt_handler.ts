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

import { BaseEventHandler, HandlerNames } from "./base_event_handler";
import {
    BulkQuoteAcceptedEvt,
    BulkQuoteQueryResponseEvt,
    BulkQuoteReceivedEvt,
    BulkQuoteRejectedResponseEvt,
    QuoteRejectedResponseEvt,
    QuoteBCBulkQuoteExpiredErrorEvent,
    QuoteBCBulkQuoteNotFoundErrorEvent,
    QuoteBCDestinationParticipantNotFoundErrorEvent,
    QuoteBCDuplicateQuoteErrorEvent,
    QuoteBCInvalidBulkQuoteLengthErrorEvent,
    QuoteBCInvalidDestinationFspIdErrorEvent,
    QuoteBCInvalidMessagePayloadErrorEvent,
    QuoteBCInvalidMessageTypeErrorEvent,
    QuoteBCInvalidRequesterFspIdErrorEvent,
    QuoteBCQuoteExpiredErrorEvent,
    QuoteBCQuoteNotFoundErrorEvent,
    QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent,
    QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent,
    QuoteBCRequesterParticipantNotFoundErrorEvent,
    QuoteBCRequiredRequesterParticipantIsNotApprovedErrorEvent,
    QuoteBCRequiredRequesterParticipantIsNotActiveErrorEvent,
    QuoteBCRequiredDestinationParticipantIsNotApprovedErrorEvent,
    QuoteBCRequiredDestinationParticipantIsNotActiveErrorEvent,
    QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent,
    QuoteBCUnableToAddQuoteToDatabaseErrorEvent,
    QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent,
    QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent,
    QuoteBCUnknownErrorEvent,
    QuoteQueryResponseEvt,
    QuoteRequestAcceptedEvt,
    QuoteResponseAcceptedEvt,
    QuoteBCRequiredRequesterParticipantIdMismatchErrorEvent,
    QuoteBCRequiredDestinationParticipantIdMismatchErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Enums, FspiopJwsSignature, Request, FspiopTransformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IDomainMessage, IMessage, IMessageProducer, MessageInboundProtocol } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
    MLKafkaJsonConsumerOptions,
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";

import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IParticipantService } from "../interfaces/infrastructure";
import { IMetrics, Span, SpanStatusCode } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { getQuotingBCErrorMapping } from "../error_mappings/quoting";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import * as OpentelemetryApi from "@opentelemetry/api";
import {SpanKind, SpanOptions} from "@opentelemetry/api";

export class QuotingEventHandler extends BaseEventHandler {
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
            participantService, HandlerNames.Quotes, jwsHelper,
            metrics
        );
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const startTime = Date.now();
        this._histogram.observe({callName:"msgDelay"}, (startTime - sourceMessage.msgTimestamp)/1000);
        const processMessageTimer = this._histogram.startTimer({callName: "processMessage"});

        if (this._logger.isDebugEnabled()) {
            const msgDelayMs = Date.now() - sourceMessage.msgTimestamp;
            this._logger.debug(`Got message in QuotingEventHandler - msgName: ${sourceMessage.msgName} - msgDelayMs: ${msgDelayMs}`);
        }

        // set specific span attributes
        const span = this._getActiveSpan();
        span.setAttributes({
            "entityId": sourceMessage.payload.quoteId,
            "quoteId": sourceMessage.payload.quoteId,
        });

        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(message.inboundProtocolType !== "FSPIOP_v1_1" || !message.inboundProtocolOpaqueState || !message.inboundProtocolOpaqueState.fspiopOpaqueState.headers){
                this._logger.warn(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                processMessageTimer({success: "false"});
                return Promise.resolve();
            }

            switch(message.msgName){
                case QuoteRequestAcceptedEvt.name:
                    await this._handleQuoteRequestAcceptedEvt(new QuoteRequestAcceptedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case QuoteResponseAcceptedEvt.name:
                    await this._handleQuoteResponseAcceptedEvt(new QuoteResponseAcceptedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case QuoteQueryResponseEvt.name:
                    await this._handleQuoteQueryResponseEvt(new QuoteQueryResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case QuoteRejectedResponseEvt.name:
                    await this._handleQuoteRejectRequestEvt(new QuoteRejectedResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkQuoteReceivedEvt.name:
                    await this._handleBulkQuoteReceivedEvt(new BulkQuoteReceivedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkQuoteAcceptedEvt.name:
                    await this._handleBulkQuoteAcceptedEvt(new BulkQuoteAcceptedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkQuoteQueryResponseEvt.name:
                    await this._handleBulkQuoteQueryResponseEvt(new BulkQuoteQueryResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkQuoteRejectedResponseEvt.name:
                    await this._handleBulkQuoteRejectRequestEvt(new BulkQuoteRejectedResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case QuoteBCDuplicateQuoteErrorEvent.name:
                case QuoteBCQuoteNotFoundErrorEvent.name:
                case QuoteBCBulkQuoteNotFoundErrorEvent.name:
                case QuoteBCInvalidMessageTypeErrorEvent.name:
                case QuoteBCDestinationParticipantNotFoundErrorEvent.name:
                case QuoteBCRequesterParticipantNotFoundErrorEvent.name:
                case QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent.name:
                case QuoteBCInvalidRequesterFspIdErrorEvent.name:
                case QuoteBCInvalidDestinationFspIdErrorEvent.name:
                case QuoteBCUnknownErrorEvent.name:
                case QuoteBCQuoteExpiredErrorEvent.name:
                case QuoteBCBulkQuoteExpiredErrorEvent.name:
                case QuoteBCInvalidMessagePayloadErrorEvent.name:
                case QuoteBCUnableToAddQuoteToDatabaseErrorEvent.name:
                case QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent.name:
                case QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent.name:
                case QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent.name:
                case QuoteBCInvalidBulkQuoteLengthErrorEvent.name:
                case QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent.name:
                case QuoteBCRequiredRequesterParticipantIdMismatchErrorEvent.name:
                case QuoteBCRequiredRequesterParticipantIsNotApprovedErrorEvent.name:
                case QuoteBCRequiredRequesterParticipantIsNotActiveErrorEvent.name:
                case QuoteBCRequiredDestinationParticipantIdMismatchErrorEvent.name:
                case QuoteBCRequiredDestinationParticipantIsNotApprovedErrorEvent.name:
                case QuoteBCRequiredDestinationParticipantIsNotActiveErrorEvent.name:
                    await this._handleErrorReceivedEvt(message, message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }

            const took = processMessageTimer({success: "true"}) * 1000;
            this._logger.isDebugEnabled() && this._logger.debug(`  Completed processMessage in - took: ${took} ms`);
        } catch (error: unknown) {
            this._getActiveSpan().setStatus({ code: SpanStatusCode.ERROR });

            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = { ...message.inboundProtocolOpaqueState.fspiopOpaqueState.headers as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders["fspiop-source"] as string;
            const quoteId = message.payload.quoteId as string;
            const bulkQuoteId = message.payload.bulkQuoteId as string;

            processMessageTimer({success: "false"});

            await this._sendErrorFeedbackToFsp({
                message: message,
                headers: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers,
                id: quoteId ? [quoteId] : [bulkQuoteId],
                errorResponse: {
                    errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                    errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.description,
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
        this._logger.debug("_handleQuotingErrorReceivedEvt -> start");

        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState.headers;
        const sourceFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
        const quoteId = payload.quoteId as string;
        const bulkQuoteId = payload.bulkQuoteId as string;

        // TODO validate vars above

        const errorResponse = this.buildErrorResponseBasedOnErrorEvent(message, sourceFspId);

        await this._sendErrorFeedbackToFsp({
            message: message,
            headers: clonedHeaders,
            id: quoteId ? [quoteId] : [bulkQuoteId],
            errorResponse: errorResponse
        });

        this._logger.debug("_handleQuotingErrorReceivedEvt -> end");

        return;
    }

    private buildErrorResponseBasedOnErrorEvent(message: IDomainMessage, sourceFspId:string): { errorCode: string; errorDescription: string, sourceFspId: string, destinationFspId: string | null } {
        const errorResponse: { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } =
        {
            errorCode : Enums.CommunicationErrors.COMMUNICATION_ERROR.code,
            errorDescription : Enums.CommunicationErrors.COMMUNICATION_ERROR.description,
            sourceFspId : sourceFspId,
            destinationFspId: null
        };

        const errorMapping = getQuotingBCErrorMapping(message.payload.errorCode);

        if(errorMapping) {
            errorResponse.errorCode = errorMapping.errorCode;
            errorResponse.errorDescription = errorMapping.errorDescription;
        }

        return errorResponse;
    }

    private async _handleQuoteRequestAcceptedEvt(message: QuoteRequestAcceptedEvt, fspiopOpaqueState: any):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleQuoteRequestAcceptedEvt"});

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { extensionList } = fspiopOpaqueState;
            const protocolValues = { extensionList };

            // TODO validate vars above

            // TODO validate payload.payee.partyIdInfo.fspId actually exists
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(payload.payee.partyIdInfo.fspId as string);

            this._logger.debug("_handleQuoteRequestAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadQuotingRequestPost(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.POST, transformedPayload
            );

            this._logger.debug("_handleQuoteRequestAcceptedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {

            this._logger.error(error,"_handleQuoteRequestAcceptedEvt -> error");
            mainTimer({success:"false"});
            throw Error("_handleQuoteRequestAcceptedEvt -> error");
        }
    }

    private async _handleQuoteResponseAcceptedEvt(message: QuoteResponseAcceptedEvt, fspiopOpaqueState: any):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleQuoteResponseAcceptedEvt"});
        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;
            
            // Protocol Specific
            const { ilpPacket, condition, extensionList } = fspiopOpaqueState;
            const protocolValues = { ilpPacket, condition, extensionList };

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleQuoteResponseAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadQuotingResponsePut(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setLocation([payload.quoteId]);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleQuoteResponseAcceptedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handleQuoteResponseAcceptedEvt -> error");
            mainTimer({success:"false"});
            throw Error("_handleQuoteResponseAcceptedEvt -> error");
        }

        return;
    }

    private async _handleQuoteQueryResponseEvt(message: QuoteQueryResponseEvt, fspiopOpaqueState: any):Promise<void> {
        const mainTimer = this._histogram.startTimer({ callName: "handleQuoteQueryResponseEvt"});
        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { ilpPacket, condition, extensionList } = fspiopOpaqueState;

            const protocolValues = { ilpPacket, condition, extensionList };

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleQuoteQueryResponseEvt -> start");

            // Always validate the payload and headers received
            // message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadQuotingResponseGet(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setId(payload.quoteId);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleQuoteQueryResponseEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handleQuoteQueryResponseEvt -> error");
            mainTimer({success:"false"});
            throw Error("_handleQuoteQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteReceivedEvt(message: BulkQuoteReceivedEvt, fspiopOpaqueState: any):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleBulkQuoteReceivedEvt"});
        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;
            const { extensionList } = fspiopOpaqueState;
            const protocolValues = { extensionList };

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleBulkQuoteReceivedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkQuotingResponsePost(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.POST, transformedPayload
            );

            this._logger.debug("_handleBulkQuoteReceivedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            mainTimer({success:"false"});
            this._logger.error(error, "_handleBulkQuoteReceivedEvt -> error");
            throw Error("_handleBulkQuoteReceivedEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteAcceptedEvt(message: BulkQuoteAcceptedEvt, fspiopOpaqueState: any):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleBulkQuoteAcceptedEvt"});
        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { ilpPacket, condition, extensionList } = fspiopOpaqueState;
            const protocolValues = { ilpPacket, condition, extensionList };

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleBulkQuoteAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkQuotingResponsePut(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleBulkQuoteAcceptedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            mainTimer({success:"false"});
            this._logger.error(error, "_handleBulkQuoteAcceptedEvt -> error");
            throw Error("_handleBulkQuoteAcceptedEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteQueryResponseEvt(message: BulkQuoteQueryResponseEvt, fspiopOpaqueState: any): Promise<void> {
        const mainTimer = this._histogram.startTimer({ callName: "handleBulkQuoteQueryResponseEvt"});
        try{
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { ilpPacket, condition, extensionList } = fspiopOpaqueState;
            const protocolValues = { ilpPacket, condition, extensionList };

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleBulkQuoteQueryResponseEvt -> start");

            // Always validate the payload and headers received
            // message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkQuotingResponsePut(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE], clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION],
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleBulkQuoteQueryResponseEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            mainTimer({success:"false"});
            this._logger.error(error,"_handleBulkQuoteQueryResponseEvt -> error");
            throw Error("_handleBulkQuoteQueryResponseEvt -> error");
        }

    }

    private async _handleQuoteRejectRequestEvt(message: QuoteRejectedResponseEvt, fspiopOpaqueState: any):Promise<void> {
        this._logger.info("_handleQuoteRejectRequestEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setId(payload.quoteId);
            urlBuilder.hasError(true);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, FspiopTransformer.transformPayloadQuotingRequestPutError(payload)
            );

            this._logger.info("_handleQuoteRejectRequestEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleQuoteRejectRequestEvt -> error");
            throw Error("_handleQuoteRejectRequestEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteRejectRequestEvt(message: BulkQuoteRejectedResponseEvt, fspiopOpaqueState: any):Promise<void> {
        this._logger.info("_handleBulkQuoteRejectRequestEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkQuotingRequestPutError(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);
            urlBuilder.hasError(true);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.info("_handleBulkQuoteRejectRequestEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleBulkQuoteRejectRequestEvt -> error");
            throw Error("_handleBulkQuoteRejectRequestEvt -> error");
        }

        return;
    }
}



