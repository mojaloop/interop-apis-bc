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

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IDomainMessage, IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, PartyInfoRequestedEvt} from "@mojaloop/platform-shared-lib-public-messages-lib/dist/index";
import { FSPIOP_HEADERS_SOURCE, FspEndpointTypes, FSPIOP_HEADERS_SWITCH, FSPIOP_HEADERS_DESTINATION, RestMethods } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { sendRequest } from "../request";
import { decodePayload } from "../request/transformer";

export type PutParty = {
    partyIdType: string;
    partyIdentifier: string;
    partySubType: string | null;
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
            case PartyInfoRequestedEvt.name:
                await this._handlePartyInfoRequestedEvt(message as PartyInfoRequestedEvt);
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

    private async _handlePartyInfoRequestedEvt(msg: PartyInfoRequestedEvt):Promise<void>{
        const { aggregateId, payload} = msg;
        const { partyType, partySubType } = payload;
        this._logger.info('putPartiesByTypeAndID -> start')
        const callbackEndpointType = partySubType ? FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT : FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT
      
        try {  
            let options: PutParty = {
                partyIdType: partyType,
                partyIdentifier: aggregateId,
                partySubType: partySubType
            }

            const decodedPayload = decodePayload(dataUri, { asParsed: false })
            await sendRequest(headers, destinationParticipant.data.name, callbackEndpointType, Enums.Http.RestMethods.PUT, decodedPayload.body.toString(), options)
            this._logger.info('putPartiesByTypeAndID -> end')
        } catch (err) {
            this._logger.error(err)
            // const errorCallbackEndpointType = partySubType ? FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR : FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR
            // await participant.sendErrorToParticipant
            // In our case, we send an error event
            
        }
        return;
    }

    async destroy () : Promise<void> {
        return this._kafkaConsumer.destroy(true)
    }
}
