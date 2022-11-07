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
    AccountLookUperrorEvt,
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
import { FspiopError } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";

export class AccountLookupEventHandler extends BaseEventHandler {
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
            case AccountLookUperrorEvt.name:
                await this._handleErrorReceivedEvt(new AccountLookUperrorEvt(message.payload), message.fspiopOpaqueState);
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

    async _handleErrorReceivedEvt(message: AccountLookUperrorEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.requesterFspId;
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = null;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleAccountLookUpErrorReceivedEvt()");

            return;
        }

        try {
            this._logger.info('_handleErrorReceivedEvt -> start');


            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            let template;
            switch(message.payload.sourceEvent){
                case PartyQueryReceivedEvt.name:
                case PartyInfoAvailableEvt.name:
                case PartyInfoRequestedEvt.name:
                    template = Request.buildRequestUrl({
                        entity: Enums.EntityTypeEnum.PARTIES,
                        partyType, 
                        partyId, 
                        partySubType,
                        error: true
                    });
                    break;
                case ParticipantAssociationRequestReceivedEvt.name:
                case ParticipantDisassociateRequestReceivedEvt.name:
                case ParticipantQueryReceivedEvt.name:
                    template = Request.buildRequestUrl({
                        entity: Enums.EntityTypeEnum.PARTICIPANTS,
                        partyType, 
                        partyId, 
                        partySubType,
                        error: true
                    });
                    break;
                default:
                    throw new Error("Unhandled message source event on AccountLookupEventHandler_handleAccountLookUpErrorReceivedEvt()");
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

    private async _handleParticipantAssociationRequestReceivedEvt(message: ParticipantAssociationCreatedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        const { payload } = message;
  
        const requesterFspId = payload.ownerFspId;
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId);

        if(!requestedEndpoint){
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleParticipantAssociationRequestReceivedEvt()");

            return;
        }

        try {
            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);

            
            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTIES,
                partyType, 
                partyId, 
                partySubType,
                error: true
            });

            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: requesterFspId, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyAssociationPut(payload),
            });

            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> end');

        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));
            
            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTIES,
                partyType, 
                partyId, 
                partySubType,
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
                    errorDescription: err as string,
                })
            });
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
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleParticipantDisassociateRequestReceivedEvt()");

            return;
        }

        try {
            this._logger.info('_handleParticipantDisassociateRequestReceivedEvt -> start');

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTIES,
                partyType, 
                partyId, 
                partySubType,
            });

            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: requesterFspId, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyDisassociationPut(payload),
            });

            this._logger.info('_handleParticipantDisassociateRequestReceivedEvt -> end');

        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));
            
            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTIES,
                partyType, 
                partyId, 
                partySubType,
                error: true
            });
           
            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: error.response?.data as FspiopError,
            });
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
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get destinationEndpoint at _handlePartyInfoRequestedEvt()");

            return;
        }

        try {
            this._logger.info('_handlePartyInfoRequestedEvt -> start');
            
            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);
            

            // if (Object.values(Constants.FSPIOP_PARTY_ACCOUNT_TYPES).includes(partyType)) {
                if(fspiopOpaqueState) {
                    if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === '') {
                        clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
                    }

                    clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
                }

                const template = Request.buildRequestUrl({
                    entity: Enums.EntityTypeEnum.PARTIES,
                    partyType, 
                    partyId, 
                    partySubType,
                });

                await Request.sendRequest({
                    url: Request.buildEndpoint(destinationEndpoint.value, template),
                    headers: clonedHeaders, 
                    source: requesterFspId, 
                    destination: destinationFspId,
                    method: Enums.FspiopRequestMethodsEnum.GET,
                    payload: Transformer.transformPayloadPartyInfoRequestedPut(payload),
                });

                this._logger.info('_handlePartyInfoRequestedEvt -> end');
            // } else {
            //     throw Error('No valid party type');
            // }
        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));

            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTIES,
                partyType, 
                partyId, 
                partySubType,
                error: true
            });
           
            await Request.sendRequest({
                url: Request.buildEndpoint(destinationEndpoint.value, template),
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: error.response?.data as FspiopError,
            });
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
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            return;
        }

        const destinationEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

        if(!destinationEndpoint){
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get destinationEndpoint at _handlePartyQueryResponseEvt()");
            return;
        }

        try {
            this._logger.info('_handlePartyQueryResponseEvt -> start');
            
            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            // if (Object.values(Constants.FSPIOP_PARTY_ACCOUNT_TYPES).includes(partyType)) {
                if(fspiopOpaqueState) {
                    if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === '') {
                        clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
                    }

                    clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;
                }
                
                const template = Request.buildRequestUrl({
                    entity: Enums.EntityTypeEnum.PARTIES,
                    partyType, 
                    partyId, 
                    partySubType,
                });

                await Request.sendRequest({
                    url: Request.buildEndpoint(destinationEndpoint.value, template),
                    headers: clonedHeaders, 
                    source: requesterFspId, 
                    destination: destinationFspId,
                    method: Enums.FspiopRequestMethodsEnum.PUT,
                    payload: Transformer.transformPayloadPartyInfoReceivedPut(payload),
                });

                this._logger.info('_handlePartyQueryResponseEvt -> end');
            // } else {
            //     throw Error('Party type is incorrect');
            // }
        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));

            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTIES,
                partyType, 
                partyId, 
                partySubType,
                error: true
            });
           
            await Request.sendRequest({
                url: Request.buildEndpoint(destinationEndpoint.value, template),
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: error.response?.data as FspiopError,
            });
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
            // TODO this must send an error that can be forwarded to the operator - to a special topic
            // _validateParticipantAndGetEndpoint already logs the error
            this._logger.error("Cannot get requestedEndpoint at _handleParticipantQueryResponseEvt()");
            return;
        }

        try {
            this._logger.info('_handleParticipantQueryResponseEvt -> start');
    
            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? ParticipantsPutTypeAndId : ParticipantsPutId, clonedHeaders);
            
            // if (Object.values(Constants.FSPIOP_PARTY_ACCOUNT_TYPES).includes(partyType)) {
                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === '') {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
                }
                clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

                const template = Request.buildRequestUrl({
                    entity: Enums.EntityTypeEnum.PARTICIPANTS,
                    partyType, 
                    partyId, 
                    partySubType
                });

                await Request.sendRequest({
                    url: Request.buildEndpoint(requestedEndpoint.value, template), 
                    headers: clonedHeaders, 
                    source: requesterFspId, 
                    destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                    method: Enums.FspiopRequestMethodsEnum.PUT,
                    payload: Transformer.transformPayloadParticipantPut(payload),
                });

                this._logger.info('_handleParticipantQueryResponseEvt -> end');
            // } else {
            //     throw Error('No valid party type');
            // }
        } catch (err: unknown) {
            const error = err as unknown as AxiosError;
            this._logger.error(JSON.stringify(error.response?.data));

            const template = Request.buildRequestUrl({
                entity: Enums.EntityTypeEnum.PARTICIPANTS,
                partyType, 
                partyId, 
                partySubType,
                error: true
            });

            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: error.response?.data as FspiopError,            
            });
        }

        return;
    }

}
