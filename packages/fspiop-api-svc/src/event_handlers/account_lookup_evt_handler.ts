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

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

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
    AccountLookUpErrorEvt,
    PartyInfoRequestedEvt,
    PartyQueryResponseEvt,
    ParticipantAssociationCreatedEvt,
    ParticipantAssociationRemovedEvt,
    ParticipantQueryResponseEvt,
    ParticipantQueryReceivedEvt,
    ParticipantDisassociateRequestReceivedEvt,
    ParticipantAssociationRequestReceivedEvt,
    PartyInfoAvailableEvt, PartyQueryReceivedEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Validate, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ParticipantsPutId, ParticipantsPutTypeAndId, PartiesPutTypeAndId, PartiesPutTypeAndIdAndSubId } from "../errors";
import { ParticipantsHttpClient } from "@mojaloop/participants-bc-client-lib";
import { IncomingHttpHeaders } from "http";
import { BaseEventHandler } from "./base_event_handler";
import { AxiosError } from "axios";
import { IParticipantService } from "../interfaces/types";

const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || 'OperatorBcErrors';

export class AccountLookupEventHandler extends BaseEventHandler {
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
            case AccountLookUpErrorEvt.name:
                await this._handleErrorReceivedEvt(new AccountLookUpErrorEvt(message.payload), message.fspiopOpaqueState);
                break;
            case ParticipantAssociationCreatedEvt.name:
                await this._handleParticipantAssociationRequestReceivedEvt(new ParticipantAssociationCreatedEvt(message.payload), message.fspiopOpaqueState);
                break;
            case ParticipantAssociationRemovedEvt.name:
                await this._handleParticipantDisassociateRequestReceivedEvt(new ParticipantAssociationRemovedEvt(message.payload), message.fspiopOpaqueState);
                break;
            case PartyInfoRequestedEvt.name:
                await this._handlePartyInfoRequestedEvt(new PartyInfoRequestedEvt(message.payload), message.fspiopOpaqueState);
                break;
            case PartyQueryResponseEvt.name:
                await this._handlePartyQueryResponseEvt(new PartyQueryResponseEvt(message.payload), message.fspiopOpaqueState);
                break;
            case ParticipantQueryResponseEvt.name:
                await this._handleParticipantQueryResponseEvt(new ParticipantQueryResponseEvt(message.payload), message.fspiopOpaqueState);
                break;
            default:
                this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    async _handleErrorReceivedEvt(message: AccountLookUpErrorEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.requesterFspId as string;
        const partyType = payload.partyType as string;
        const partyId = payload.partyId as string;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleAccountLookUpErrorReceivedEvt()");
            
            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new AccountLookUpErrorEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);
            
