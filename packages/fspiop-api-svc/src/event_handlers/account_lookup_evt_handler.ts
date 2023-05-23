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
import {MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
    AccountLookUpUnknownErrorEvent,
    PartyInfoRequestedEvt,
    PartyQueryResponseEvt,
    ParticipantAssociationCreatedEvt,
    ParticipantAssociationRemovedEvt,
    ParticipantQueryResponseEvt,
    AccountLookupBCInvalidMessagePayloadErrorEvent,
    AccountLookupBCInvalidMessageTypeErrorEvent,
    AccountLookupBCInvalidParticipantIdErrorEvent,
    AccountLookupBCOracleAdapterNotFoundErrorEvent,
    AccountLookupBCOracleNotFoundErrorEvent,
    AccountLookupBCParticipantNotFoundErrorEvent,
    AccountLookupBCParticipantFspIdNotFoundErrorEvent,
    AccountLookupBCUnableToAssociateParticipantErrorEvent,
    AccountLookupBCUnableToDisassociateParticipantErrorEvent,
    AccountLookupBCUnableToGetOracleFromOracleFinderErrorEvent,
    AccountLookupBCUnableToGetParticipantFspIdErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Constants, Request, Enums, Validate, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ParticipantsPutId, ParticipantsPutTypeAndId, PartiesPutTypeAndId, PartiesPutTypeAndIdAndSubId } from "../errors";
import { IncomingHttpHeaders } from "http";
import { BaseEventHandler } from "./base_event_handler";
import { IParticipantService } from "../interfaces/infrastructure";

export class AccountLookupEventHandler extends BaseEventHandler {

