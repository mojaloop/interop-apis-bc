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
import {
    DomainEventMsg,
    IDomainMessage,
    IMessage,
    IMessageProducer
} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
    MLKafkaJsonConsumerOptions,
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
    TransferPreparedEvt,
    TransferFulfiledEvt,
    TransferPrepareInvalidPayerCheckFailedEvt,
    TransferPrepareInvalidPayeeCheckFailedEvt,
    TransferPrepareLiquidityCheckFailedEvt,
    TransferDuplicateCheckFailedEvt,
    TransferRejectRequestProcessedEvt,
    TransferPrepareRequestTimedoutEvt,
    TransfersBCUnknownErrorEvent,
    TransferQueryResponseEvt,
    TransferQueryPayerNotFoundFailedEvt,
    TransferQueryPayeeNotFoundFailedEvt,
    TransferUnableToGetTransferByIdEvt,
    TransferNotFoundEvt,
    TransferUnableToAddEvt,
    TransferUnableToUpdateEvt,
    TransferFulfilCommittedRequestedTimedoutEvt,
    TransferFulfilPostCommittedRequestedTimedoutEvt,
    TransferInvalidMessagePayloadEvt,
    TransferInvalidMessageTypeEvt,
    TransferCancelReservationAndCommitFailedEvt,
    TransferCancelReservationFailedEvt,
    TransferPayerNotFoundFailedEvt,
    TransferPayeeNotFoundFailedEvt,
    TransferHubNotFoundFailedEvt,
    TransferHubAccountNotFoundFailedEvt,
    TransferPayerPositionAccountNotFoundFailedEvt,
    TransferPayerLiquidityAccountNotFoundFailedEvt,
    TransferPayeePositionAccountNotFoundFailedEvt,
    TransferPayeeLiquidityAccountNotFoundFailedEvt,
    TransferPayerNotActiveEvt,
    TransferPayerNotApprovedEvt,
    TransferPayeeNotActiveEvt,
    TransferPayeeNotApprovedEvt,
    TransferUnableToDeleteTransferReminderEvt,
    BulkTransferPreparedEvt,
    BulkTransferFulfiledEvt,
    BulkTransferRejectRequestProcessedEvt,
    BulkTransferQueryResponseEvt,
    TransferHubIdMismatchEvt,
    TransferPayerIdMismatchEvt,
    TransferPayeeIdMismatchEvt,
    BulkTransferNotFoundEvt,
    TransferFulfilmentValidationFailedEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, FspiopJwsSignature, FspiopTransformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { BaseEventHandler, HandlerNames } from "./base_event_handler";
