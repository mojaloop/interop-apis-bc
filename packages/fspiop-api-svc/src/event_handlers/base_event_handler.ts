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
import {IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {ParticipantEndpoint, ParticipantsHttpClient } from "@mojaloop/participants-bc-client-lib";
import { IEventHandler } from "../interfaces/types";
import { IParticipantService } from "../interfaces/infrastructure";
import { IncomingHttpHeaders } from "http";
import { AccountLookUpErrorEvt, QuoteErrorEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { AxiosError } from "axios";
import { Constants, Request, Enums, Validate, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

export abstract class BaseEventHandler implements IEventHandler {
    protected _kafkaConsumer: MLKafkaJsonConsumer;
    protected _logger:ILogger;
    protected _consumerOpts: MLKafkaJsonConsumerOptions;
    protected _kafkaTopics: string[];
    protected _producerOptions: MLKafkaJsonProducerOptions;
    protected _kafkaProducer: MLKafkaJsonProducer;
    protected _participantService: IParticipantService;

    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        this._logger = logger.createChild(this.constructor.name);
        this._consumerOpts = consumerOptions;
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
        await this._kafkaProducer.connect();this._kafkaProducer;

    }

    protected async _validateParticipantAndGetEndpoint(fspId: string):Promise<ParticipantEndpoint | null>{
        try {
            const participant = await this._participantService.getParticipantInfo(fspId);

            if (!participant) {
                this._logger.error(`_validateParticipantAndGetEndpoint could not get participant with id: "${fspId}"`);
                return null;
            }

            const endpoint = participant.participantEndpoints.find(endpoint => endpoint.type==="FSPIOP");

            if (!endpoint) {
                this._logger.error(`_validateParticipantAndGetEndpoint could not get "FSPIOP" endpoint from participant with id: "${fspId}"`);
            }

            return endpoint || null;
        } catch(err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as unknown as any;
            
            this._logger.error(error.stack);
            return null;
        }
    }

    protected async _sendErrorFeedbackToFsp({
        error,
        headers,
        source,
        endpoint,
        entity,
        id,
    }: {
        error: unknown,
        headers: Request.FspiopHttpHeaders,
        source: string,
        endpoint: ParticipantEndpoint,
        entity: Enums.EntityTypeEnum,
        id: string[],
    }):Promise<void>{
        try {
            const err = error as unknown as AxiosError;
            this._logger.error(JSON.stringify(err.response?.data));
            
            const urlBuilder = new Request.URLBuilder(endpoint.value)
            urlBuilder.setEntity(entity);
            urlBuilder.setLocation(id);
            urlBuilder.hasError(true);
           
            await Request.sendRequest({
                url: urlBuilder.build(), 
                headers: headers, 
                source: source, 
                destination: headers[Constants.FSPIOP_HEADERS_DESTINATION] || null, 
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadError({
                    errorCode: Enums.ErrorCode.BAD_REQUEST,
                    errorDescription: JSON.stringify(err),
                })
            });
        } catch(err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as unknown as any;
            
            this._logger.error(error.stack);
        }
        
        return;
    }


    async destroy () : Promise<void> {
        await this._kafkaProducer.destroy();
        await this._kafkaConsumer.destroy(true);
    }
    
    abstract processMessage (sourceMessage: IMessage): Promise<void>

    abstract _handleErrorReceivedEvt(message: AccountLookUpErrorEvt | QuoteErrorEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>

}
