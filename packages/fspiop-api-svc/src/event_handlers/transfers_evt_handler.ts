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
import { TransferErrorEvt, TransferPreparedEvt, TransferCommittedFulfiledEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Validate, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IncomingHttpHeaders } from "http";
import { BaseEventHandler } from "./base_event_handler";
import { AxiosError } from "axios";
import { TransfersPost } from "../errors";
import { IParticipantService } from "../interfaces/infrastructure";

const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || 'OperatorBcErrors';

export class TransferEventHandler extends BaseEventHandler {
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
        const message: IDomainMessage = sourceMessage as IDomainMessage;

        switch(message.msgName){
            case TransferErrorEvt.name:
                await this._handleErrorReceivedEvt(new TransferErrorEvt(message.payload), message.fspiopOpaqueState);
                break;
            case TransferPreparedEvt.name:
                await this._handleTransferPreparedEvt(new TransferPreparedEvt(message.payload), message.fspiopOpaqueState);
                break;
            case TransferCommittedFulfiledEvt.name:
                await this._handleTransferCommittedFulfiledEvt(new TransferCommittedFulfiledEvt(message.payload), message.fspiopOpaqueState);
                break;
            default:
                this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    async _handleErrorReceivedEvt(message: TransferErrorEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleAccountLookUpErrorReceivedEvt()");
            
            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg = new TransferErrorEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);
            
            return;
        }

        try {
            this._logger.info('_handleErrorReceivedEvt -> start');


            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(TransfersPost, clonedHeaders);


            let url: string;
            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            
            switch(message.payload.sourceEvent){
                case TransferPreparedEvt.name:
                case TransferCommittedFulfiledEvt.name:
                    urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
                    urlBuilder.setId(payload.transferId);
                    urlBuilder.hasError(true);

                    url = urlBuilder.build();
        
                    break;
                default:
                    throw new Error("Unhandled message source event on QuotingEventHandler_handleQuotingErrorReceivedEvt()");
            }

           
            await Request.sendRequest({
                url: url, 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: destinationFspId, 
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

    private async _handleTransferPreparedEvt(message: TransferPreparedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = payload.payeeFsp;

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

        if(!requestedEndpoint){

            this._logger.error("Cannot get requestedEndpoint at _handleTransferPreparedEvt");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new TransferPreparedEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handleTransferPreparedEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: destinationFspId, 
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadTransferRequestPost(payload),
            });

            this._logger.info('_handleTransferPreparedEvt -> end');

        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: requestedEndpoint,
                entity: Enums.EntityTypeEnum.TRANSFERS,
                id: [payload.transferId],
            });
        }

        return;
    }

    private async _handleTransferCommittedFulfiledEvt(message: TransferCommittedFulfiledEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

        if(!requestedEndpoint){

            this._logger.error("Cannot get requestedEndpoint at _handleTransferCommittedFulfiledEvt");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new TransferCommittedFulfiledEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handleTransferCommittedFulfiledEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilder.setLocation([payload.transferId]);

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: destinationFspId, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadTransferRequestPut(payload),
            });

            this._logger.info('_handleTransferCommittedFulfiledEvt -> end');

        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: requestedEndpoint,
                entity: Enums.EntityTypeEnum.TRANSFERS,
                id: [payload.transferId],
            });
        }

        return;
    }

}
