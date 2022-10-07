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
import {AccountLookUperrorEvt} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Validate } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IParticipantService, ParticipantEndpoint } from "../interfaces/types";
import { PartiesPutTypeAndId, PartiesPutTypeAndIdAndSubId } from "../errors";

export class AccountLookupEventHandler {
    protected _kafkaConsumer: MLKafkaJsonConsumer;
    protected _logger:ILogger;
    protected _consumerOpts: MLKafkaJsonConsumerOptions;
    protected _kafkaTopics: string[];
    protected _producerOptions: MLKafkaJsonProducerOptions;
    protected _kafkaProducer: MLKafkaJsonProducer;
	protected _participantService: IParticipantService;

    constructor(
            logger: ILogger,
            consumerOpts: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        this._logger = logger;
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
            case AccountLookUperrorEvt.name:
                await this._handleAccountLookUpErrorReceivedEvt(message as AccountLookUperrorEvt);
                break;
            default:
                this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    private async _handleAccountLookUpErrorReceivedEvt(msg: AccountLookUperrorEvt):Promise<void>{
        const { validatePayload, payload, fspiopOpaqueState } = msg;
  
        const requesterFspId = payload.requesterFspId;
        const partyType = payload.partyType;
        const partyId = payload.partyId;
        const partySubType = payload.partySubType as string;
        const clonedHeaders = { ...fspiopOpaqueState as unknown as Request.FspiopHttpHeaders };

        const requestedEndpoint = await this._validateParticipantAndGetEndpoint(requesterFspId); 

        try {
            this._logger.info('_handleAccountLookUpErrorReceivedEvt -> start');

            // Always validate the payload and headers received
            validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);

            
            const template = partySubType ? Request.PARTIES_PUT_SUB_ID_ERROR(partyType, partyId, partySubType) : Request.PARTIES_PUT_ERROR(partyType, partyId);
           
            await Request.sendRequest({
                url: Request.buildEndpoint(requestedEndpoint.value, template), 
                headers: clonedHeaders, 
                source: requesterFspId, 
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: payload,
            });

            this._logger.info('_handleAccountLookUpErrorReceivedEvt -> end');

        } catch (err: unknown) {
            this._logger.error(err);
        }

        return;
    }

    protected async _validateParticipantAndGetEndpoint(requesterFspId: string):Promise<ParticipantEndpoint>{
        const requestedParticipant = await this._participantService.getParticipantInfo(requesterFspId);
    
        if(!requestedParticipant) {
            throw Error('Requesting Participant doesnt exist');
        }

        const requestedEndpoint = requestedParticipant.participantEndpoints.find(endpoint => endpoint.type === "FSPIOP");
                
        if(!requestedEndpoint) {
            throw Error('Requesting Participant Endpoint doesnt exist');
        }

        return requestedEndpoint;
    }

    

    async destroy () : Promise<void> {
        return this._kafkaConsumer.destroy(true);
    }
}
