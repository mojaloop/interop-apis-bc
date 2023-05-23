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
import { IncomingHttpHeaders } from "http";
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
    Transfers: 'TransfersEventHandler',
    AccountLookUp: 'AccountLookUpEventHandler',
    Quotes: 'QuotesEventHandler',
} as const;

export abstract class BaseEventHandler implements IEventHandler {
    protected _kafkaConsumer: MLKafkaJsonConsumer;
    protected _logger:ILogger;
    protected _consumerOpts: MLKafkaJsonConsumerOptions;
    protected _kafkaTopics: string[];
    protected _producerOptions: MLKafkaJsonProducerOptions;
    protected _kafkaProducer: MLKafkaJsonProducer;
    protected _participantService: IParticipantService;
    protected _handlerName: string;

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
        // try {
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
        // }catch(error: unknown) {
        //     throw Error((error as Error).message);
        // }
    }

    protected async _sendErrorFeedbackToFsp({
        message,
        error,
        headers,
        source,
        id,
        extensionList,
        errorCode,
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
            // this._logger.error(err.response?.data ? JSON.stringify(err.response?.data) : err.message);

            const endpoint = (await this._validateParticipantAndGetEndpoint(source));

            if(!endpoint) {
                throw Error(`fspId ${source} has no valid participant associated`);
            }

            const url = this.buildFspFeedbackUrl(endpoint, id, message);

            await Request.sendRequest({
                url: url,
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

            await this.handleErrorEventForFspFeedbackFailure(message, error).catch((err: unknown) => {
                this._logger.error(`handleErrorEventForFspFeedbackFailure failed with error: ${err}`);
            });
        }

        return;
    }


    private async handleErrorEventForFspFeedbackFailure(message: IDomainMessage | undefined, error: string):Promise<void> {
        let messageToSend: IDomainMessage | undefined;
        switch (this._handlerName) {
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
                    fspId: message?.payload.transferId,
                    errorDescription: error
                };

                messageToSend = new TransfersBCOperatorErrorEvent(payload);
                break;
            }
            default: {
                const errorMessage = `Not possible to send message ${message?.msgName} event untreated error to corresponding operator error topic`;
                this._logger.error(errorMessage);
                throw new Error(errorMessage);
            }

        }

        this._logger.info(`Sending ${messageToSend?.msgName} event `);
        await this._kafkaProducer.send(messageToSend);

    }

    private buildFspFeedbackUrl(endpoint: IParticipantEndpoint, id: string[], message: IDomainMessage | undefined): string {
        const urlBuilder = new Request.URLBuilder(endpoint.value);

        urlBuilder.setLocation(id);
        urlBuilder.hasError(true);

        const header = message?.fspiopOpaqueState.headers["content-type"];
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
        await this._kafkaProducer.destroy();
        await this._kafkaConsumer.destroy(true);
    }

    abstract processMessage (sourceMessage: IMessage): Promise<void>

    abstract _handleErrorReceivedEvt(message: IMessage, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>

}
