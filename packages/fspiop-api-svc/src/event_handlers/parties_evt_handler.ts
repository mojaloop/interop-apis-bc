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
import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {PartyInfoRequestedEvt, PartyQueryResponseEvt, AccountLookUperrorEvtPayload, AccountLookUperrorEvt} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { sendRequest, decodePayload, FSPIOP_HEADERS_SOURCE, FSPIOP_ENDPOINT_TYPES, FSPIOP_HEADERS_SWITCH, FSPIOP_HEADERS_DESTINATION, FSPIOP_REQUEST_METHODS, FSPIOP_PARTY_ACCOUNT_TYPES } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { IParticipantService } from "../interfaces/types";

export type PutParty = {
    partyIdType: string;
    partyIdentifier: string;
    partySubType: string | null;
}
export class PartiesEventHandler{
    private _kafkaConsumer: MLKafkaJsonConsumer;
    private _logger:ILogger;
    private _consumerOpts: MLKafkaJsonConsumerOptions;
    private _kafkaTopics: string[];
    private _producerOptions: MLKafkaJsonProducerOptions;
    private _kafkaProducer: MLKafkaJsonProducer;
	private _participantService: IParticipantService;

    constructor(
            logger: ILogger,
            consumerOpts: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        this._logger = logger.createChild("PartiesEventHandler");
        this._consumerOpts = consumerOpts;
        this._kafkaTopics = kafkaTopics;
        this._producerOptions = producerOptions;
        this._participantService = participantService;
    }

    async init () : Promise<void> {
        this._kafkaConsumer = new MLKafkaJsonConsumer(this._consumerOpts, this._logger);
        this._kafkaConsumer.setTopics(this._kafkaTopics);
        this._kafkaConsumer.setCallbackFn(this.processMessage.bind(this));
        this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);
        await this._kafkaConsumer.connect();
        await this._kafkaConsumer.start();
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const message: IDomainMessage = sourceMessage as IDomainMessage;