    constructor(
            logger: ILogger,
            consumerOptions: MLKafkaJsonConsumerOptions,
            producerOptions: MLKafkaJsonProducerOptions,
            kafkaTopics : string[],
            participantService: IParticipantService
    ) {
        super(logger, consumerOptions, producerOptions, kafkaTopics, participantService);
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        try {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            if(!message.fspiopOpaqueState || !message.fspiopOpaqueState.headers){
                this._logger.error(`received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`);
                return;
            }

            switch(message.msgName){
                case AccountLookUpUnknownErrorEvent.name:
                case AccountLookupBCInvalidMessagePayloadErrorEvent.name:
                case AccountLookupBCInvalidMessageTypeErrorEvent.name:
                case AccountLookupBCUnableToAssociateParticipantErrorEvent.name:
                case AccountLookupBCUnableToDisassociateParticipantErrorEvent.name:
                case AccountLookupBCParticipantNotFoundErrorEvent.name:
                case AccountLookupBCInvalidParticipantIdErrorEvent.name:
                case AccountLookupBCUnableToGetOracleFromOracleFinderErrorEvent.name:
                case AccountLookupBCOracleNotFoundErrorEvent.name:
                case AccountLookupBCOracleAdapterNotFoundErrorEvent.name:
                case AccountLookupBCUnableToGetParticipantFspIdErrorEvent.name:
                case AccountLookupBCParticipantFspIdNotFoundErrorEvent.name:
                    await this._handleErrorReceivedEvt(message, message.fspiopOpaqueState);
                    break;
                case ParticipantAssociationCreatedEvt.name:
                    await this._handleParticipantAssociationRequestReceivedEvt(new ParticipantAssociationCreatedEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case ParticipantAssociationRemovedEvt.name:
                    await this._handleParticipantDisassociateRequestReceivedEvt(new ParticipantAssociationRemovedEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case PartyInfoRequestedEvt.name:
                    await this._handlePartyInfoRequestedEvt(new PartyInfoRequestedEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case PartyQueryResponseEvt.name:
                    await this._handlePartyQueryResponseEvt(new PartyQueryResponseEvt(message.payload), message.fspiopOpaqueState);
                    break;
                case ParticipantQueryResponseEvt.name:
                    await this._handleParticipantQueryResponseEvt(new ParticipantQueryResponseEvt(message.payload), message.fspiopOpaqueState);
                    break;
                default:
                    this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                    break;
            }
        } catch (e: unknown) {
            const message: IDomainMessage = sourceMessage as IDomainMessage;

            const clonedHeaders = { ...message.fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
            const requesterFspId = clonedHeaders["fspiop-source"] as string;
            const partyType = message.payload.partyType as string;
            const partyId = message.payload.partyId as string;
            const partySubType = message.payload.partySubType as string;

            this._sendErrorFeedbackToFsp({
                message: message,
                error: message.msgName,
                errorCode: Enums.ServerErrorCodes.GENERIC_SERVER_ERROR,
                headers: message.fspiopOpaqueState.headers,
                source: requesterFspId,
                id: [partyType, partyId, partySubType]
            });
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost

        return;
    }

    async _handleErrorReceivedEvt(message: IDomainMessage, fspiopOpaqueState: IncomingHttpHeaders):Promise<void> {
        this._logger.info("_handleAccountLookupErrorReceivedEvt -> start");

        const { payload } = message;

        const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };
        const requesterFspId = clonedHeaders["fspiop-source"] as string;
        const partyType = payload.partyType as string;
        const partyId = payload.partyId as string;
        const partySubType = payload.partySubType as string;

        const requestedEndpoint = (await this._validateParticipantAndGetEndpoint(requesterFspId));

        if(!requestedEndpoint) {
            throw Error(`fspId ${requesterFspId} has no valid participant associated`);
        }

        // Always validate the payload and headers received
        Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);

        const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);

        urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
        urlBuilder.setLocation([partyType, partyId, partySubType]);
        urlBuilder.hasError(true);

        const extensionList = [];
        let list: string[] = [];
        let errorCode = "1000"; // Default error code

        switch(message.msgName){
            case AccountLookupBCUnableToAssociateParticipantErrorEvent.name:
            case AccountLookupBCUnableToDisassociateParticipantErrorEvent.name: {
                list = ["partyType", "partyId", "partySubType", "fspId"];
                errorCode = Enums.ServerErrorCodes.GENERIC_SERVER_ERROR;

                break;
            }
            case AccountLookupBCParticipantNotFoundErrorEvent.name:
            case AccountLookupBCUnableToGetParticipantFspIdErrorEvent.name:
            case AccountLookupBCParticipantFspIdNotFoundErrorEvent.name: {
                list = ["partyType", "partyId", "partySubType", "fspId"];

                if(clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === message.payload.fspId) {
                    errorCode = Enums.ClientErrorCodes.PAYER_FSP_ID_NOT_FOUND;
                } else {
                    errorCode = Enums.ClientErrorCodes.PAYEE_FSP_ID_NOT_FOUND;
                }

                break;
            }
            case AccountLookupBCInvalidParticipantIdErrorEvent.name: {
                list = ["partyType", "partyId", "partySubType", "fspId"];

                if(clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === message.payload.fspId) {
                    errorCode = Enums.ClientErrorCodes.GENERIC_CLIENT_ERROR;
                } else {
                    errorCode = Enums.ClientErrorCodes.DESTINATION_FSP_ERROR;
                }

                break;
            }
            case AccountLookupBCInvalidMessagePayloadErrorEvent.name:
            case AccountLookupBCInvalidMessageTypeErrorEvent.name:
            case AccountLookupBCUnableToGetOracleFromOracleFinderErrorEvent.name:
            case AccountLookupBCOracleNotFoundErrorEvent.name:
            case AccountLookupBCOracleAdapterNotFoundErrorEvent.name: {

                list = ["partyType", "partyId", "partySubType", "fspId"];
                errorCode = Enums.ClientErrorCodes.GENERIC_CLIENT_ERROR;

                break;
            }
            case AccountLookUpUnknownErrorEvent.name: {
                list = ["partyType", "partyId", "partySubType", "fspId"];
                errorCode = Enums.ServerErrorCodes.INTERNAL_SERVER_ERROR;

                break;
            }
            default: {
                this._logger.warn(`Cannot handle error message of type: ${message.msgName}, ignoring`);
                break;
            }
        }

        for(let i=0 ; i<list.length ; i+=1){
            if(payload[list[i]]) {
                extensionList.push({
                    key: list[i],
                    value: payload[list[i]]
                });
            }
        }

        this._sendErrorFeedbackToFsp({
            message: message,
            error: message.payload.errorInformation.errorDescription,
            errorCode: errorCode,
            headers: clonedHeaders,
            source: requesterFspId,
            id: [partyType, partyId, partySubType],
            extensionList: extensionList
        });

        this._logger.info("_handleAccountLookupErrorReceivedEvt -> end");

        return;
    }

    private async _handleParticipantAssociationRequestReceivedEvt(message: ParticipantAssociationCreatedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        this._logger.info("_handleParticipantAssociationRequestReceivedEvt -> start");

        try {
            const { payload } = message;

            const requesterFspId = payload.ownerFspId;
            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

            const requestedEndpoint = (await this._validateParticipantAndGetEndpoint(requesterFspId));

            if(!requestedEndpoint) {
                throw Error(`fspId ${requesterFspId} has no valid participant associated`);
            }

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyAssociationPut(payload),
            });

            this._logger.info("_handleParticipantAssociationRequestReceivedEvt -> end");

        } catch (error: unknown) {
            this._logger.info("_handleParticipantAssociationRequestReceivedEvt -> error");
            throw Error("_handleParticipantAssociationRequestReceivedEvt -> error");
        }

        return;
    }

