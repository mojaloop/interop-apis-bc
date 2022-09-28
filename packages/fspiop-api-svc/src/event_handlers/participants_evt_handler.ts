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

"use strict"

import { FSPIOP_HEADERS_SOURCE, FspEndpointTypes, FSPIOP_HEADERS_SWITCH, FSPIOP_HEADERS_DESTINATION, RestMethods } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IDomainMessage, IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, ParticipantQueryReceivedEvtPayload, ParticipantQueryResponseEvt, PartyInfoRequestedEvt} from "@mojaloop/platform-shared-lib-public-messages-lib/dist/index";
import axios from "axios";

export enum AccountLookUpEventsType  {
    GetParticipant = "[Account Lookup] Get Participant",
    GetParty = "[Account Lookup] Get Party",
    AssociateParty = "[Account Lookup] Associate Party",
    DisassociateParty = "[Account Lookup] Disassociate Party",
}

export class ParticipantsEventHandler{
    private _kafkaConsumer: MLKafkaJsonConsumer;
    private _logger:ILogger;
    private _consumerOpts: MLKafkaJsonConsumerOptions;
    private _kafkaTopics: string[];

    constructor(
            logger: ILogger,
            consumerOpts: MLKafkaJsonConsumerOptions,
            kafkaTopics : string[]
    ) {
        this._logger = logger.createChild("ParticipantsEventHandler");
        this._consumerOpts = consumerOpts;
        this._kafkaTopics = kafkaTopics;
    }

    async init () : Promise<void> {
        this._kafkaConsumer = new MLKafkaJsonConsumer(this._consumerOpts, this._logger);
        this._kafkaConsumer.setTopics(this._kafkaTopics);
        this._kafkaConsumer.setCallbackFn(this.processMessage.bind(this));
        await this._kafkaConsumer.connect();
        await this._kafkaConsumer.start();
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const message: IDomainMessage = sourceMessage as IDomainMessage;

        switch(message.msgName){
            case ParticipantAssociationRequestReceivedEvt.name:
                await this._handleParticipantAssociationRequestReceivedEvt(message as ParticipantAssociationRequestReceivedEvt);
                break;
            case ParticipantDisassociateRequestReceivedEvt.name:
                await this._handleParticipantDisassociateRequestReceivedEvt(message as ParticipantDisassociateRequestReceivedEvt);
                break;
            case ParticipantQueryResponseEvt.name:
                await this._handleParticipantQueryResponseEvt(message as ParticipantQueryResponseEvt);
                break;
            default:
                this._logger.warn(`Cannot handl message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    private async _handleParticipantAssociationRequestReceivedEvt(msg: ParticipantAssociationRequestReceivedEvt):Promise<void>{
        return;
    }
    
    private async _handleParticipantDisassociateRequestReceivedEvt(msg: ParticipantDisassociateRequestReceivedEvt):Promise<void>{
        return;
    }

    private async _handleParticipantQueryResponseEvt(
        msg: ParticipantQueryResponseEvt & { 
            headers: any, 
            value: {
                type:AccountLookUpEventsType,
                payload: ParticipantQueryReceivedEvtPayload
            } 
        }
    ):Promise<void>{
        const { headers, value } = msg;
        const type = value.type;
        const partySubIdOrType = value.payload.partySubType || undefined
        const requesterName = headers[FSPIOP_HEADERS_SOURCE]
        const callbackEndpointType = partySubIdOrType ? FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT : FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTICIPANT_PUT
        const errorCallbackEndpointType = partySubIdOrType ? FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR : FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR
        let fspiopError
        try {
            this._logger.info('_handleParticipantQueryResponseEvt -> start')

              const clonedHeaders = { ...headers }
              if (!clonedHeaders[FSPIOP_HEADERS_DESTINATION] || clonedHeaders[FSPIOP_HEADERS_DESTINATION] === '') {
                clonedHeaders[FSPIOP_HEADERS_DESTINATION] = clonedHeaders[FSPIOP_HEADERS_SOURCE]
              }
              clonedHeaders[FSPIOP_HEADERS_SOURCE] = FSPIOP_HEADERS_SWITCH
              await this.sendRequest(clonedHeaders, requesterName, callbackEndpointType, RestMethods.PUT, payload, options)
            
            if(!value) {

              await this.sendError(requesterName, errorCallbackEndpointType,
                this.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND));
            }
            this._logger.info('_handleParticipantQueryResponseEvt -> end')
        //   } else {
        //     this._logger.error('Requester FSP not found')
        //     throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND, 'Requester FSP not found')
        //   }
        } catch (err: any) {
          this._logger.error(err);
          fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err, ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR)
          try {
            const errorCallbackEndpointType = partySubIdOrType ? FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR : FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR
            await this.sendError(
              headers[FSPIOP_HEADERS_SOURCE], errorCallbackEndpointType,
              fspiopError.toApiErrorObject(Config.ERROR_HANDLING), headers, params, childSpan)
          } catch (exc) {
            fspiopError = ErrorHandler.Factory.reformatFSPIOPError(exc)
            // We can't do anything else here- we _must_ handle all errors _within_ this function because
            // we've already sent a sync response- we cannot throw.
            this._logger.error(exc)
          }
          
        }
        return;
    }

    private async sendRequest(msg: PartyInfoRequestedEvt):Promise<void>{
      const { data } = await axios.put<PartyInfoRequestedEvtResponse>(
        msg.url,
        { },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      return data;
    }


    private async _handlePartyInfoRequestedEvt(msg: PartyInfoRequestedEvt):Promise<void>{
        return;
    }

    async destroy () : Promise<void> {
        return this._kafkaConsumer.destroy(true)
    }
}