            return;
        }

        try {
            this._logger.info('_handleErrorReceivedEvt -> start');


            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            let url;
            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value)

            switch(message.payload.sourceEvent){
                case PartyQueryReceivedEvt.name:
                case PartyInfoAvailableEvt.name:
                case PartyInfoRequestedEvt.name:
                    urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
                    urlBuilder.setLocation([partyType, partyId, partySubType]);
                    urlBuilder.hasError(true);

                    url = urlBuilder.build();
                    break;
                case ParticipantAssociationRequestReceivedEvt.name:
                case ParticipantDisassociateRequestReceivedEvt.name:
                case ParticipantQueryReceivedEvt.name:
                    urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
                    urlBuilder.setLocation([partyType, partyId, partySubType]);
                    urlBuilder.hasError(true);

                    url = urlBuilder.build();
                    break;
                default:
                    throw new Error("Unhandled message source event on AccountLookupEventHandler_handleAccountLookUpErrorReceivedEvt()");
            }

           
            await Request.sendRequest({
                url: url, 
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

    private async _handleParticipantAssociationRequestReceivedEvt(message: ParticipantAssociationCreatedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.ownerFspId;
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){

            this._logger.error("Cannot get requestedEndpoint at _handleParticipantAssociationRequestReceivedEvt()");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new ParticipantAssociationCreatedEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value)
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType])

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: requesterFspId, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyAssociationPut(payload),
            });

            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> end');

        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: requestedEndpoint,
                entity: Enums.EntityTypeEnum.PARTIES,
                id: [partyType, partyId, partySubType],
            })
        }

        return;
    }
    
    private async _handleParticipantDisassociateRequestReceivedEvt(message: ParticipantAssociationRemovedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.ownerFspId;
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleParticipantDisassociateRequestReceivedEvt()");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new ParticipantAssociationRemovedEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handleParticipantDisassociateRequestReceivedEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value)
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType])

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: requesterFspId, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyDisassociationPut(payload),
            });

            this._logger.info('_handleParticipantDisassociateRequestReceivedEvt -> end');

        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: requestedEndpoint,
                entity: Enums.EntityTypeEnum.PARTIES,
                id: [partyType, partyId, partySubType],
            })
        }

        return;
    }

    private async _handlePartyInfoRequestedEvt(message: PartyInfoRequestedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.requesterFspId;
        const destinationFspId = payload.destinationFspId;
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        // TODO handle the case where destinationFspId is null and remove ! below

        if(!destinationFspId){
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            return;
        }

        const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

        if(!destinationEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get destinationEndpoint at _handlePartyInfoRequestedEvt()");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new PartyInfoRequestedEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handlePartyInfoRequestedEvt -> start');
            
            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);
            

            if(fspiopOpaqueState) {
                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === '') {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
                }

                clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
            }

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value)
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType])

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.GET,
                payload: Transformer.transformPayloadPartyInfoRequestedPut(payload),
            });

            this._logger.info('_handlePartyInfoRequestedEvt -> end');
    
        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: destinationEndpoint,
                entity: Enums.EntityTypeEnum.PARTIES,
                id: [partyType, partyId, partySubType],
            })
        }

        return;
    }

    private async _handlePartyQueryResponseEvt(message: PartyQueryResponseEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.requesterFspId;
        const destinationFspId = payload.ownerFspId;
        const partyType = payload.partyType ;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        if(!destinationFspId){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get destinationFspId at _handlePartyInfoRequestedEvt()");
            
            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg = new PartyQueryResponseEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);
            
            return;
        }

        const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

        if(!destinationEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get destinationEndpoint at _handlePartyQueryResponseEvt()");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new PartyQueryResponseEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handlePartyQueryResponseEvt -> start');
            
            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            if(fspiopOpaqueState) {
                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === '') {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
                }

                clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
            }
            
            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value)
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType])

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyInfoReceivedPut(payload),
            });

            this._logger.info('_handlePartyQueryResponseEvt -> end');
        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: destinationEndpoint,
                entity: Enums.EntityTypeEnum.PARTIES,
                id: [partyType, partyId, partySubType],
            })
        }

        return;
    }


    private async _handleParticipantQueryResponseEvt(message: ParticipantQueryResponseEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const requesterFspId = payload.requesterFspId;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleParticipantQueryResponseEvt()");

            // TODO discuss about having the specific event for overall errors so we dont have
            // to change an existing event to use the generic topic
            const msg =  new ParticipantQueryResponseEvt(payload);
    
            msg.msgTopic = KAFKA_OPERATOR_ERROR_TOPIC;

            await this._kafkaProducer.send(msg);

            return;
        }

        try {
            this._logger.info('_handleParticipantQueryResponseEvt -> start');
    
            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? ParticipantsPutTypeAndId : ParticipantsPutId, clonedHeaders);
            
            if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === '') {
                clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            }
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value)
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
            urlBuilder.setLocation([partyType, partyId, partySubType])

            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadParticipantPut(payload),
            });

            this._logger.info('_handleParticipantQueryResponseEvt -> end');
        } catch (error: unknown) {
            this._sendErrorFeedbackToFsp({ 
                error: error,
                headers: clonedHeaders,
                source: requesterFspId,
                endpoint: requestedEndpoint,
                entity: Enums.EntityTypeEnum.PARTICIPANTS,
                id: [partyType, partyId, partySubType],
            })
        }

        return;
    }

}
