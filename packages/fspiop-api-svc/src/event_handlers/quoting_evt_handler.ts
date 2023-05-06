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
import {IDomainMessage, IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
    QuoteBCInvalidIdErrorEvent,
    QuoteRequestAcceptedEvt,
    QuoteResponseAccepted,
    QuoteQueryResponseEvt,
    BulkQuoteReceivedEvt,
    BulkQuoteAcceptedEvt,
    QuoteBCDuplicateQuoteErrorEvent,
    QuoteBCInvalidMessageErrorEvent,
    QuoteBCBulkQuoteNotFoundErrorEvent,
    QuoteBCQuoteNotFoundErrorEvent,
    QuoteBCInvalidMessageTypeErrorEvent,
    QuoteBCParticipantNotFoundErrorEvent,
    QuoteBCRequiredParticipantIsNotActiveErrorEvent,
    QuoteBCInvalidParticipantIdErrorEvent,
    QuoteBCInvalidRequesterFspIdErrorEvent,
    QuoteBCInvalidDestinationFspIdErrorEvent,
    QuoteBCInvalidDestinationPartyInformationErrorEvent,
    QuoteBCUnknownErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Validate, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IncomingHttpHeaders } from "http";
import { BaseEventHandler } from "./base_event_handler";
import { QuotesPost } from "../errors";
import { IParticipantService } from "../interfaces/infrastructure";

