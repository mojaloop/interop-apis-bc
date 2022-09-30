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

"use strict"

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IDomainMessage, IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, PartyInfoRequestedEvt} from "@mojaloop/platform-shared-lib-public-messages-lib/dist/index";
import { FSPIOP_HEADERS_SOURCE, FSPIOP_ENDPOINT_TYPES, FSPIOP_HEADERS_SWITCH, FSPIOP_HEADERS_DESTINATION, FSPIOP_REQUEST_METHODS, FSPIOP_PARTY_ACCOUNT_TYPES } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { sendRequest } from "../request";
import { decodePayload } from "../request/transformer";
import { PartyQueryResponseEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";

export type PutParty = {
    partyIdType: string;
    partyIdentifier: string;
    partySubType: string | null;
}
export class PartiesEventHandler{
    private _kafkaConsumer: MLKafkaJsonConsumer;
    private _logger:ILogger;
    private _consumerOpts: MLKafkaJsonConsumerOptions;
    private _kafkaTopics: string[];

    constructor(
            logger: ILogger,
            consumerOpts: MLKafkaJsonConsumerOptions,
            kafkaTopics : string[]
    ) {
        this._logger = logger.createChild("PartiesEventHandler");
        this._consumerOpts = consumerOpts;
        this._kafkaTopics = kafkaTopics;
    }

    async init () : Promise<void> {
        this._kafkaConsumer = new MLKafkaJsonConsumer(this._consumerOpts, this._logger);
        this._kafkaConsumer.setTopics(this._kafkaTopics);
        this._kafkaConsumer.setCallbackFn(this.processMessage.bind(this));
        await this._kafkaConsumer.connect();
        await this._kafkaConsumer.start();
    }

    async processMessage (sourceMessage: IMessage) : Promise<void> {
        const message: IDomainMessage = sourceMessage as IDomainMessage;

        switch(message.msgName){
            case ParticipantAssociationRequestReceivedEvt.name:
                await this._handleParticipantAssociationRequestReceivedEvt(message as ParticipantAssociationRequestReceivedEvt);
                break;
            case ParticipantDisassociateRequestReceivedEvt.name:
                await this._handleParticipantDisassociateRequestReceivedEvt(message as PartyQueryResponseEvt);
                break;
            case PartyInfoRequestedEvt.name:
                await this._handlePartyInfoRequestedEvt(message as PartyInfoRequestedEvt);
                break;
            default:
                this._logger.warn(`Cannot handle message of type: ${message.msgName}, ignoring`);
                break;
        }

        // make sure we only return from the processMessage/handler after completing the request,
        // otherwise this will commit the event and will be lost


        return;
    }

    private async _handleParticipantAssociationRequestReceivedEvt(msg: ParticipantAssociationRequestReceivedEvt & { headers?: any }):Promise<void>{
        const { validatePayload, payload, headers } = msg;
  
        // Always first validate the payload received
        validatePayload();
  
        const type = payload.partyType;
        const partySubType = payload.partySubType || undefined
        const requesterName = headers[FSPIOP_HEADERS_SOURCE]
  
        // These variables are required to get the endpoint of the FSP we want to send the request to
        const callbackEndpointType = partySubIdOrType ? Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT : Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT
        const errorCallbackEndpointType = partySubIdOrType ? Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR : Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR
    
        try {  
            let options: PutParty = {
                partyIdType: partyType,
                partyIdentifier: aggregateId,
                partySubType: partySubType
            }

            const decodedPayload = decodePayload(dataUri, { asParsed: false })
            await sendRequest(headers, destinationParticipant.data.name, callbackEndpointType, RestMethods.PUT, decodedPayload.body.toString(), options)
            this._logger.info('putPartiesByTypeAndID -> end')
        } catch (err) {
            this._logger.error(err)
            // const errorCallbackEndpointType = partySubType ? FspEndpointTypesEnum.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR : FspEndpointTypesEnum.FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR
            // await participant.sendErrorToParticipant
            // In our case, we send an error event
            
        }

        try {
            this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> start')

            if (Object.values(FSPIOP_PARTY_ACCOUNT_TYPES).includes(type)) {
                const clonedHeaders = { ...headers }

                // let options: PutParty = {
                //     partyIdType: partyType,
                //     partyIdentifier: aggregateId,
                //     partySubType: partySubType
                // }
    
                // const requestedEndpoint = await Util.Endpoints.getEndpoint(Config.SWITCH_ENDPOINT, requestedParticipant, endpointType, options || undefined)

                const decodedPayload = decodePayload('requestedEndpoint', { asParsed: false })

                await sendRequest({
                    url: 'requestedEndpoint', 
                    headers: clonedHeaders, 
                    source: requesterName, 
                    destination: clonedHeaders[FSPIOP_HEADERS_DESTINATION], 
                    method: FSPIOP_REQUEST_METHODS.PUT,
                    payload: decodedPayload,
                })

                this._logger.info('_handleParticipantAssociationRequestReceivedEvt -> end')
            } else {
                throw Error('No valid party type')
            }
        } catch (err: any) {
            this._logger.error(err)
        }

        return;

    //     Logger.info('parties::putPartiesByTypeAndID::begin')
    //     const requesterParticipant = await participant.validateParticipant(headers[Enums.Http.Headers.FSPIOP.SOURCE])
    //     const type = params.Type
    //     const partySubIdOrType = params.SubId || undefined
    //     const callbackEndpointType = partySubIdOrType ? Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT : Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT
    //     const errorCallbackEndpointType = partySubIdOrType ? Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR : Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR
    //     if (requesterParticipant) {
    //       const destinationParticipant = await participant.validateParticipant(headers[Enums.Http.Headers.FSPIOP.DESTINATION])
    //       if (destinationParticipant) {
    //         let options = {
    //           partyIdType: type,
    //           partyIdentifier: params.ID
    //         }
    //         options = partySubIdOrType ? { ...options, partySubIdOrType } : options
    //         const decodedPayload = decodePayload(dataUri, { asParsed: false })
    //         await participant.sendRequest(headers, destinationParticipant.data.name, callbackEndpointType, Enums.Http.RestMethods.PUT, decodedPayload.body.toString(), options)
    //         Logger.info('parties::putPartiesByTypeAndID::end')
    //       } else {
    //         await participant.sendErrorToParticipant(headers[Enums.Http.Headers.FSPIOP.SOURCE], errorCallbackEndpointType,
    //           ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR).toApiErrorObject(Config.ERROR_HANDLING), headers, params)
    //       }
    //     } else {
    //       Logger.error('Requester FSP not found')
    //       throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND, 'Requester FSP not found')
    //     }
    //   } catch (err) {
    //     Logger.error(err)
    //     try {
    //       const errorCallbackEndpointType = params.SubId ? Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_SUB_ID_PUT_ERROR : Enums.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR
    //       await participant.sendErrorToParticipant(headers[Enums.Http.Headers.FSPIOP.SOURCE], errorCallbackEndpointType,
    //         ErrorHandler.Factory.reformatFSPIOPError(err).toApiErrorObject(Config.ERROR_HANDLING), headers, params)
    //     } catch (exc) {
    //       // We can't do anything else here- we _must_ handle all errors _within_ this function because
    //       // we've already sent a sync response- we cannot throw.
    //       Logger.error(exc)
    //     }
        // return;
    }
    
    private async _handleParticipantDisassociateRequestReceivedEvt(msg: ParticipantDisassociateRequestReceivedEvt & { headers?: any }):Promise<void>{
        return;
    }

    private async _handlePartyInfoRequestedEvt(msg: PartyInfoRequestedEvt & { headers?: any }):Promise<void>{
        const { validatePayload, payload, headers } = msg;
  
        // Always first validate the payload received
        validatePayload();
  
        const type = payload.partyType;
        const partySubType = payload.partySubType || undefined
        const requesterName = headers[FSPIOP_HEADERS_SOURCE]
  
        // These variables are required to get the endpoint of the FSP we want to send the request to
        const callbackEndpointType = partySubType ? FSPIOP_ENDPOINT_TYPES.FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT : FSPIOP_ENDPOINT_TYPES.FSPIOP_CALLBACK_URL_PARTICIPANT_PUT
        const errorCallbackEndpointType = partySubType ? FSPIOP_ENDPOINT_TYPES.FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR : FSPIOP_ENDPOINT_TYPES.FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR
  
        try {
            this._logger.info('_handlePartyInfoRequestedEvt -> start')

            if (Object.values(FSPIOP_PARTY_ACCOUNT_TYPES).includes(type)) {
                const clonedHeaders = { ...headers }

                if (!clonedHeaders[FSPIOP_HEADERS_DESTINATION] || clonedHeaders[FSPIOP_HEADERS_DESTINATION] === '') {
                clonedHeaders[FSPIOP_HEADERS_DESTINATION] = clonedHeaders[FSPIOP_HEADERS_SOURCE]
                }
                clonedHeaders[FSPIOP_HEADERS_SOURCE] = FSPIOP_HEADERS_SWITCH

                // const requestedEndpoint = await Util.Endpoints.getEndpoint(Config.SWITCH_ENDPOINT, requestedParticipant, endpointType, options || undefined)

                await sendRequest({
                    url: 'requestedEndpoint', 
                    headers: clonedHeaders, 
                    source: requesterName, 
                    destination: clonedHeaders[FSPIOP_HEADERS_DESTINATION], 
                    method: FSPIOP_REQUEST_METHODS.PUT,
                    payload: payload,
                })

                this._logger.info('_handlePartyInfoRequestedEvt -> end')
            } else {
                throw Error('No valid party type')
            }
        } catch (err: any) {
            this._logger.error(err)
        }

        return;
    }

    async destroy () : Promise<void> {
        return this._kafkaConsumer.destroy(true)
    }
}
