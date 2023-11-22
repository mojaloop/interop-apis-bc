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
import {DomainErrorEventMsg, IDomainMessage, IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
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
    TransferQueryInvalidPayeeCheckFailedEvt,
    TransferQueryPayerNotFoundFailedEvt,
    TransferQueryPayeeNotFoundFailedEvt,
    TransferQueryInvalidPayerCheckFailedEvt,
    TransferQueryInvalidPayeeParticipantIdEvt,
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
    TransferQueryInvalidPayerParticipantIdEvt,
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
    TransferPayeeIdMismatchEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { BaseEventHandler, HandlerNames } from "./base_event_handler";
import { IParticipantService } from "../interfaces/infrastructure";
import { TransferFulfilRequestedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { TransferRejectRequestedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";

export class TransferEventHandler extends BaseEventHandler {
    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        super(logger, consumerOptions, producerOptions, kafkaTopics, participantService, HandlerNames.Transfers);
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(!message.fspiopOpaqueState || !message.fspiopOpaqueState.headers){
                this._logger.error(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                return;
            }

            switch(message.msgName){
                case TransferPreparedEvt.name:
                    await this._handleTransferPreparedEvt(new TransferPreparedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case TransferFulfiledEvt.name:
                    await this._handleTransferFulfiledEvt(new TransferFulfiledEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case TransferQueryResponseEvt.name:
                    await this._handleTransferQueryResponseEvt(new TransferQueryResponseEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case TransferRejectRequestProcessedEvt.name:
                    await this._handleTransferRejectRequestEvt(new TransferRejectRequestProcessedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkTransferPreparedEvt.name:
                    await this._handleBulkTransferPreparedEvt(new BulkTransferPreparedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkTransferFulfiledEvt.name:
                    await this._handleBulkTransferFulfiledEvt(new BulkTransferFulfiledEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkTransferQueryResponseEvt.name:
                    await this._handleBulkTransferQueryResponseEvt(new BulkTransferQueryResponseEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
                case BulkTransferRejectRequestProcessedEvt.name:
                    await this._handleBulkTransferRejectRequestEvt(new BulkTransferRejectRequestProcessedEvt(message.payload), message.fspiopOpaqueState.headers);
                    break;
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
                case TransferQueryInvalidPayerCheckFailedEvt.name:
                case TransferQueryInvalidPayeeCheckFailedEvt.name:
                case TransferQueryPayerNotFoundFailedEvt.name:
                case TransferQueryPayeeNotFoundFailedEvt.name:
                case TransferQueryInvalidPayerParticipantIdEvt.name:
                case TransferQueryInvalidPayeeParticipantIdEvt.name:
                case TransferUnableToGetTransferByIdEvt.name:
                case TransferNotFoundEvt.name:
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
                case TransfersBCUnknownErrorEvent.name:
                    await this._handleErrorReceivedEvt(message as DomainErrorEventMsg, message.fspiopOpaqueState.headers);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }
        } catch (error: unknown) {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = message.fspiopOpaqueState.headers;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const transferId = message.payload.transferId as string;
            const bulkTransferId = message.payload.bulkTransferId as string;

            await this._sendErrorFeedbackToFsp({
                message: message,
                headers: message.fspiopOpaqueState.headers,
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

    async _handleErrorReceivedEvt(message: DomainErrorEventMsg, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        this._logger.info("_handleTransferErrorReceivedEvt -> start");

        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState;
        const sourceFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;
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

        this._logger.info("_handleTransferErrorReceivedEvt -> end");

        return;
    }

    private buildErrorResponseBasedOnErrorEvent (message: DomainErrorEventMsg, sourceFspId:string, destinationFspId:string) : { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } {
        const errorResponse: { errorCode: string, errorDescription: string, sourceFspId: string, destinationFspId: string | null } =
        {
            errorCode : Enums.CommunicationErrors.COMMUNCATION_ERROR.code,
            errorDescription : Enums.CommunicationErrors.COMMUNCATION_ERROR.name,
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

        switch (message.msgName) {
            case TransferInvalidMessagePayloadEvt.name:
            case TransferInvalidMessageTypeEvt.name:
            case TransferHubIdMismatchEvt.name:
            case TransfersBCUnknownErrorEvent.name: {
                errorResponse.errorCode = Enums.ServerErrors.GENERIC_SERVER_ERROR.code;
                errorResponse.errorDescription = Enums.ServerErrors.GENERIC_SERVER_ERROR.name;
                break;
            }
            case TransferUnableToAddEvt.name:
            case TransferUnableToUpdateEvt.name: 
            case TransferUnableToDeleteTransferReminderEvt.name: {
                errorResponse.errorCode = Enums.ServerErrors.INTERNAL_SERVER_ERROR.code;
                errorResponse.errorDescription = Enums.ServerErrors.INTERNAL_SERVER_ERROR.name;
                break;
            }
            case TransferHubNotFoundFailedEvt.name:
            case TransferHubAccountNotFoundFailedEvt.name: {
                errorResponse.errorCode = Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name;
                break;
            }
            case TransferPayerNotFoundFailedEvt.name:
            case TransferPayeePositionAccountNotFoundFailedEvt.name:
            case TransferPayeeLiquidityAccountNotFoundFailedEvt.name:
            case TransferQueryInvalidPayerCheckFailedEvt.name:
            case TransferQueryPayerNotFoundFailedEvt.name: {
                errorResponse.errorCode = Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name;
                break;
            }
            case TransferPayerPositionAccountNotFoundFailedEvt.name:
            case TransferPayerLiquidityAccountNotFoundFailedEvt.name:
            case TransferPayeeNotFoundFailedEvt.name:
            case TransferQueryInvalidPayeeCheckFailedEvt.name:
            case TransferQueryPayeeNotFoundFailedEvt.name: {
                errorResponse.errorCode = Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name;
                break;
            }
            case TransferNotFoundEvt.name:
            case TransferUnableToGetTransferByIdEvt.name: {
                errorResponse.errorCode = Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code;
                errorResponse.errorDescription = Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name;
                break;
            }
            case TransferDuplicateCheckFailedEvt.name: {
                errorResponse.errorCode = Enums.ClientErrors.INVALID_SIGNATURE.code;
                errorResponse.errorDescription = Enums.ClientErrors.INVALID_SIGNATURE.name;
                break;
            }
            case TransferPrepareRequestTimedoutEvt.name:
            case TransferFulfilCommittedRequestedTimedoutEvt.name:
            case TransferFulfilPostCommittedRequestedTimedoutEvt.name: {
                errorResponse.errorCode = Enums.ClientErrors.TRANSFER_EXPIRED.code;
                errorResponse.errorDescription = Enums.ClientErrors.TRANSFER_EXPIRED.name;
                break;
            }
            case TransferCancelReservationFailedEvt.name:
            case TransferCancelReservationAndCommitFailedEvt.name: {
                errorResponse.errorCode = Enums.ServerErrors.GENERIC_SERVER_ERROR.code;
                errorResponse.errorDescription = Enums.ServerErrors.GENERIC_SERVER_ERROR.name;
                errorResponse.destinationFspId = destinationFspId;
                break;
            }
            case TransferPrepareLiquidityCheckFailedEvt.name: {
                errorResponse.errorCode = Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.code;
                errorResponse.errorDescription = Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.name;
                break;
            }
            case TransferPayerIdMismatchEvt.name:
            case TransferPayerNotActiveEvt.name:
            case TransferPayerNotApprovedEvt.name:
            case TransferPrepareInvalidPayerCheckFailedEvt.name:
            case TransferQueryInvalidPayerParticipantIdEvt.name: {
                errorResponse.errorCode = Enums.PayerErrors.GENERIC_PAYER_ERROR.code;
                errorResponse.errorDescription = Enums.PayerErrors.GENERIC_PAYER_ERROR.name;
                break;
            }
            case TransferPayeeIdMismatchEvt.name:
            case TransferPayeeNotActiveEvt.name:
            case TransferPayeeNotApprovedEvt.name:
            case TransferPrepareInvalidPayeeCheckFailedEvt.name:
            case TransferQueryInvalidPayeeParticipantIdEvt.name: {
                errorResponse.errorCode = Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code;
                errorResponse.errorDescription = Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name;
                break;
            }
            default: {
                const errorMessage = `Cannot handle error message of type: ${message.msgName}, ignoring`;
                this._logger.warn(errorMessage);
            }
        }

        return errorResponse;
    }

    private async _handleTransferPreparedEvt(message: TransferPreparedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = payload.payeeFsp;

        // TODO validate vars above
        
        
        try {
            this._logger.info("_handleTransferPreparedEvt -> start");
            
            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);
            
            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadTransferRequestPost(payload),
            });

            this._logger.info("_handleTransferPreparedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleTransferPreparedEvt -> error");
            throw Error("_handleTransferPreparedEvt -> error");
        }

        return;
    }

    private async _handleTransferFulfiledEvt(message: TransferFulfiledEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

        // TODO validate vars above

        try {
            this._logger.info("_handleTransferReserveFulfiledEvt -> start");

            const requestedEndpointPayer = await this._validateParticipantAndGetEndpoint(destinationFspId);
    
            const requestedEndpointPayee = await this._validateParticipantAndGetEndpoint(requesterFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilderPayer = new Request.URLBuilder(requestedEndpointPayer.value);
            urlBuilderPayer.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilderPayer.setLocation([payload.transferId]);

            await Request.sendRequest({
                url: urlBuilderPayer.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadTransferRequestPut(payload),
            });

            if(payload.notifyPayee) {
                const urlBuilderPayee = new Request.URLBuilder(requestedEndpointPayee.value);
                urlBuilderPayee.setEntity(Enums.EntityTypeEnum.TRANSFERS);
                urlBuilderPayee.setLocation([payload.transferId]);

                await Request.sendRequest({
                    url: urlBuilderPayee.build(),
                    headers: clonedHeaders,
                    source: requesterFspId,
                    destination: destinationFspId,
                    method: Enums.FspiopRequestMethodsEnum.PATCH,
                    payload: Transformer.transformPayloadTransferRequestPut(payload),
                });
            }

            this._logger.info("_handleTransferReserveFulfiledEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleTransferReserveFulfiledEvt -> error");
            throw Error("_handleTransferReserveFulfiledEvt -> error");
        }

        return;
    }

    
    private async _handleTransferQueryResponseEvt(message: TransferQueryResponseEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        this._logger.info("_handleTransferQueryResponseEvt -> start");
        
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilder.setId(payload.transferId);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadTransferRequestGet(payload),
            });

            this._logger.info("_handleTransferQueryResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleTransferQueryResponseEvt -> error");
            throw Error("_handleTransferQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleTransferRejectRequestEvt(message: TransferRejectRequestProcessedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        this._logger.info("_handleTransferRejectRequestEvt -> start");
        
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;

            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.TRANSFERS);
            urlBuilder.setId(payload.transferId);
            urlBuilder.hasError(true);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadTransferRequestPutError(payload),
            });

            this._logger.info("_handleTransferRejectRequestEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleTransferRejectRequestEvt -> error");
            throw Error("_handleTransferRejectRequestEvt -> error");
        }

        return;
    }

    private async _handleBulkTransferPreparedEvt(message: BulkTransferPreparedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

        // TODO validate vars above

        
        try {
            this._logger.info("_handleBulkTransferPreparedEvt -> start");
           
            const requestedEndpointPayer = await this._validateParticipantAndGetEndpoint(destinationFspId);
    
            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilderPayer = new Request.URLBuilder(requestedEndpointPayer.value);
            urlBuilderPayer.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);

            await Request.sendRequest({
                url: urlBuilderPayer.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadBulkTransferRequestPost(payload),
            });

            this._logger.info("_handleBulkTransferPreparedEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleBulkTransferPreparedEvt -> error");
            throw Error("_handleBulkTransferPreparedEvt -> error");
        }

        return;
    }

    
    private async _handleBulkTransferFulfiledEvt(message: BulkTransferFulfiledEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void>{
        const { payload } = message;

        const clonedHeaders = fspiopOpaqueState;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string;

        // TODO validate vars above

        
        try {
            this._logger.info("_handleBulkTransferFulfiledEvt -> start");
            
            const requestedEndpointPayer = await this._validateParticipantAndGetEndpoint(destinationFspId);
    
            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilderPayer = new Request.URLBuilder(requestedEndpointPayer.value);
            urlBuilderPayer.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
            urlBuilderPayer.setLocation([payload.bulkTransferId]);

            await Request.sendRequest({
                url: urlBuilderPayer.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkTransferRequestPut(payload),
            });

            this._logger.info("_handleBulkTransferFulfiledEvt -> end");

        } catch (error: unknown) {
            this._logger.error(error, "_handleBulkTransferFulfiledEvt -> error");
            throw Error("_handleBulkTransferFulfiledEvt -> error");
        }

        return;
    }

    private async _handleBulkTransferQueryResponseEvt(message: BulkTransferQueryResponseEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;
            
            clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            this._logger.info("_handleBulkTransferQueryResponseEvt -> start");

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
            urlBuilder.setId(payload.bulkTransferId);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkTransferRequestGet(payload),
            });

            this._logger.info("_handleBulkTransferQueryResponseEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleBulkTransferQueryResponseEvt -> error");
            throw Error("_handleBulkTransferQueryResponseEvt -> error");
        }

        return;
    }

    private async _handleBulkTransferRejectRequestEvt(message: BulkTransferRejectRequestProcessedEvt, fspiopOpaqueState: Request.FspiopHttpHeaders):Promise<void> {
        this._logger.info("_handleBulkTransferRejectRequestEvt -> start");
        
        try {
            const { payload } = message;

            const clonedHeaders = fspiopOpaqueState;

            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION];

            // TODO validate vars above

            const requestedEndpoint = await this._validateParticipantAndGetEndpoint(destinationFspId);

            // Always validate the payload and headers received
            message.validatePayload();

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.BULK_TRANSFERS);
            urlBuilder.setId(payload.bulkTransferId);
            urlBuilder.hasError(true);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkTransferRequestPutError(payload),
            });

            this._logger.info("_handleBulkTransferRejectRequestEvt -> end");

        } catch (error: unknown) {
            this._logger.error("_handleBulkTransferRejectRequestEvt -> error");
            throw Error("_handleBulkTransferRejectRequestEvt -> error");
        }

        return;
    }
}
