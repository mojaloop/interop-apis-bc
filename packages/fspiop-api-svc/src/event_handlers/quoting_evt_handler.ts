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
    QuoteErrorEvt,
    QuoteRequestAcceptedEvt,
    QuoteRequestReceivedEvt,
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Validate, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ParticipantsHttpClient } from "@mojaloop/participants-bc-client-lib";
import { IncomingHttpHeaders } from "http";
import { BaseEventHandler } from "./base_event_handler";
import { AxiosError } from "axios";
import { QuotesPost } from "../errors";

const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || 'OperatorBcErrors';

export class QuotingEventHandler extends BaseEventHandler {
    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: ParticipantsHttpClient
    ) {
        super(logger, consumerOptions, producerOptions, kafkaTopics, participantService);
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const message: IDomainMessage = sourceMessage as IDomainMessage;

        switch(message.msgName){
            case QuoteErrorEvt.name:
                await this._handleErrorReceivedEvt(new QuoteErrorEvt(message.payload), message.fspiopOpaqueState);
                break;
            case QuoteRequestAcceptedEvt.name:
                await this._handleQuotingCreatedRequestReceivedEvt(new QuoteRequestAcceptedEvt(message.payload), message.fspiopOpaqueState);
                break;
            default:
                this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    async _handleErrorReceivedEvt(message: QuoteErrorEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.requesterFspId;
        const destinationFspId = payload.destinationFspId;
        const quoteId = payload.quoteId;
        
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleAccountLookUpErrorReceivedEvt()");
            
            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg = new QuoteErrorEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);
            
            return;
        }

        try {
            this._logger.info('_handleErrorReceivedEvt -> start');


            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(QuotesPost, clonedHeaders);


            let template;
            switch(message.payload.sourceEvent){
                case QuoteRequestReceivedEvt.name:
                    template = Request.buildRequestUrl({
                        entity: Enums.EntityTypeEnum.QUOTES,
                        partyType: null, 
                        partyId: null, 
                        partySubType: null,
                        error: true
                    });
                    break;
                default:
                    throw new Error("Unhandled message source event on QuotingEventHandler_handleQuotingErrorReceivedEvt()");
            }

           
            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadError({
                    errorCode: Enums.ErrorCode.NOT_FOUND, // TODO: find proper error code
                    errorDescription: payload.errorMsg
                }),
            });

            this._logger.info('_handleErrorReceivedEvt -> end');

        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));
        }

        return;
    }

    private async _handleQuotingCreatedRequestReceivedEvt(message: QuoteRequestAcceptedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.requesterFspId;
        const destinationFspId = payload.destinationFspId;
        const quoteId = payload.quoteId;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){

            this._logger.error("Cannot get requestedEndpoint at _handleQuotingCreatedRequestReceivedEvt()");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new QuoteRequestAcceptedEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handleQuotingCreatedRequestReceivedEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(QuotesPost, clonedHeaders);

            
            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.QUOTES,
                partyType: null, 
                partyId: null, 
                partySubType: null,
                error: false
            });

            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: requesterFspId, 
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadQuotingRequestPost(payload),
            });

            this._logger.info('_handleQuotingCreatedRequestReceivedEvt -> end');

        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));
            
            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.QUOTES,
                partyType: null, 
                partyId: null, 
                partySubType: null,
                error: true
            });
           
            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadError({
                    errorCode: Enums.ErrorCode.BAD_REQUEST,
                    errorDescription: JSON.stringify(err),
                })
            });
        }

        return;
    }
}
