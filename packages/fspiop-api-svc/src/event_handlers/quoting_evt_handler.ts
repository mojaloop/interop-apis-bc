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
    GetBulkQuoteQueryRejectedEvt,
    GetPartyQueryRejectedEvt,
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
    QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent,
    QuoteBCUnableToAddQuoteToDatabaseErrorEvent,
    QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent,
    QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent,
    QuoteBCUnknownErrorEvent,
    QuoteQueryResponseEvt,
    QuoteRequestAcceptedEvt,
    QuoteResponseAccepted
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Enums, Request, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {IDomainMessage, IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
// import { QuotesPost } from "../errors";
import { IParticipantService } from "../interfaces/infrastructure";

export class QuotingEventHandler extends BaseEventHandler {
    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        super(logger, consumerOptions, producerOptions, kafkaTopics, participantService, HandlerNames.Quotes);
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(!message.fspiopOpaqueState || !message.fspiopOpaqueState.headers){
                this._logger.error(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                return;
            }

            switch(message.msgName){
                case QuoteRequestAcceptedEvt.name:
                    await this._handleQuotingCreatedRequestReceivedEvt(new QuoteRequestAcceptedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case QuoteResponseAccepted.name:
                    await this._handleQuotingResponseAcceptedEvt(new QuoteResponseAccepted(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case QuoteQueryResponseEvt.name:
                    await this._handleQuotingQueryResponseEvt(new QuoteQueryResponseEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkQuoteReceivedEvt.name:
                    await this._handleBulkQuotingRequestReceivedEvt(new BulkQuoteReceivedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkQuoteAcceptedEvt.name:
                    await this._handleBulkQuoteAcceptedResponseEvt(new BulkQuoteAcceptedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkQuoteQueryResponseEvt.name:
                    await this._handleBulkQuotingQueryResponseEvt(new BulkQuoteQueryResponseEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case GetPartyQueryRejectedEvt.name:
                case GetBulkQuoteQueryRejectedEvt.name:
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
                    await this._handleErrorReceivedEvt(message, message.fspiopOpaqueState.headers);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }

        } catch (error: unknown) {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = { ...message.fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders["fspiop-source"] as string;
            const quoteId = message.payload.quoteId as string;
            const bulkQuoteId = message.payload.bulkQuoteId as string;

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
        this._logger.info("_handleQuotingErrorReceivedEvt -> start");

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

        this._logger.info("_handleQuotingErrorReceivedEvt -> end");

        return;
    }

    private buildErrorResponseBasedOnErrorEvent(message: IDomainMessage, sourceFspId:string): { errorCode: string; errorDescription: string, sourceFspId: string, destinationFspId: string | null } {
        const errorResponse: { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } =
        {
            errorCode : Enums.CommunicationErrors.COMMUNCATION_ERROR.code,
            errorDescription : Enums.CommunicationErrors.COMMUNCATION_ERROR.description,
            sourceFspId : sourceFspId,
            destinationFspId: null
        };

        switch (message.msgName) {
            case QuoteBCInvalidMessagePayloadErrorEvent.name:
            case QuoteBCInvalidMessageTypeErrorEvent.name:
            case QuoteBCInvalidBulkQuoteLengthErrorEvent.name:
            case QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent.name:
            case QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent.name:
            {
                errorResponse.errorCode = Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code;
                errorResponse.errorDescription = Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name;
                break;
            }
            case QuoteBCQuoteNotFoundErrorEvent.name:
            {
                errorResponse.errorCode = Enums.ClientErrors.QUOTE_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.QUOTE_ID_NOT_FOUND.name;
                break;
            }
            case QuoteBCBulkQuoteNotFoundErrorEvent.name: {
                errorResponse.errorCode = Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.name;
                break;
            }
            case QuoteBCInvalidDestinationFspIdErrorEvent.name:{
                errorResponse.errorCode = Enums.ClientErrors.DESTINATION_FSP_ERROR.code;
                errorResponse.errorDescription = Enums.ClientErrors.DESTINATION_FSP_ERROR.name;
                break;
            }            
            case QuoteBCDuplicateQuoteErrorEvent.name:
            case QuoteBCUnableToAddQuoteToDatabaseErrorEvent.name:
            case QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent.name:
            case QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent.name:
            case QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent.name:
            case QuoteBCInvalidRequesterFspIdErrorEvent.name: {
                errorResponse.errorCode = Enums.ClientErrors.GENERIC_CLIENT_ERROR.code;
                errorResponse.errorDescription = Enums.ClientErrors.GENERIC_CLIENT_ERROR.name;
                break;
            }
            case QuoteBCRequesterParticipantNotFoundErrorEvent.name: {
                errorResponse.errorCode = Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name;
                break;
            }
            case QuoteBCDestinationParticipantNotFoundErrorEvent.name: {
                errorResponse.errorCode = Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name;
                break;
            }
            case QuoteBCQuoteExpiredErrorEvent.name:
            case QuoteBCBulkQuoteExpiredErrorEvent.name: {
                errorResponse.errorCode = Enums.ClientErrors.QUOTE_EXPIRED.code;
                errorResponse.errorDescription = Enums.ClientErrors.QUOTE_EXPIRED.name;
                break;
            }
            case QuoteBCUnknownErrorEvent.name: {
                errorResponse.errorCode = Enums.ServerErrors.INTERNAL_SERVER_ERROR.code;
                errorResponse.errorDescription = Enums.ServerErrors.INTERNAL_SERVER_ERROR.name;
                break;
            }
            default: {
                this._logger.warn(`Cannot handle error message of type: ${message.msgName}, ignoring`);
                break;
            }
        }
        return errorResponse;
    }

    private async _handleQuotingCreatedRequestReceivedEvt(message: QuoteRequestAcceptedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            // TODO validate payload.payee.partyIdInfo.fspId actually exists
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(payload.payee.partyIdInfo.fspId as string);

            this._logger.info("_handleQuotingCreatedRequestReceivedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadQuotingRequestPost(payload),
            });

            this._logger.info("_handleQuotingCreatedRequestReceivedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error,"_handleQuotingCreatedRequestReceivedEvt -> error");
            throw Error("_handleQuotingCreatedRequestReceivedEvt -> error");
        }
    }

    private async _handleQuotingResponseAcceptedEvt(message: QuoteResponseAccepted, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.info("_handleQuotingResponseAcceptedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setLocation([payload.quoteId]);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadQuotingResponsePut(payload),
            });

            this._logger.info("_handleQuotingResponseAcceptedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error,"_handleQuotingResponseAcceptedEvt -> error");
            throw Error("_handleQuotingResponseAcceptedEvt -> error");
        }

        return;
    }

    private async _handleQuotingQueryResponseEvt(message: QuoteQueryResponseEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;

            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.info("_handleQuotingQueryResponseEvt -> start");

            // Always validate the payload and headers received
            // message.validatePayload();
            
            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setId(payload.quoteId);
            
            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadQuotingResponseGet(payload),
            });

            this._logger.info("_handleQuotingQueryResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error,"_handleQuotingQueryResponseEvt -> error");
            throw Error("_handleQuotingQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkQuotingRequestReceivedEvt(message: BulkQuoteReceivedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

            this._logger.info("_handleBulkQuotingRequestReceivedEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadBulkQuotingResponsePost(payload),
            });

            this._logger.info("_handleBulkQuotingRequestReceivedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleBulkQuotingRequestReceivedEvt -> error");
            throw Error("_handleBulkQuotingRequestReceivedEvt -> error");
        }

        return;
    }

    private async _handleBulkQuoteAcceptedResponseEvt(message: BulkQuoteAcceptedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.info("_handleBulkQuoteAcceptedResponseEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkQuotingResponsePut(payload),
            });

            this._logger.info("_handleBulkQuoteAcceptedResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleBulkQuoteAcceptedResponseEvt -> error");
            throw Error("_handleBulkQuoteAcceptedResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkQuotingQueryResponseEvt(message: BulkQuoteQueryResponseEvt, fspiopOpaqueState: Request.FspiopHttpHeaders): Promise<void> {
        try{
            const { payload } = message;
            const clonedHeaders = fspiopOpaqueState;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

            this._logger.info("_handleBulkQuoteQueryResponseEvt -> start");

            // Always validate the payload and headers received
            // message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
            urlBuilder.setId(payload.bulkQuoteId);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkQuotingResponsePut(payload),
            });

            this._logger.info("_handleBulkQuoteQueryResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error,"_handleBulkQuoteQueryResponseEvt -> error");
            throw Error("_handleBulkQuoteQueryResponseEvt -> error");
        }

    }
}