import { IParticipantService } from "../interfaces/infrastructure";
import { TransferFulfilRequestedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { TransferRejectRequestedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { getTransferBCErrorMapping } from "../error_mappings/transfers";

import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {IMetrics, Span, SpanStatusCode} from "@mojaloop/platform-shared-lib-observability-types-lib";
import * as OpentelemetryApi from "@opentelemetry/api";


export class TransferEventHandler extends BaseEventHandler {

    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producer: IMessageProducer,
            kafkaTopics : string[],
            participantService: IParticipantService,
            jwsHelper: FspiopJwsSignature,
            metrics: IMetrics
    ) {
        super(
            logger, consumerOptions, producer, kafkaTopics,
            participantService, HandlerNames.Transfers, jwsHelper,
            metrics
        );
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const startTime = Date.now();
        this._histogram.observe({callName:"msgDelay"}, (startTime - sourceMessage.msgTimestamp)/1000);
        const processMessageTimer = this._histogram.startTimer({callName: "processMessage"});

        if (this._logger.isDebugEnabled()) {
            const msgDelayMs = Date.now() - sourceMessage.msgTimestamp;
            this._logger.debug(`Got message in TransfersEventHandler - msgName: ${sourceMessage.msgName} - msgDelayMs: ${msgDelayMs}`);
        }

        // set specific span attributes
        this._getActiveSpan().setAttributes({
            "entityId": sourceMessage.payload.quoteId,
            "quoteId": sourceMessage.payload.quoteId
        });

        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(message.inboundProtocolType !== "FSPIOP_v1_1" || !message.inboundProtocolOpaqueState || !message.inboundProtocolOpaqueState.fspiopOpaqueState || !message.inboundProtocolOpaqueState.fspiopOpaqueState.headers){
                this._logger.warn(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                processMessageTimer({success: "false"});
                return Promise.resolve();
            }

            switch(message.msgName){
                case TransferPreparedEvt.name:
                    await this._handleTransferPreparedEvt(new TransferPreparedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case TransferFulfiledEvt.name:
                    await this._handleTransferFulfiledEvt(new TransferFulfiledEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case TransferQueryResponseEvt.name:
                    await this._handleTransferQueryResponseEvt(new TransferQueryResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case TransferRejectRequestProcessedEvt.name:
                    await this._handleTransferRejectRequestEvt(new TransferRejectRequestProcessedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkTransferPreparedEvt.name:
                    await this._handleBulkTransferPreparedEvt(new BulkTransferPreparedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkTransferFulfiledEvt.name:
                    await this._handleBulkTransferFulfiledEvt(new BulkTransferFulfiledEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkTransferQueryResponseEvt.name:
                    await this._handleBulkTransferQueryResponseEvt(new BulkTransferQueryResponseEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case BulkTransferRejectRequestProcessedEvt.name:
                    await this._handleBulkTransferRejectRequestEvt(new BulkTransferRejectRequestProcessedEvt(message.payload), message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                case TransferNotFoundEvt.name:
                case BulkTransferNotFoundEvt.name:
                case TransferInvalidMessagePayloadEvt.name:
                case TransferInvalidMessageTypeEvt.name:
                case TransferPayerNotFoundFailedEvt.name:
                case TransferPayeeNotFoundFailedEvt.name:
                case TransferHubNotFoundFailedEvt.name:
                case TransferPrepareInvalidPayerCheckFailedEvt.name:
                case TransferPrepareInvalidPayeeCheckFailedEvt.name:
                case TransferPrepareLiquidityCheckFailedEvt.name:
                case TransferDuplicateCheckFailedEvt.name:
                case TransferPrepareRequestTimedoutEvt.name:
                case TransferQueryPayerNotFoundFailedEvt.name:
                case TransferQueryPayeeNotFoundFailedEvt.name:
                case TransferUnableToGetTransferByIdEvt.name:
                case TransferUnableToAddEvt.name:
                case TransferUnableToUpdateEvt.name:
                case TransferFulfilCommittedRequestedTimedoutEvt.name:
                case TransferFulfilPostCommittedRequestedTimedoutEvt.name:
                case TransferCancelReservationFailedEvt.name:
                case TransferCancelReservationAndCommitFailedEvt.name:
                case TransferHubAccountNotFoundFailedEvt.name:
                case TransferPayerPositionAccountNotFoundFailedEvt.name:
                case TransferPayerLiquidityAccountNotFoundFailedEvt.name:
                case TransferPayeePositionAccountNotFoundFailedEvt.name:
                case TransferPayeeLiquidityAccountNotFoundFailedEvt.name:
                case TransferHubIdMismatchEvt.name:
                case TransferPayerIdMismatchEvt.name:
                case TransferPayerNotActiveEvt.name:
                case TransferPayerNotApprovedEvt.name:
                case TransferPayeeIdMismatchEvt.name:
                case TransferPayeeNotActiveEvt.name:
                case TransferPayeeNotApprovedEvt.name:
                case TransferUnableToDeleteTransferReminderEvt.name:
                case TransferFulfilmentValidationFailedEvt.name:
                case TransfersBCUnknownErrorEvent.name:
                    await this._handleErrorReceivedEvt(message as DomainEventMsg, message.inboundProtocolOpaqueState.fspiopOpaqueState);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }
            const took = processMessageTimer({success: "true"}) * 1000;
            this._logger.isDebugEnabled() && this._logger.debug(`  Completed processMessage in - took: ${took} ms`);
        } catch (error: unknown) {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = message.inboundProtocolOpaqueState.fspiopOpaqueState.headers;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const transferId = message.payload.transferId as string;
            const bulkTransferId = message.payload.bulkTransferId as string;

            this._getActiveSpan().setStatus({ code: SpanStatusCode.ERROR });

            processMessageTimer({success: "false"});

            await this._sendErrorFeedbackToFsp({
                message: message,
                headers: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers,
                id: transferId ? [transferId] : [bulkTransferId],
                errorResponse: {
                    errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                    errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name,
                    sourceFspId: requesterFspId,
                    destinationFspId: null
                }
            });
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost
        return;
    }

    async _handleErrorReceivedEvt(message: DomainEventMsg, fspiopOpaqueState: any):Promise<void> {
        this._logger.debug("_handleTransferErrorReceivedEvt -> start");

        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState.headers;
        const sourceFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];
        const transferId = payload.transferId as string;
        const bulkTransferId = payload.bulkTransferId as string;

        // TODO validate vars above

        const errorResponse = this.buildErrorResponseBasedOnErrorEvent(message, sourceFspId, destinationFspId);

        await this._sendErrorFeedbackToFsp({
            message: message,
            headers: clonedHeaders,
            id: transferId ? [transferId] : [bulkTransferId],
            errorResponse: errorResponse
        });

        this._logger.debug("_handleTransferErrorReceivedEvt -> end");

        return;
    }

    private buildErrorResponseBasedOnErrorEvent (message: DomainEventMsg, sourceFspId:string, destinationFspId:string) : { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } {
        const errorResponse: { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } =
        {
            errorCode : Enums.CommunicationErrors.COMMUNICATION_ERROR.code,
            errorDescription : Enums.CommunicationErrors.COMMUNICATION_ERROR.name,
            sourceFspId : sourceFspId,
            destinationFspId: null
        };

        switch(message.sourceMessageName) {
            case TransferFulfilRequestedEvt.name:
                errorResponse.destinationFspId = destinationFspId;
                break;
            case TransferRejectRequestedEvt.name: {
                errorResponse.sourceFspId = destinationFspId;
                break;
            }
        }

        const errorMapping = getTransferBCErrorMapping(message.payload.errorCode);

        if(errorMapping) {
            errorResponse.errorCode = errorMapping.errorCode;
            errorResponse.errorDescription = errorMapping.errorDescription;
        }

        return errorResponse;
    }

    private async _handleTransferPreparedEvt(message: TransferPreparedEvt, fspiopOpaqueState: any):Promise<void>{
                
        try {
            this._logger.debug("_handleTransferPreparedEvt -> start");

            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
    
            // Data model
            const { payload } = message;
            const destinationFspId = payload.payeeFsp;
            
            // Protocol Specific
            const { ilpPacket, condition, extensionList } = fspiopOpaqueState;
            const protocolValues = { ilpPacket, condition, extensionList };

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);

            const transformedPayload = FspiopTransformer.transformPayloadTransferRequestPost(payload, protocolValues);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.POST, transformedPayload
            );

            this._logger.debug("_handleTransferPreparedEvt -> end");
        } catch (error: unknown) {
            this._logger.error(error, "_handleTransferPreparedEvt -> error");

            throw Error("_handleTransferPreparedEvt -> error");
        }

        return;
    }

    private async _handleTransferFulfiledEvt(message: TransferFulfiledEvt, fspiopOpaqueState: any):Promise<void>{
        this._logger.debug("_handleTransferReserveFulfiledEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];
    
            // Data model
            const { payload } = message;
    
            // Protocol Specific
            const { fulfilment, extensionList } = fspiopOpaqueState;
            const protocolValues = { fulfilment, extensionList };

            // TODO validate vars above

            const requestedEndpointPayer = await this._validateParticipantAndGetEndpoint(destinationFspId);

            const requestedEndpointPayee = await this._validateParticipantAndGetEndpoint(requesterFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadTransferRequestPut(payload, protocolValues);

            const urlBuilderPayer = new Request.URLBuilder(requestedEndpointPayer.value);
            urlBuilderPayer.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilderPayer.setLocation([payload.transferId]);

            await this._sendHttpRequest(
                urlBuilderPayer, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            if(payload.notifyPayee) {
                if(this._jwsHelper.isEnabled()) {
                    clonedHeaders[Constants.FSPIOP_HEADERS_HTTP_METHOD] = Enums.FspiopRequestMethodsEnum.PATCH;
                    clonedHeaders[Constants.FSPIOP_HEADERS_SIGNATURE] = this._jwsHelper.sign(clonedHeaders, transformedPayload);
                }

                const urlBuilderPayee = new Request.URLBuilder(requestedEndpointPayee.value);
                urlBuilderPayee.setEntity(Enums.EntityTypeEnum.TRANSFERS);
                urlBuilderPayee.setLocation([payload.transferId]);

                await this._sendHttpRequest(
                    urlBuilderPayee, clonedHeaders, requesterFspId, destinationFspId,
                    Enums.FspiopRequestMethodsEnum.PATCH, transformedPayload
                );
            }

            this._logger.debug("_handleTransferReserveFulfiledEvt -> end");
        } catch (error: unknown) {
            this._logger.error(error, "_handleTransferReserveFulfiledEvt -> error");
            throw Error("_handleTransferReserveFulfiledEvt -> error");
        }

        return;
    }


    private async _handleTransferQueryResponseEvt(message: TransferQueryResponseEvt, fspiopOpaqueState: any):Promise<void> {
        this._logger.debug("_handleTransferQueryResponseEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { fulfilment, extensionList } = fspiopOpaqueState;
            const protocolValues = { fulfilment, extensionList };

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadTransferRequestGet(payload, protocolValues);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilder.setId(payload.transferId);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE], clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION],
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleTransferQueryResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleTransferQueryResponseEvt -> error");
            throw Error("_handleTransferQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleTransferRejectRequestEvt(message: TransferRejectRequestProcessedEvt, fspiopOpaqueState: any):Promise<void> {
        this._logger.debug("_handleTransferRejectRequestEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilder.setId(payload.transferId);
            urlBuilder.hasError(true);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, FspiopTransformer.transformPayloadTransferRequestPutError(payload)
            );

            this._logger.debug("_handleTransferRejectRequestEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleTransferRejectRequestEvt -> error");
            throw Error("_handleTransferRejectRequestEvt -> error");
        }

        return;
    }

    private async _handleBulkTransferPreparedEvt(message: BulkTransferPreparedEvt, fspiopOpaqueState: any):Promise<void>{
        try {
            this._logger.debug("_handleBulkTransferPreparedEvt -> start");

            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { fulfilment, extensionList } = fspiopOpaqueState;
            const protocolValues = { fulfilment, extensionList };

            // TODO validate vars above

            const requestedEndpointPayer = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkTransferRequestPost(payload, protocolValues);

            const urlBuilderPayer = new Request.URLBuilder(requestedEndpointPayer.value);
            urlBuilderPayer.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);

            await this._sendHttpRequest(
                urlBuilderPayer, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.POST, transformedPayload
            );

            this._logger.debug("_handleBulkTransferPreparedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleBulkTransferPreparedEvt -> error");
            throw Error("_handleBulkTransferPreparedEvt -> error");
        }

        return;
    }


    private async _handleBulkTransferFulfiledEvt(message: BulkTransferFulfiledEvt, fspiopOpaqueState: any):Promise<void>{
        try {
            this._logger.debug("_handleBulkTransferFulfiledEvt -> start");

            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // Protocol Specific
            const { fulfilment, extensionList } = fspiopOpaqueState;
            const protocolValues = { fulfilment, extensionList };

            // TODO validate vars above

            const requestedEndpointPayer = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkTransferRequestPut(payload, protocolValues);

            const urlBuilderPayer = new Request.URLBuilder(requestedEndpointPayer.value);
            urlBuilderPayer.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
            urlBuilderPayer.setLocation([payload.bulkTransferId]);

            await this._sendHttpRequest(
                urlBuilderPayer, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleBulkTransferFulfiledEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleBulkTransferFulfiledEvt -> error");
            throw Error("_handleBulkTransferFulfiledEvt -> error");
        }

        return;
    }

    private async _handleBulkTransferQueryResponseEvt(message: BulkTransferQueryResponseEvt, fspiopOpaqueState: any):Promise<void> {
        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // NOTE: This is a query, so we have to switch headers
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            // Data model
            const { payload } = message;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.debug("_handleBulkTransferQueryResponseEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkTransferRequestGet(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
            urlBuilder.setId(payload.bulkTransferId);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE], clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION],
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleBulkTransferQueryResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleBulkTransferQueryResponseEvt -> error");
            throw Error("_handleBulkTransferQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkTransferRejectRequestEvt(message: BulkTransferRejectRequestProcessedEvt, fspiopOpaqueState: any):Promise<void> {
        this._logger.debug("_handleBulkTransferRejectRequestEvt -> start");

        try {
            // Headers
            const clonedHeaders = fspiopOpaqueState.headers;
            const requesterFspId =  clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // Data model
            const { payload } = message;

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const transformedPayload = FspiopTransformer.transformPayloadBulkTransferRequestPutError(payload);

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
            urlBuilder.setId(payload.bulkTransferId);
            urlBuilder.hasError(true);

            await this._sendHttpRequest(
                urlBuilder, clonedHeaders, requesterFspId, destinationFspId,
                Enums.FspiopRequestMethodsEnum.PUT, transformedPayload
            );

            this._logger.debug("_handleBulkTransferRejectRequestEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleBulkTransferRejectRequestEvt -> error");
            throw Error("_handleBulkTransferRejectRequestEvt -> error");
        }

        return;
    }

}