        switch(message.msgName){
            case ParticipantAssociationCreatedEvt.name:
                await this._handleParticipantAssociationRequestReceivedEvt(message as ParticipantAssociationCreatedEvt);
                break;
            case ParticipantAssociationRemovedEvt.name:
                await this._handleParticipantDisassociateRequestReceivedEvt(message as ParticipantAssociationRemovedEvt);
                break;
            case PartyInfoRequestedEvt.name:
                await this._handlePartyInfoRequestedEvt(message as PartyInfoRequestedEvt);
                break;
            case PartyQueryResponseEvt.name:
                await this._handlePartyQueryResponseEvtEvt(message as PartyQueryResponseEvt);
                break;
            default:
                this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    private async _handleParticipantAssociationRequestReceivedEvt(msg: ParticipantAssociationCreatedEvt):Promise<void>{
        const { validatePayload, payload, fspiopOpaqueState } = msg;
  
        // Always first validate the payload received
        validatePayload();
  
        const type = payload.partyType;
        const partySubType = payload.partySubType || undefined;
        const requesterName = payload.ownerFspId;
        const clonedHeaders = { ...fspiopOpaqueState as any };

        try {
            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> start');

            if (Object.values(FSPIOP_PARTY_ACCOUNT_TYPES).includes(type)) {
                const requestedParticipant = await this._participantService.getParticipantInfo(requesterName);
    
                if(!requestedParticipant) {
                    throw Error('Requesting Participant doesnt exist');
                }
               
                await sendRequest({
                    url: requestedParticipant.participantEndpoints, 
                    headers: clonedHeaders, 
                    source: requesterName, 
                    destination: clonedHeaders[FSPIOP_HEADERS_DESTINATION], 
                    method: FSPIOP_REQUEST_METHODS.PUT,
                    payload: payload,
                });

                this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> end');
            } else {
                throw Error('No valid party type');
            }
        } catch (err: any) {
            this._logger.error(err);
            
            const errorMsgPayload: AccountLookUperrorEvtPayload = {
                partyId: payload.partyId,
                errorMsg: err as string
            };
    
            const msg =  new AccountLookUperrorEvt(errorMsgPayload);
    
            await this._kafkaProducer.send(msg);
        }

        return;
    }
    
    private async _handleParticipantDisassociateRequestReceivedEvt(msg: ParticipantAssociationRemovedEvt):Promise<void>{
        const { validatePayload, payload, fspiopOpaqueState } = msg;
  
        // Always first validate the payload received
        validatePayload();
  
        const type = payload.partyType;
        const partySubType = payload.partySubType || undefined;
        const requesterName = payload.ownerFspId;
        const clonedHeaders = { ...fspiopOpaqueState as any };

        try {
            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> start');

            if (Object.values(FSPIOP_PARTY_ACCOUNT_TYPES).includes(type)) {
                const requestedParticipant = await this._participantService.getParticipantInfo(requesterName);
    
                if(!requestedParticipant) {
                    throw Error('Requesting Participant doesnt exist');
                }
               
                await sendRequest({
                    url: requestedParticipant.participantEndpoints, 
                    headers: clonedHeaders, 
                    source: requesterName, 
                    destination: clonedHeaders[FSPIOP_HEADERS_DESTINATION], 
                    method: FSPIOP_REQUEST_METHODS.PUT,
                    payload: payload,
                });

                this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> end');
            } else {
                throw Error('No valid party type');
            }
        } catch (err: any) {
            this._logger.error(err);
            
            const errorMsgPayload: AccountLookUperrorEvtPayload = {
                partyId: payload.partyId,
                errorMsg: err as string
            };
    
            const msg =  new AccountLookUperrorEvt(errorMsgPayload);
    
            await this._kafkaProducer.send(msg);
        }

        return;
    }

    private async _handlePartyInfoRequestedEvt(msg: PartyInfoRequestedEvt):Promise<void>{
        const { validatePayload, payload, fspiopOpaqueState } = msg;
  
        // Always first validate the payload received
        validatePayload();
  
        const type = payload.partyType;
        const partySubType = payload.partySubType || undefined;
        const requesterName = payload.requesterFspId;
        const destinationName = payload.destinationFspId;
        const clonedHeaders = { ...fspiopOpaqueState as any };
        
        try {
            this._logger.info('_handlePartyInfoRequestedEvt -> start');
            
            const requestedParticipant = await this._participantService.getParticipantInfo(requesterName);
    
            if(!requestedParticipant) {
                throw Error('Requesting Participant doesnt exist');
            }

            if (Object.values(FSPIOP_PARTY_ACCOUNT_TYPES).includes(type)) {
                if(fspiopOpaqueState) {
                    if (!clonedHeaders[FSPIOP_HEADERS_DESTINATION] || clonedHeaders[FSPIOP_HEADERS_DESTINATION] === '') {
                        clonedHeaders[FSPIOP_HEADERS_DESTINATION] = clonedHeaders[FSPIOP_HEADERS_SOURCE];
                    }

                    clonedHeaders[FSPIOP_HEADERS_SOURCE] = FSPIOP_HEADERS_SWITCH;
                }

                const requestedParticipant = await this._participantService.getParticipantInfo(requesterName);
    
                if(!requestedParticipant) {
                    throw Error('Requesting Participant doesnt exist');
                }
               
                await sendRequest({
                    url: requestedParticipant.participantEndpoints, 
                    headers: clonedHeaders, 
                    source: requesterName, 
                    destination: destinationName, 
                    method: FSPIOP_REQUEST_METHODS.GET,
                    payload: payload,
                });

                this._logger.info('_handlePartyInfoRequestedEvt -> end');
            } else {
                throw Error('No valid party type');
            }
        } catch (err: any) {
            this._logger.error(err);
        }

        return;
    }

    private async _handlePartyQueryResponseEvtEvt(msg: PartyQueryResponseEvt):Promise<void>{
        const { validatePayload, payload, fspiopOpaqueState } = msg;
  
        // Always first validate the payload received
        validatePayload();
  
        const type = payload.partyType;
        const requesterName = payload.requesterFspId;
        const clonedHeaders = { ...fspiopOpaqueState as any };
        
        try {
            this._logger.info('_handlePartyQueryResponseEvtEvt -> start');
            
            const requestedParticipant = await this._participantService.getParticipantInfo(requesterName);
    
            if(!requestedParticipant) {
                throw Error('Requesting Participant doesnt exist');
            }

            if (Object.values(FSPIOP_PARTY_ACCOUNT_TYPES).includes(type)) {
                if(fspiopOpaqueState) {
                    if (!clonedHeaders[FSPIOP_HEADERS_DESTINATION] || clonedHeaders[FSPIOP_HEADERS_DESTINATION] === '') {
                        clonedHeaders[FSPIOP_HEADERS_DESTINATION] = clonedHeaders[FSPIOP_HEADERS_SOURCE];
                    }

                    clonedHeaders[FSPIOP_HEADERS_SOURCE] = FSPIOP_HEADERS_SWITCH;
                }

                const requestedParticipant = await this._participantService.getParticipantInfo(requesterName);
    
                if(!requestedParticipant) {
                    throw Error('Requesting Participant doesnt exist');
                }
               
                await sendRequest({
                    url: requestedParticipant.participantEndpoints, 
                    headers: clonedHeaders, 
                    source: requesterName, 
                    method: FSPIOP_REQUEST_METHODS.PUT,
                    payload: payload,
                });

                this._logger.info('_handlePartyQueryResponseEvtEvt -> end');
            } else {
                throw Error('No valid party type');
            }
        } catch (err: any) {
            this._logger.error(err);
        }

        return;
    }

    async destroy () : Promise<void> {
        return this._kafkaConsumer.destroy(true);
    }
}
