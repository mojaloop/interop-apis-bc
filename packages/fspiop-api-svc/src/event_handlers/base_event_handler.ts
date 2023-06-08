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

import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IDomainMessage, IMessage } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { IParticipantEndpoint } from "@mojaloop/participants-bc-client-lib";
import { IEventHandler } from "../interfaces/types";
import { IParticipantService } from "../interfaces/infrastructure";
import {
    AccountLookUpBCOperatorErrorEvent,
    AccountLookUpBCOperatorErrorPayload,
    QuoteBCOperatorErrorPayload,
    QuoteBCOperatorErrorEvent,
    TransfersBCOperatorErrorPayload,
    TransfersBCOperatorErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

export const HandlerNames = {
    AccountLookUp: 'AccountLookUpEventHandler',
    Quotes: 'QuotesEventHandler',
    Transfers: 'TransfersEventHandler',
} as const;

export abstract class BaseEventHandler implements IEventHandler {
    protected readonly logger:ILogger;
    protected readonly consumerOpts: MLKafkaJsonConsumerOptions;
    protected readonly kafkaTopics: string[];
    protected readonly producerOptions: MLKafkaJsonProducerOptions;
    protected readonly participantService: IParticipantService;
    protected readonly kafkaConsumer: MLKafkaJsonConsumer;
    protected readonly kafkaProducer: MLKafkaJsonProducer;
    protected readonly handlerName: string;

    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService,
            handlerName: string
    ) {
        this.logger = logger.createChild(this.constructor.name);
        this.consumerOpts = consumerOptions;
        this.kafkaTopics = kafkaTopics;
        this.producerOptions = producerOptions;
        this.participantService = participantService;
        this.handlerName = handlerName;
        this.kafkaConsumer = new MLKafkaJsonConsumer(this.consumerOpts, this.logger);
        this.kafkaProducer = new MLKafkaJsonProducer(this.producerOptions);
    }

    async init () : Promise<void> {
        try{
            this.kafkaConsumer.setTopics(this.kafkaTopics);
            this.kafkaConsumer.setCallbackFn(this.processMessage.bind(this));
            await this.kafkaConsumer.connect();
            await this.kafkaConsumer.start();
            await this.kafkaProducer.connect();
        }
        catch(error: unknown) {
            this.logger.error(`Error initializing ${this.handlerName} handler: ${(error as Error).message}`);
            throw new Error(`Error initializing ${this.handlerName}`);
        }

    }

    protected async _validateParticipantAndGetEndpoint(fspId: string):Promise<IParticipantEndpoint|null>{
        const participant = await this.participantService.getParticipantInfo(fspId);

        if (!participant) {
            const errorMessage = `_validateParticipantAndGetEndpoint could not get participant with id: "${fspId}"`;

            this.logger.error(errorMessage);
            throw Error(errorMessage);
        }

        const endpoint = participant.participantEndpoints.find(endpoint => endpoint.type==="FSPIOP");

        if (!endpoint) {
            const errorMessage = `_validateParticipantAndGetEndpoint could not get "FSPIOP" endpoint from participant with id: "${fspId}"`;

            this.logger.error(errorMessage);
            throw Error(errorMessage);
        }

        return endpoint;
    }

    protected async _sendErrorFeedbackToFsp({
        message,
        headers,
        id,
        errorResponse,
        extensionList = []
    }: {
        message: IDomainMessage;
        headers: Request.FspiopHttpHeaders;
        id: string[];
        errorResponse: {
            errorCode: string;
            errorDescription: string;
            sourceFspId : string;
            destinationFspId: string | null;
        };
        extensionList?: {
            key: string;
            value: string;
        }[]
    }):Promise<void>{
        // We always have a sourceFsp to send info to, depending on the stage of the 
        // event when the error occurred it should also deliver to the destination
        const fspIds = [errorResponse.sourceFspId];
        
        if(errorResponse.destinationFspId) {
            fspIds.push(errorResponse.destinationFspId);
        }

        for(const fspId of fspIds ) {
            try {
                const endpoint = (await this._validateParticipantAndGetEndpoint(fspId));

                if(!endpoint) {
                    throw Error(`fspId ${fspId} has no valid participant associated`);
                }

                const url = this.buildFspFeedbackUrl(endpoint, id, message);

                // Build the extension list with all the available
                // non-null fields from the message payload
                for (const [key, value] of Object.entries(message.payload)) {
                    if(value) {
                        extensionList.push({
                            key: key,
                            value: value as string
                        });
                    }
                }

          
                await Request.sendRequest({
                    url: url,
                    headers: headers,
                    source: fspId,
                    destination: headers[Constants.FSPIOP_HEADERS_DESTINATION] || null,
                    method: Enums.FspiopRequestMethodsEnum.PUT,
                    payload: Transformer.transformPayloadError({
                        errorCode: errorResponse.errorCode,
                        errorDescription: errorResponse.errorDescription,
                        extensionList: extensionList.length > 0 ? {
                            extension: extensionList
                        } : null
                    })
                });
                
            } catch(err: unknown) {
                const error = (err as Error).message;

                this.logger.error(error);

                await this.handleErrorEventForFspFeedbackFailure(message, error).catch((err: unknown) => {
                    this.logger.error(`handleErrorEventForFspFeedbackFailure failed with error: ${err}`);
                });
            }
        }
        return;
    }


    private async handleErrorEventForFspFeedbackFailure(message: IDomainMessage | undefined, error: string):Promise<void> {
        let messageToSend: IDomainMessage | undefined;
        switch (this.handlerName) {
            case HandlerNames.AccountLookUp: {
                const payload: AccountLookUpBCOperatorErrorPayload = {
                    partyId: message?.payload.partyId,
                    partyType: message?.payload.partyId,
                    fspId: message?.payload.partyId,
                    partySubType: message?.payload.partyId,
                    errorDescription: error
                };

                messageToSend = new AccountLookUpBCOperatorErrorEvent(payload);
                break;
            }
            case HandlerNames.Quotes: {
                const payload: QuoteBCOperatorErrorPayload = {
                    quoteId: message?.payload.quoteId,
                    bulkQuoteId: message?.payload.bulkQuoteId,
                    fspId: message?.payload.quoteId,
                    errorDescription: error
                };

                messageToSend = new QuoteBCOperatorErrorEvent(payload);
                break;
            }
            case HandlerNames.Transfers: {
                const payload: TransfersBCOperatorErrorPayload = {
                    transferId: message?.payload.transferId,
                    payerFspId: message?.payload.payerFspId,
                    errorDescription: error
                };

                messageToSend = new TransfersBCOperatorErrorEvent(payload);
                break;
            }
            default: {
                const errorMessage = `Not possible to send message ${message?.msgName} event untreated error to corresponding operator error topic`;
                this.logger.error(errorMessage);
                throw new Error(errorMessage); 
            }

        }

        this.logger.info(`Sending ${messageToSend?.msgName} event `);
        await this.kafkaProducer.send(messageToSend);

    }

    private buildFspFeedbackUrl(endpoint: IParticipantEndpoint, id: string[], message: IDomainMessage | undefined): string {
        const header = message?.fspiopOpaqueState.headers["content-type"];
        const urlBuilder = new Request.URLBuilder(endpoint.value);

        urlBuilder.setLocation(id);
        urlBuilder.hasError(true);

        switch (true) {
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
            case header.includes("transfers"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
                break;
            }
            default:
                throw Error("Invalid content type, must be one of participants, parties, quotes, bulkQuotes or transfers");
        }

        return urlBuilder.build();
    }

    async destroy () : Promise<void> {
        await this.kafkaProducer.destroy();
        await this.kafkaConsumer.destroy(true);
    }

    abstract processMessage (sourceMessage: IMessage): Promise<void>

    abstract _handleErrorReceivedEvt(message: IMessage, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>

}
