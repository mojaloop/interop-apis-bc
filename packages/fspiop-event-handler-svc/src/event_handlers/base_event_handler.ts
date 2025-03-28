/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

* Arg Software
- José Antunes <jose.antunes@arg.software>
- Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {IDomainMessage, IMessage, IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
    MLKafkaJsonConsumer,
    MLKafkaJsonConsumerOptions,
    MLKafkaJsonProducer,
    MLKafkaJsonProducerOptions
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
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
import {
    Constants,
    Request,
    Enums,
    FspiopTransformer,
    FspiopJwsSignature
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {IHistogram, IMetrics, SpanStatusCode, Tracer} from "@mojaloop/platform-shared-lib-observability-types-lib";
import { OpenTelemetryClient } from "@mojaloop/platform-shared-lib-observability-client-lib";
import {SpanKind, SpanOptions} from "@opentelemetry/api";
import * as OpentelemetryApi from "@opentelemetry/api";
import {FspiopRequestMethodsEnum, ResponseTypeEnum} from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/enums";
import {
    FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
    FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";


export const HandlerNames = {
    AccountLookUp: "AccountLookUpEventHandler",
    Quotes: "QuotesEventHandler",
    Transfers: "TransfersEventHandler",
} as const;

export abstract class BaseEventHandler  {
    protected readonly _logger:ILogger;
    protected readonly _consumerOpts: MLKafkaJsonConsumerOptions;
    protected readonly _kafkaTopics: string[];
    protected readonly _producerOptions: MLKafkaJsonProducerOptions;
    protected readonly _participantService: IParticipantService;
    protected readonly _kafkaConsumer: MLKafkaJsonConsumer;
    protected readonly _kafkaProducer: IMessageProducer;
    protected readonly _handlerName: string;
    protected readonly _jwsHelper: FspiopJwsSignature;
    protected readonly _metrics: IMetrics;
    protected readonly _histogram: IHistogram;
    protected readonly _tracer: Tracer;

    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producer: IMessageProducer,
            kafkaTopics : string[],
            participantService: IParticipantService,
            handlerName: string,
            jwsHelper: FspiopJwsSignature,
            metrics: IMetrics
    ) {
        this._logger = logger.createChild(this.constructor.name);
        this._consumerOpts = consumerOptions;
        this._kafkaTopics = kafkaTopics;
        this._kafkaProducer = producer;
        this._participantService = participantService;
        this._handlerName = handlerName;
        this._kafkaConsumer = new MLKafkaJsonConsumer(this._consumerOpts, this._logger);
        //this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);
        this._jwsHelper = jwsHelper;

        this._metrics = metrics;
        this._histogram = metrics.getHistogram(this.constructor.name, `${this.constructor.name} metrics`, ["callName", "success"]);
        this._tracer = OpenTelemetryClient.getInstance().trace.getTracer(this.constructor.name);
    }

    async init () : Promise<void> {
        this._logger.debug("Event handler starting...");
        try{
            this._kafkaConsumer.setTopics(this._kafkaTopics);
            //this._kafkaConsumer.setCallbackFn(this.processMessage.bind(this));
            this._kafkaConsumer.setBatchCallbackFn(this._processMessagesBatch.bind(this));
            await this._kafkaConsumer.connect();
            await this._kafkaConsumer.startAndWaitForRebalance();
            await this._kafkaProducer.connect();

            this._logger.debug("Event handler started.");
        } catch(error: unknown) {
            this._logger.error(`Error initializing ${this._handlerName} handler: ${(error as Error).message}`);
            throw new Error(`Error initializing ${this._handlerName}`);
        }
    }

    private async _processMessagesBatch (sourceMessages: IMessage[]): Promise<void>{
        const timerEndFn = this._histogram.startTimer({ callName: `${this.constructor.name}_batchMsgHandler`});

        // TODO find a way to have a span for the batch

        for (const sourceMessage of sourceMessages) {
            // extract the context from msg.tracingInfo
            const context =  OpenTelemetryClient.getInstance().propagationExtract(sourceMessage.tracingInfo);

            const spanName = `processMessage ${sourceMessage.msgName}`;
            const spanOptions: SpanOptions = {
                kind: SpanKind.CONSUMER,
                attributes: {
                    "msgName": sourceMessage.msgName,
                    "batchSize": sourceMessages.length
                }
            };

            // start per message span with the correct context
            await this._tracer.startActiveSpan(spanName, spanOptions, context, async (span) => {
                try{
                    await this.processMessage(sourceMessage);
                }catch(err:any){
                    // error handling is being done inside processMessage, here we only take care of the span
                    span.setStatus({code: SpanStatusCode.ERROR});
                    span.setAttributes({
                        "error.name": err.name,
                        "error.message": err.message,
                        "error.stack": err.stack
                    });
                }finally{
                    span.end();
                }
            });
        }

        const took = timerEndFn({ success: "true" })*1000;
        if (this._logger.isDebugEnabled()) {
            this._logger.debug(`  Completed batch in ${this.constructor.name} batch size: ${sourceMessages.length}`);
            this._logger.debug(`  Took: ${took.toFixed(0)}`);
            this._logger.debug("\n\n");
        }
    }

    protected _getActiveSpan(): OpentelemetryApi.Span {
        const span = OpentelemetryApi.trace.getActiveSpan();
        if (span) return span;

        // BaseEventHandler._processMessagesBatch makes sure there is always a span,
        // in the context of a request handler, even if a non-recording one
        throw new Error("Invalid Span in BaseEventHandler - this should not happen");
    }

    protected async _sendHttpRequest(
        urlBuilder:Request.URLBuilder, headers: Request.FspiopHttpHeaders,
        source: string,  destination: string | null, method: FspiopRequestMethodsEnum,
        payload: any, responseType?: ResponseTypeEnum,
        protocolVersions?: {
            content: typeof FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION;
            accept: typeof FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION;
        }
    ):Promise<void>{
        const url = urlBuilder.build();

        // create child span and propagate tracing info
        const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "http request", this._getActiveSpan(), SpanKind.CLIENT);
        childSpan.setAttributes({
            "url": url,
            "method": method,
        });
        OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, headers);

        try {
            await Request.sendRequest({
                url: url,
                headers: headers,
                source: source,
                destination: destination,
                method: method,
                payload: payload,
                responseType: responseType,
                protocolVersions: protocolVersions
            });
        }catch(err:any){
            childSpan.setStatus({code: SpanStatusCode.ERROR});
            childSpan.setAttributes({
                // "reply.statusCode": err.statusCode,
                "error.name": err.name,
                "error.message": err.message,
                // "error.stack": err.stack
            });
            throw Error(err);
        }finally {
            childSpan.end();
        }
    }

    protected async _validateParticipantAndGetEndpoint(fspId: string):Promise<IParticipantEndpoint>{
        const mainTimer = this._histogram.startTimer({ callName: "BASE_validateParticipantAndGetEndpoint"});
        const participant = await this._participantService.getParticipantInfo(fspId);


        if (!participant) {
            const errorMessage = `_validateParticipantAndGetEndpoint could not get participant with id: "${fspId}"`;
            mainTimer( {success:"false"});
            this._logger.error(errorMessage);
            throw Error(errorMessage);
        }

        const endpoint = participant.participantEndpoints.find(endpoint => endpoint.type==="FSPIOP");

        if (!endpoint) {
            const errorMessage = `_validateParticipantAndGetEndpoint could not get "FSPIOP" endpoint from participant with id: "${fspId}"`;
            mainTimer( {success:"false"});
            this._logger.error(errorMessage);
            throw Error(errorMessage);
        }

        mainTimer( {success:"true"});
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
            // create child span and propagate tracing info
            const childSpan = OpenTelemetryClient.getInstance().startChildSpan(this._tracer, "http request", this._getActiveSpan(), SpanKind.CLIENT);
            OpenTelemetryClient.getInstance().propagationInjectFromSpan(childSpan, headers);

            try {

                const endpoint = await this._validateParticipantAndGetEndpoint(fspId);

                const url = this.buildFspFeedbackUrl(endpoint, id, message);
                const clonedHeaders = { ...headers };

                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = headers[Constants.FSPIOP_HEADERS_SOURCE];
                }

                const transformedPayload = FspiopTransformer.transformPayloadError({
                    errorCode: errorResponse.errorCode,
                    errorDescription: errorResponse.errorDescription,
                    extensionList: message.payload.errorInformation ? message.payload.errorInformation.extensionList : null
                });

                if(this._jwsHelper.isEnabled()) {
                    clonedHeaders[Constants.FSPIOP_HEADERS_HTTP_METHOD] = Enums.FspiopRequestMethodsEnum.PUT;
                    clonedHeaders[Constants.FSPIOP_HEADERS_SIGNATURE] = this._jwsHelper.sign(clonedHeaders, transformedPayload);
                }

                childSpan.setAttributes({
                    "url": url,
                    "method": Enums.FspiopRequestMethodsEnum.PUT,
                });

                await Request.sendRequest({
                    url: url,
                    headers: clonedHeaders,
                    source: fspId,
                    destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null,
                    method: Enums.FspiopRequestMethodsEnum.PUT,
                    payload: transformedPayload
                });

                childSpan.end();
            } catch(err: any) {
                childSpan.setStatus({code: SpanStatusCode.ERROR});
                childSpan.setAttributes({
                    // "reply.statusCode": err.statusCode,
                    "error.name": err.name,
                    "error.message": err.message,
                    // "error.stack": err.stack
                });

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
                    errorCode: error
                };

                messageToSend = new AccountLookUpBCOperatorErrorEvent(payload);
                break;
            }
            case HandlerNames.Quotes: {
                const payload: QuoteBCOperatorErrorPayload = {
                    quoteId: message?.payload.quoteId,
                    bulkQuoteId: message?.payload.bulkQuoteId,
                    fspId: message?.payload.quoteId,
                    errorCode: error
                };

                messageToSend = new QuoteBCOperatorErrorEvent(payload);
                break;
            }
            case HandlerNames.Transfers: {
                const payload: TransfersBCOperatorErrorPayload = {
                    transferId: message?.payload.transferId,
                    payerFspId: message?.payload.payerFspId,
                    errorCode: error
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

        this._logger.debug(`Sending ${messageToSend?.msgName} event `);
        await this._kafkaProducer.send(messageToSend);

    }

    private buildFspFeedbackUrl(endpoint: IParticipantEndpoint, id: string[], message: IDomainMessage | undefined): string {
        const header = message?.inboundProtocolOpaqueState.fspiopOpaqueState.headers["content-type"];
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