export class QuotingEventHandler extends BaseEventHandler {
    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        super(logger, consumerOptions, producerOptions, kafkaTopics, participantService);
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            switch(message.msgName){
                case QuoteBCInvalidIdErrorEvent.name:
                    await this._handleErrorReceivedEvt(new QuoteBCInvalidIdErrorEvent(message.payload), message.fspiopOpaqueState);
                    break;
                case QuoteRequestAcceptedEvt.name:
                    await this._handleQuotingCreatedRequestReceivedEvt(new QuoteRequestAcceptedEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case QuoteResponseAccepted.name:
                    await this._handleQuotingResponseAcceptedEvt(new QuoteResponseAccepted(message.payload), message.fspiopOpaqueState);
                    break;
                case QuoteQueryResponseEvt.name:
                    await this._handleQuotingQueryResponseEvt(new QuoteQueryResponseEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case BulkQuoteReceivedEvt.name:
                    await this._handleBulkQuotingRequestReceivedEvt(new BulkQuoteReceivedEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case BulkQuoteAcceptedEvt.name:
                    await this._handleBulkQuoteAcceptedResponseEvt(new BulkQuoteAcceptedEvt(message.payload), message.fspiopOpaqueState);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }

        } catch (e: unknown) {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = { ...message.fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders["fspiop-source"] as string;
            const partyType = message.payload.partyType as string;
            const partyId = message.payload.partyId as string;
            const partySubType = message.payload.partySubType as string;

            this._sendErrorFeedbackToFsp({
                message: message,
                error: message.msgName,
                errorCode: "2100",
                headers: message.fspiopOpaqueState.headers,
                source: requesterFspId,
                id: [partyType, partyId, partySubType]
            });
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost

        return;
    }

    async _handleErrorReceivedEvt(message: IDomainMessage, fspiopOpaqueState: IncomingHttpHeaders):Promise<void> {
        this._logger.info('_handleQuotingErrorReceivedEvt -> start');

        const { payload } = message;
  
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
        const requesterFspId = clonedHeaders["fspiop-source"] as string;
        const quoteId = payload.quoteId as string;
        const bulkQuoteId = payload.bulkQuoteId as string;

        const requestedEndpoint = (await this._validateParticipantAndGetEndpoint(requesterFspId));

        if(!requestedEndpoint) {
            throw Error(`fspId ${requesterFspId} has no valid participant associated`);
        }

        const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
        
        urlBuilder.setEntity(quoteId ? Enums.EntityTypeEnum.QUOTES : Enums.EntityTypeEnum.BULK_QUOTES);
        urlBuilder.setLocation(quoteId ? [quoteId] : [bulkQuoteId]);
        urlBuilder.hasError(true);
        
        const extensionList = [];
        let list: string[] = [];
        let errorCode = "1000"; // Default error code

        switch(message.msgName){
            case QuoteBCInvalidIdErrorEvent.name:
            case QuoteBCDuplicateQuoteErrorEvent.name:
            case QuoteBCQuoteNotFoundErrorEvent.name:
            case QuoteBCBulkQuoteNotFoundErrorEvent.name: 
            case QuoteBCInvalidMessageErrorEvent.name:
            case QuoteBCInvalidMessageTypeErrorEvent.name:
            case QuoteBCParticipantNotFoundErrorEvent.name:
            case QuoteBCInvalidParticipantIdErrorEvent.name: 
            case QuoteBCRequiredParticipantIsNotActiveErrorEvent.name: 
            case QuoteBCInvalidRequesterFspIdErrorEvent.name:
            case QuoteBCInvalidDestinationFspIdErrorEvent.name: 
            case QuoteBCInvalidDestinationPartyInformationErrorEvent.name: {
                if(quoteId) {
                    list = ["quoteId", "fspId"]
                } else {
                    list = ["bulkQuoteId", "fspId"];
                }

                errorCode = Enums.ClientErrorCodes.GENERIC_CLIENT_ERROR;

                break;
            }
            case QuoteBCUnknownErrorEvent.name: {
                if(quoteId) {
                    list = ["quoteId", "fspId"]
                } else {
                    list = ["bulkQuoteId", "fspId"];
                }

                errorCode = Enums.ServerErrorCodes.INTERNAL_SERVER_ERROR;

                break;
            }
            default: {
                this._logger.warn(`Cannot handle error message of type: ${message.msgName}, ignoring`);
                break;
            }
        }
                
        for(let i=0 ; i<list.length ; i+=1){
            if(payload[list[i]]) {
                extensionList.push({
                    key: list[i],
                    value: payload[list[i]]
                });
            }
        } 

        this._sendErrorFeedbackToFsp({
            message: message,
            error: message.payload.errorDescription,
            errorCode: errorCode,
            headers: clonedHeaders,
            source: requesterFspId,
            id: quoteId ? [quoteId] : [bulkQuoteId],
            extensionList: extensionList
        });

        this._logger.info('_handleQuotingErrorReceivedEvt -> end');

        return;
    }

    private async _handleQuotingCreatedRequestReceivedEvt(message: QuoteRequestAcceptedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        try {
            const { payload } = message;
    
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(payload.payee.partyIdInfo.fspId as string);

            if(!requestedEndpoint) {
                throw Error(`fspId ${payload.payee.partyIdInfo.fspId} has no valid participant associated`);
            }

            this._logger.info('_handleQuotingCreatedRequestReceivedEvt -> start');

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

            this._logger.info('_handleQuotingCreatedRequestReceivedEvt -> end');

        } catch (error: unknown) {
            this._logger.info('_handleQuotingCreatedRequestReceivedEvt -> error');
            throw Error("_handleQuotingCreatedRequestReceivedEvt -> error");
        }

        return;
    }

    private async _handleQuotingResponseAcceptedEvt(message: QuoteResponseAccepted, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        try {
            const { payload } = message;
    
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;
            
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            if(!requestedEndpoint) {
                throw Error(`fspId ${destinationFspId} has no valid participant associated`);
            }

            this._logger.info('_handleQuotingResponseAcceptedEvt -> start');

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

            this._logger.info('_handleQuotingResponseAcceptedEvt -> end');

        } catch (error: unknown) {
            this._logger.info('_handleQuotingResponseAcceptedEvt -> error');
            throw Error("_handleQuotingResponseAcceptedEvt -> error");
        }

        return;
    }

    private async _handleQuotingQueryResponseEvt(message: QuoteQueryResponseEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        try {
            const { payload } = message;
    
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

            if(!requestedEndpoint) {
                throw Error(`fspId ${requesterFspId} has no valid participant associated`);
            }

            this._logger.info('_handleQuotingQueryResponseEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(QuotesPost, clonedHeaders);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
            urlBuilder.setId(payload.quoteId);

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: requesterFspId, 
                method: Enums.FspiopRequestMethodsEnum.GET,
                payload: null,
            });

            this._logger.info('_handleQuotingQueryResponseEvt -> end');

        } catch (error: unknown) {
            this._logger.info('_handleQuotingQueryResponseEvt -> error');
            throw Error("_handleQuotingQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkQuotingRequestReceivedEvt(message: BulkQuoteReceivedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        try {
            const { payload } = message;
    
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;
            
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

            if(!requestedEndpoint) {
                throw Error(`fspId ${requesterFspId} has no valid participant associated`);
            }

            this._logger.info('_handleBulkQuotingRequestReceivedEvt -> start');

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

            this._logger.info('_handleBulkQuotingRequestReceivedEvt -> end');

        } catch (error: unknown) {
            this._logger.info('_handleBulkQuotingRequestReceivedEvt -> error');
            throw Error("_handleBulkQuotingRequestReceivedEvt -> error");
        }

        return;
    }
    
    private async _handleBulkQuoteAcceptedResponseEvt(message: BulkQuoteAcceptedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        try {
            const { payload } = message;
    
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;
            
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            if(!requestedEndpoint) {
                throw Error(`fspId ${destinationFspId} has no valid participant associated`);
            }

            this._logger.info('_handleBulkQuoteAcceptedResponseEvt -> start');

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

            this._logger.info('_handleBulkQuoteAcceptedResponseEvt -> end');

        } catch (error: unknown) {
            this._logger.info('_handleBulkQuoteAcceptedResponseEvt -> error');
            throw Error("_handleBulkQuoteAcceptedResponseEvt -> error");
        }

        return;
    }
}
