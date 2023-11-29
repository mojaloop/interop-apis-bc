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
import { IParticipantService } from "../interfaces/infrastructure";
import {
    AccountLookUpBCOperatorErrorEvent,
    AccountLookUpBCOperatorErrorPayload,
    QuoteBCOperatorErrorPayload,
    QuoteBCOperatorErrorEvent,
    TransfersBCOperatorErrorPayload,
    TransfersBCOperatorErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Transformer, JwsConfig, FspiopJwsSignature } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

export const HandlerNames = {
    AccountLookUp: 'AccountLookUpEventHandler',
    Quotes: 'QuotesEventHandler',
    Transfers: 'TransfersEventHandler',
} as const;

export abstract class BaseEventHandler  {
    protected readonly _logger:ILogger;
    protected readonly _consumerOpts: MLKafkaJsonConsumerOptions;
    protected readonly _kafkaTopics: string[];
    protected readonly _producerOptions: MLKafkaJsonProducerOptions;
    protected readonly _participantService: IParticipantService;
    protected readonly _kafkaConsumer: MLKafkaJsonConsumer;
    protected readonly _kafkaProducer: MLKafkaJsonProducer;
    protected readonly _handlerName: string;
    protected readonly _jwsHelper: FspiopJwsSignature;

    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService,
            handlerName: string,
            jwsHelper: FspiopJwsSignature,
    ) {
        this._logger = logger.createChild(this.constructor.name);
        this._consumerOpts = consumerOptions;
        this._kafkaTopics = kafkaTopics;
        this._producerOptions = producerOptions;
        this._participantService = participantService;
        this._handlerName = handlerName;
        this._kafkaConsumer = new MLKafkaJsonConsumer(this._consumerOpts, this._logger);
        this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);
        this._jwsHelper = jwsHelper;
    }

    async init () : Promise<void> {
        this._logger.info("Event handler starting...");
        try{
            this._kafkaConsumer.setTopics(this._kafkaTopics);
            this._kafkaConsumer.setCallbackFn(this.processMessage.bind(this));
            await this._kafkaConsumer.connect();
            await this._kafkaConsumer.startAndWaitForRebalance();
            await this._kafkaProducer.connect();

            this._logger.info("Event handler started.");
        }
        catch(error: unknown) {
            this._logger.error(`Error initializing ${this._handlerName} handler: ${(error as Error).message}`);
            throw new Error(`Error initializing ${this._handlerName}`);
        }

    }

    protected async _validateParticipantAndGetEndpoint(fspId: string):Promise<IParticipantEndpoint>{
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
    }

    protected async _sendErrorFeedbackToFsp({
        message,
        headers,
        id,
        errorResponse
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
    }):Promise<void>{
        // We always have a sourceFsp to send info to, depending on the stage of the
        // event when the error occurred it should also deliver to the destination
        const fspIds = [errorResponse.sourceFspId];

        if(errorResponse.destinationFspId) {
            fspIds.push(errorResponse.destinationFspId);
        }

        for(const fspId of fspIds ) {
            try {

                const endpoint = await this._validateParticipantAndGetEndpoint(fspId);

                if(!endpoint) {
                    throw Error(`fspId ${fspId} has no valid participant associated`);
                }

                const url = this.buildFspFeedbackUrl(endpoint, id, message);
                const clonedHeaders = { ...headers };

                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = headers[Constants.FSPIOP_HEADERS_SOURCE];
                }

                const transformedPayload = Transformer.transformPayloadError({
                    errorCode: errorResponse.errorCode,
                    errorDescription: errorResponse.errorDescription,
                    extensionList: message.payload.errorInformation ? message.payload.errorInformation.extensionList : null
                });

                clonedHeaders[Constants.FSPIOP_HEADERS_HTTP_METHOD] = Enums.FspiopRequestMethodsEnum.PUT;
                clonedHeaders[Constants.FSPIOP_HEADERS_SIGNATURE] = this._jwsHelper.sign(clonedHeaders, transformedPayload);

                await Request.sendRequest({
                    url: url,
                    headers: clonedHeaders,
                    source: fspId,
                    destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null,
                    method: Enums.FspiopRequestMethodsEnum.PUT,
                    payload: transformedPayload
                });

            } catch(err: unknown) {
                const error = (err as Error).message;

                this._logger.error(error);

                await this.handleErrorEventForFspFeedbackFailure(message, error).catch((err: unknown) => {
                    this._logger.error(`handleErrorEventForFspFeedbackFailure failed with error: ${err}`);
                });
            }
        }
        return;
    }


    private async handleErrorEventForFspFeedbackFailure(message: IDomainMessage | undefined, error: string):Promise<void> {
        let messageToSend: IDomainMessage | undefined;
        switch (this._handlerName) { // TODO change this string to this.constructor.name or instanceOf
            case HandlerNames.AccountLookUp: {
                const payload: AccountLookUpBCOperatorErrorPayload = {
                    fspId: message?.payload.fspId,
                    partyId: message?.payload.partyId,
                    partyType: message?.payload.partyType,
                    currency: message?.payload.currency,
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
                this._logger.error(errorMessage);
                throw new Error(errorMessage);
            }

        }

        this._logger.info(`Sending ${messageToSend?.msgName} event `);
        await this._kafkaProducer.send(messageToSend);

    }

    private buildFspFeedbackUrl(endpoint: IParticipantEndpoint, id: string[], message: IDomainMessage | undefined): string {
        const header = message?.fspiopOpaqueState.headers["content-type"];
        const urlBuilder = new Request.URLBuilder(endpoint.value);

        urlBuilder.setLocation(id);
        urlBuilder.hasError(true);

        switch (true) {
            case header && header.includes("participants"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
                break;
            }
            case header && header.includes("parties"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
                break;
            }
            case header && header.includes("quotes"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.QUOTES);
                break;
            }
            case header && header.includes("bulkQuotes"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_QUOTES);
                break;
            }
            case header && header.includes("transfers"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
                break;
            }
            case header && header.includes("bulkTransfers"): {
                urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
                break;
            }
            default:
                throw Error("Invalid content type, must be one of participants, parties, quotes, bulkQuotes transfers or bulkTransfers");
        }

        return urlBuilder.build();
    }

    async destroy () : Promise<void> {
        await this._kafkaProducer.destroy();
        await this._kafkaConsumer.destroy(true);
    }

    abstract processMessage (sourceMessage: IMessage): Promise<void>

    abstract _handleErrorReceivedEvt(message: IMessage, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>

}
