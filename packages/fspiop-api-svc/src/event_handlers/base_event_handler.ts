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
import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { IParticipantEndpoint } from "@mojaloop/participants-bc-client-lib";
import { IEventHandler } from "../interfaces/types";
import { IParticipantService } from "../interfaces/infrastructure";
import { IncomingHttpHeaders } from "http";
import { AccountLookUpUnknownErrorEvent, QuotingBCInvalidIdErrorEvent, TransferErrorEvt, AccountLookUpBCOperatorErrorEvent, AccountLookUpBCOperatorErrorPayload, AccountLookupBCTopics, QuotingBCTopics, QuotingBCOperatorErrorPayload, QuotingBCOperatorErrorEvent } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { AccountLookupEventHandler } from "./account_lookup_evt_handler";
import { QuotingEventHandler } from "./quoting_evt_handler";

const KAFKA_ACCOUNT_LOOKUP_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || AccountLookupBCTopics.DomainErrors;
const KAFKA_QUOTING_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || QuotingBCTopics.DomainErrors;

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
        await this._kafkaProducer.connect();
    }

    protected async _validateParticipantAndGetEndpoint(fspId: string):Promise<IParticipantEndpoint|null>{
        try {
            const participant = await this._participantService.getParticipantInfo(fspId);

            if (!participant) {
                const errorMessage = `_validateParticipantAndGetEndpoint could not get participant with id: "${fspId}"`;

                this._logger.error(errorMessage);
                throw Error(errorMessage);
            }

            const endpoint = participant.participantEndpoints.find(endpoint => endpoint.type==="FSPIOP");

            if (!endpoint) {
                const errorMessage = `_validateParticipantAndGetEndpoint could not get "FSPIOP" endpoint from participant with id: "${fspId}"`;

                this._logger.error(errorMessage);
                throw Error(errorMessage);
            }

            return endpoint;
        }catch(error: unknown) {
            throw Error((error as Error).message);
        }
    }

    protected async _sendErrorFeedbackToFsp({
        message,
        error,
        headers,
        source,
        id,
        extensionList,
        errorCode
    }: {
        message?: IDomainMessage;
        error: unknown;
        headers: Request.FspiopHttpHeaders;
        source: string;
        id: string[];
        extensionList?: {
            key: string;
            value: string;
        }[];
        errorCode: string;
        entity?: Enums.EntityTypeEnum;
    }):Promise<void>{
        try {
            // This might be an AxiosError as well
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = error as unknown as any;
            this._logger.error(err.response?.data ? JSON.stringify(err.response?.data) : err.message);

            const requesterFspId = headers["fspiop-source"] as string;

            const endpoint = (await this._validateParticipantAndGetEndpoint(requesterFspId));

            if(!endpoint) {
                throw Error(`fspId ${requesterFspId} has no valid participant associated`);
            }

            const urlBuilder = new Request.URLBuilder(endpoint.value);
            
            urlBuilder.setLocation(id);
            urlBuilder.hasError(true);

            const header = message?.fspiopOpaqueState.headers.accept;
            switch(true) {
                case header.includes("participants"): {
                    urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
                    break;
                }
                case header.includes("parties"): {
                    urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
                    break;
                }
                case header.includes("quotes"): {
                    urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
                    break;
                }
                case header.includes("bulkQuotes"): {
                    urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
                    break;
                }
                default:
                    throw Error();
            }

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: headers,
                source: source,
                destination: headers[Constants.FSPIOP_HEADERS_DESTINATION] || null,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadError({
                    errorCode: errorCode,
                    errorDescription: err,
                    extensionList: (Array.isArray(extensionList) && extensionList.length > 0) ? {
                        extension: extensionList
                    } : null
                })
            });
        } catch(err: unknown) {
            const error = (err as Error).message;

            this._logger.error(error);
         
            
            
            switch(this.constructor.name) {
                case AccountLookupEventHandler.name: {
                    const payload:AccountLookUpBCOperatorErrorPayload = {
                        partyId: message?.payload.partyId,
                        partyType: message?.payload.partyId,
                        fspId: message?.payload.partyId,
                        partySubType: message?.payload.partyId,
                        errorDescription: error
                    };

                    const msg = new AccountLookUpBCOperatorErrorEvent(payload);
    
                    msg.msgTopic = KAFKA_ACCOUNT_LOOKUP_OPERATOR_ERROR_TOPIC;
        
                    await this._kafkaProducer.send(msg);
                    break;
                }
                // case QuotingEventHandler.name: {
                //     const payload:QuotingBCOperatorErrorPayload = {
                //         quoteId: message?.payload.quoteId,
                //         bulkQuoteId: message?.payload.bulkQuoteId,
                //         fspId: message?.payload.quoteId,
                //         errorDescription: error
                //     };

                //     const msg = new QuotingBCOperatorErrorEvent(payload);
    
                //     msg.msgTopic = KAFKA_QUOTING_OPERATOR_ERROR_TOPIC;
        
                //     await this._kafkaProducer.send(msg);
                //     break;
                // }
                default: {
                    this._logger.error(`not possible to send message ${message?.msgName} event untreated error to corresponding operator error topic`);
                    break;
                }
            }
        }

        return;
    }


    async destroy () : Promise<void> {
        await this._kafkaProducer.destroy();
        await this._kafkaConsumer.destroy(true);
    }

    abstract processMessage (sourceMessage: IMessage): Promise<void>

    abstract _handleErrorReceivedEvt(message: AccountLookUpUnknownErrorEvent | QuotingBCInvalidIdErrorEvent | TransferErrorEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>

}