    private async _handleParticipantDisassociateRequestReceivedEvt(message: ParticipantAssociationRemovedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        this._logger.info("_handleParticipantDisassociateRequestReceivedEvt -> start");

        try {
            const { payload } = message;

            const requesterFspId = payload.ownerFspId;
            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

            const requestedEndpoint = (await this._validateParticipantAndGetEndpoint(requesterFspId));

            if(!requestedEndpoint) {
                throw Error(`fspId ${requesterFspId} has no valid participant associated`);
            }


            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyDisassociationPut(payload),
            });

            this._logger.info("_handleParticipantDisassociateRequestReceivedEvt -> end");

        } catch (error: unknown) {
            this._logger.info("_handleParticipantDisassociateRequestReceivedEvt -> error");
            throw Error("_handleParticipantDisassociateRequestReceivedEvt -> error");
        }

        return;
    }

    private async _handlePartyInfoRequestedEvt(message: PartyInfoRequestedEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        this._logger.info("_handlePartyInfoRequestedEvt -> start");

        try {

            const { payload } = message;

            const requesterFspId = payload.requesterFspId;
            const destinationFspId = payload.destinationFspId;
            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

            // TODO handle the case where destinationFspId is null and remove ! below

            if(!destinationFspId){
                throw Error(`required destination fspId is missing from the header`);
            }

            const destinationEndpoint = (await this._validateParticipantAndGetEndpoint(destinationFspId));

            if(!destinationEndpoint) {
                throw Error(`fspId ${destinationFspId} has no valid participant associated`);
            }


            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);

            if (clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = destinationFspId;
            }

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.GET,
                payload: Transformer.transformPayloadPartyInfoRequestedPut(payload),
            });

            this._logger.info("_handlePartyInfoRequestedEvt -> end");

        } catch (error: unknown) {
            this._logger.info("_handlePartyInfoRequestedEvt -> error");
            throw Error("_handlePartyInfoRequestedEvt -> error");
        }

        return;
    }

    private async _handlePartyQueryResponseEvt(message: PartyQueryResponseEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        this._logger.info("_handlePartyQueryResponseEvt -> start");

        try {
            const { payload } = message;

            const requesterFspId = payload.requesterFspId;
            const destinationFspId = payload.destinationFspId;
            const partyType = payload.partyType ;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

            const destinationEndpoint = (await this._validateParticipantAndGetEndpoint(destinationFspId));

            if(!destinationEndpoint) {
                throw Error(`fspId ${destinationFspId} has no valid participant associated`);
            }

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? PartiesPutTypeAndIdAndSubId : PartiesPutTypeAndId, clonedHeaders);


            if(fspiopOpaqueState) {
                if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                    clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
                }
                clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];

            }

            const urlBuilder = new Request.URLBuilder(destinationEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTIES);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyInfoReceivedPut(payload),
            });

            this._logger.info("_handlePartyQueryResponseEvt -> end");
        } catch (error: unknown) {
            this._logger.info("_handlePartyQueryResponseEvt -> error");
            throw Error("_handlePartyQueryResponseEvt -> error");
        }

        return;
    }


    private async _handleParticipantQueryResponseEvt(message: ParticipantQueryResponseEvt, fspiopOpaqueState: IncomingHttpHeaders):Promise<void>{
        this._logger.info("_handleParticipantQueryResponseEvt -> start");

        try {
            const { payload } = message;

            const partyType = payload.partyType;
            const partyId = payload.partyId;
            const partySubType = payload.partySubType as string;
            const requesterFspId = payload.requesterFspId;
            const clonedHeaders = { ...fspiopOpaqueState.headers as unknown as Request.FspiopHttpHeaders };

            const requestedEndpoint = (await this._validateParticipantAndGetEndpoint(requesterFspId));

            if(!requestedEndpoint) {
                throw Error(`fspId ${requesterFspId} has no valid participant associated`);
            }

            // Always validate the payload and headers received
            message.validatePayload();
            Validate.validateHeaders(partySubType ? ParticipantsPutTypeAndId : ParticipantsPutId, clonedHeaders);

            if (!clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] === "") {
                clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE];
            }
            clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] = Constants.FSPIOP_HEADERS_SWITCH;

            const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
            urlBuilder.setEntity(Enums.EntityTypeEnum.PARTICIPANTS);
            urlBuilder.setLocation([partyType, partyId, partySubType]);

            await Request.sendRequest({
                url: urlBuilder.build(),
                headers: clonedHeaders,
                source: requesterFspId,
                destination: clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] || null,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadParticipantPut(payload),
            });

            this._logger.info("_handleParticipantQueryResponseEvt -> end");
        } catch (error: unknown) {
            this._logger.info("_handleParticipantQueryResponseEvt -> error");
            throw Error("_handleParticipantQueryResponseEvt -> error");
        }

        return;
    }

}
