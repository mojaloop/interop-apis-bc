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
    BulkQuoteRejectedEvt,
    PartyRejectedEvt,
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
    QuoteResponseAccepted,
    QuoteBCRequiredRequesterParticipantIdMismatchErrorEvent,
    QuoteBCRequiredDestinationParticipantIdMismatchErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Enums, FspiopJwsSignature, Request, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {IDomainMessage, IMessage, IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
    MLKafkaJsonConsumerOptions,
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import { IParticipantService } from "../interfaces/infrastructure";
import {IMetrics } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { getQuotingBCErrorMapping } from "../error_mappings/quoting";

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

    async processMessagesBatch (sourceMessages: IMessage[]): Promise<void>{
        // eslint-disable-next-line no-async-promise-executor
        return new Promise<void>(async (resolve) => {
            const timerEndFn = this._histogram.startTimer({ callName: `${this.constructor.name}_batchMsgHandler`});

            for (const sourceMessage of sourceMessages) {
                await this.processMessage(sourceMessage);
            }

            const took = timerEndFn({ success: "true" })*1000;
            if (this._logger.isDebugEnabled()) {
                this._logger.debug(`  Completed batch in ${this.constructor.name} batch size: ${sourceMessages.length}`);
                this._logger.debug(`  Took: ${took.toFixed(0)}`);
                this._logger.debug("\n\n");
            }
            resolve();
        });
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const startTime = Date.now();
        this._histogram.observe({callName:"msgDelay"}, (startTime - sourceMessage.msgTimestamp)/1000);
        const processMessageTimer = this._histogram.startTimer({callName: "processMessage"});

        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(!message.fspiopOpaqueState || !message.fspiopOpaqueState.headers){
                this._logger.error(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                processMessageTimer({success: "false"});
                return;
            }

            switch(message.msgName){
                case QuoteRequestAcceptedEvt.name:
                    await this._handleQuoteRequestAcceptedEvt(new QuoteRequestAcceptedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case QuoteResponseAccepted.name:
                    await this._handleQuoteResponseAcceptedEvt(new QuoteResponseAccepted(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case QuoteQueryResponseEvt.name:
                    await this._handleQuoteQueryResponseEvt(new QuoteQueryResponseEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkQuoteReceivedEvt.name:
                    await this._handleBulkQuoteReceivedEvt(new BulkQuoteReceivedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkQuoteAcceptedEvt.name:
                    await this._handleBulkQuoteAcceptedEvt(new BulkQuoteAcceptedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkQuoteQueryResponseEvt.name:
                    await this._handleBulkQuoteQueryResponseEvt(new BulkQuoteQueryResponseEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case PartyRejectedEvt.name:
                case BulkQuoteRejectedEvt.name:
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
                    await this._handleErrorReceivedEvt(message, message.fspiopOpaqueState.headers);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }

            const took = processMessageTimer({success: "true"}) * 1000;
            this._logger.isDebugEnabled() && this._logger.debug(`  Completed processMessage in - took: ${took} ms`);
        } catch (error: unknown) {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = { ...message.fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders["fspiop-source"] as string;
            const quoteId = message.payload.quoteId as string;
            const bulkQuoteId = message.payload.bulkQuoteId as string;

            processMessageTimer({success: "false"});

            await this._sendErrorFeedbackToFsp({
                message: message,
                headers: message.fspiopOpaqueState.headers,
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

    async _handleErrorReceivedEvt(message: IDomainMessage, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        this._logger.debug("_handleQuotingErrorReceivedEvt -> start");

        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState;
        const sourceFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
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

    private async _handleQuoteRequestAcceptedEvt(message: QuoteRequestAcceptedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleQuoteRequestAcceptedEvt"});

        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            // TODO validate payload.payee.partyIdInfo.fspId actually exists
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(payload.payee.partyIdInfo.fspId as string);

            this._logger.debug("_handleQuoteRequestAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = Transformer.transformPayloadQuotingRequestPost(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);

             // provide original headers for tracing and test header pass-through
            (clonedHeaders as any).original_headers = { ...clonedHeaders };

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: transformedPayload
            });

            this._logger.debug("_handleQuoteRequestAcceptedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handleQuoteRequestAcceptedEvt -> error");
            mainTimer({success:"false"});
            throw Error("_handleQuoteRequestAcceptedEvt -> error");
        }
    }

    private async _handleQuoteResponseAcceptedEvt(message: QuoteResponseAccepted, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleQuoteResponseAcceptedEvt"});
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleQuoteResponseAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = Transformer.transformPayloadQuotingResponsePut(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setLocation([payload.quoteId]);

             // provide original headers for tracing and test header pass-through
            (clonedHeaders as any).original_headers = { ...clonedHeaders };

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: transformedPayload
            });

            this._logger.debug("_handleQuoteResponseAcceptedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handleQuoteResponseAcceptedEvt -> error");
            mainTimer({success:"false"});
            throw Error("_handleQuoteResponseAcceptedEvt -> error");
        }

        return;
    }

    private async _handleQuoteQueryResponseEvt(message: QuoteQueryResponseEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        const mainTimer = this._histogram.startTimer({ callName: "handleQuoteQueryResponseEvt"});
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;

            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleQuoteQueryResponseEvt -> start");

            // Always validate the payload and headers received
            // message.validatePayload();

            const transformedPayload = Transformer.transformPayloadQuotingResponseGet(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setId(payload.quoteId);

             // provide original headers for tracing and test header pass-through
            (clonedHeaders as any).original_headers = { ...clonedHeaders };

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: transformedPayload
            });

            this._logger.debug("_handleQuoteQueryResponseEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            this._logger.error(error,"_handleQuoteQueryResponseEvt -> error");
            mainTimer({success:"false"});
            throw Error("_handleQuoteQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteReceivedEvt(message: BulkQuoteReceivedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleBulkQuoteReceivedEvt"});
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

            this._logger.debug("_handleBulkQuoteReceivedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = Transformer.transformPayloadBulkQuotingResponsePost(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);

             // provide original headers for tracing and test header pass-through
            (clonedHeaders as any).original_headers = { ...clonedHeaders };

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: transformedPayload
            });

            this._logger.debug("_handleBulkQuoteReceivedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            mainTimer({success:"false"});
            this._logger.error(error, "_handleBulkQuoteReceivedEvt -> error");
            throw Error("_handleBulkQuoteReceivedEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteAcceptedEvt(message: BulkQuoteAcceptedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const mainTimer = this._histogram.startTimer({ callName: "handleBulkQuoteAcceptedEvt"});
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleBulkQuoteAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = Transformer.transformPayloadBulkQuotingResponsePut(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);

             // provide original headers for tracing and test header pass-through
            (clonedHeaders as any).original_headers = { ...clonedHeaders };

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: transformedPayload
            });

            this._logger.debug("_handleBulkQuoteAcceptedEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            mainTimer({success:"false"});
            this._logger.error(error, "_handleBulkQuoteAcceptedEvt -> error");
            throw Error("_handleBulkQuoteAcceptedEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteQueryResponseEvt(message: BulkQuoteQueryResponseEvt, fspiopOpaqueState: Request.FspiopHttpHeaders): Promise<void> {
        const mainTimer = this._histogram.startTimer({ callName: "handleBulkQuoteQueryResponseEvt"});
        try{
            const { payload } = message;
            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

            this._logger.debug("_handleBulkQuoteQueryResponseEvt -> start");

            // Always validate the payload and headers received
            // message.validatePayload();

            const transformedPayload = Transformer.transformPayloadBulkQuotingResponsePut(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);

            // provide original headers for tracing and test header pass-through
            (clonedHeaders as any).original_headers = { ...clonedHeaders };

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: transformedPayload
            });

            this._logger.debug("_handleBulkQuoteQueryResponseEvt -> end");
            mainTimer({success:"true"});
        } catch (error: unknown) {
            mainTimer({success:"false"});
            this._logger.error(error,"_handleBulkQuoteQueryResponseEvt -> error");
            throw Error("_handleBulkQuoteQueryResponseEvt -> error");
        }

    }
}


