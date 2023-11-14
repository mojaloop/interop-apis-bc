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

import express from "express";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { Constants, Transformer, ValidationdError } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
    PartyQueryReceivedEvt,
    PartyQueryReceivedEvtPayload,
    PartyInfoAvailableEvt,
    PartyInfoAvailableEvtPayload,
    GetPartyQueryRejectedEvt,
    GetPartyQueryRejectedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { BaseRoutes } from "../_base_router";
import { FSPIOPErrorCodes } from "../../validation";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";

export class PartyRoutes extends BaseRoutes {

    constructor(
        configClient: IConfigurationClient,
        producerOptions: MLKafkaJsonProducerOptions,
        kafkaTopic: string,
        logger: ILogger
    ) {
        super(configClient, producerOptions, kafkaTopic, logger);

        // bind routes

        // Requests
        // GET Party by Type & ID
        this.router.get("/:type/:id/", this.getPartyQueryReceivedByTypeAndId.bind(this));
        // GET Parties by Type, ID & SubId
        this.router.get("/:type/:id/:subid", this.getPartyQueryReceivedByTypeAndIdSubId.bind(this));

        // Callbacks
        // PUT ERROR Party by Type & ID
        this.router.put("/:type/:id/error", this.getPartyByTypeAndIdQueryReject.bind(this));
        // PUT ERROR Parties by Type, ID & SubId
        this.router.put("/:type/:id/:subid/error", this.getPartyByTypeAndIdAndSubIdQueryReject.bind(this));
        // PUT Party by Type & ID
        this.router.put("/:type/:id/", this.getPartyInfoAvailableByTypeAndId.bind(this));
        // PUT Parties by Type, ID & SubId
        this.router.put("/:type/:id/:subid", this.getPartyInfoAvailableByTypeAndIdAndSubId.bind(this));
    }

    private async getPartyQueryReceivedByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyQueryReceivedByTypeAndId request");
        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
            const currency = req.query["currency"] as string || null;

            if (!type || !id || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return;
            }

            if(currency) { 
                this._validator.currencyAndAmount({ 
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: PartyQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency,
            };

            const msg = new PartyQueryReceivedEvt(msgPayload);

            // TODO: Review this rule that matches ttk use cases
            // clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] = requesterFspId as string;

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getPartyQueryReceivedByTypeAndId sent message");

            res.status(202).json(null);

            this.logger.debug("getPartyQueryReceivedByTypeAndId responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                res.status(400).json(error.errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                res.status(500).json(transformError);
            }
            return;
        }
    }

    private async getPartyQueryReceivedByTypeAndIdSubId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyQueryReceivedByTypeAndIdSubId request");

        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const partySubIdOrType = req.params["subid"] as string || null;
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = req.headers[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
            const currency = req.query["currency"] as string || null;

            if (!type || !id || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return;
            }

            if(currency) { 
                this._validator.currencyAndAmount({ 
                    currency: currency,
                    amount: null
                });
            }
            
            const msgPayload: PartyQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new PartyQueryReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getPartyQueryReceivedByTypeAndIdSubId sent message");

            res.status(202).json(null);

            this.logger.debug("getPartyQueryReceivedByTypeAndIdSubId responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                res.status(400).json(error.errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                res.status(500).json(transformError);
            }
            return;
        }
    }

    private async getPartyInfoAvailableByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyInfoAvailableByTypeAndId request");

        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
            const ownerFspId = req.body.party.partyIdInfo["fspId"] || null;
            const currency = req.query["currency"] as string || null;
            const name = req.body.party["name"] || null;
            const merchantClassificationCode = req.body.party["merchantClassificationCode"] || null;
            const firstName = req.body.party.personalInfo.complexName["firstName"] || null;
            const middleName = req.body.party.personalInfo.complexName["middleName"] || null;
            const lastName = req.body.party.personalInfo.complexName["lastName"] || null;
            const partyDoB = req.body.party.personalInfo["dateOfBirth"] || null;

            if (!type || !id || !requesterFspId || !ownerFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return;
            }

            if(currency) { 
                this._validator.currencyAndAmount({ 
                    currency: currency,
                    amount: null
                });
            }
            
            const msgPayload: PartyInfoAvailableEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                ownerFspId: ownerFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency,
                merchantClassificationCode: merchantClassificationCode,
                name: name,
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                partyDoB: partyDoB
            };


            const msg = new PartyInfoAvailableEvt(msgPayload);

            // this is a response from the original destination, so we swap requester and destination
            msg.fspiopOpaqueState = {
                originalRequesterFspId: destinationFspId,
                originalDestination: requesterFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getPartyInfoAvailableByTypeAndId sent message");

            res.status(202).json(null);

            this.logger.debug("getPartyInfoAvailableByTypeAndId responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                res.status(400).json(error.errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                res.status(500).json(transformError);
            }
            return;
        }
    }

    private async getPartyInfoAvailableByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyInfoAvailableByTypeAndIdAndSubId request");

        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const partySubIdOrType = req.params["subid"] as string || null;
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
            const ownerFspId = req.body.party.partyIdInfo["fspId"] || null;
            const currency = req.query["currency"] as string || null;
            const merchantClassificationCode = req.body.party["merchantClassificationCode"] || null;
            const name = req.body.party["name"] || null;
            const firstName = req.body.party.personalInfo.complexName["firstName"] || null;
            const middleName = req.body.party.personalInfo.complexName["middleName"] || null;
            const lastName = req.body.party.personalInfo.complexName["lastName"] || null;
            const partyDoB = req.body.party.personalInfo["dateOfBirth"] || null;

            if (!type || !id || !requesterFspId || !ownerFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return;
            }

            if(currency) { 
                this._validator.currencyAndAmount({ 
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: PartyInfoAvailableEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                ownerFspId: ownerFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency,
                merchantClassificationCode: merchantClassificationCode,
                name: name,
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                partyDoB: partyDoB
            };

            const msg = new PartyInfoAvailableEvt(msgPayload);

            // this is a response from the original destination, so we swap requester and destination
            msg.fspiopOpaqueState = {
                originalRequesterFspId: destinationFspId,
                originalDestination: requesterFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getPartyInfoAvailableByTypeAndIdAndSubId sent message");

            res.status(202).json(null);

            this.logger.debug("getPartyInfoAvailableByTypeAndIdAndSubId responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                res.status(400).json(error.errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                res.status(500).json(transformError);
            }
            return;
        }
    }

    private async getPartyByTypeAndIdQueryReject(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyByTypeAndIdQueryReject request");

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const type = req.params["type"] as string;
            const id = req.params["id"] as string;
            const currency = req.query["currency"] as string || null;
            const errorInformation = req.body["errorInformation"] || null;

            if (!type || !id || !requesterFspId || !errorInformation) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return;
            }

            if(currency) { 
                this._validator.currencyAndAmount({ 
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: GetPartyQueryRejectedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency,
                errorInformation: errorInformation
            };

            const msg = new GetPartyQueryRejectedEvt(msgPayload);

            msg.validatePayload();

            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getPartyByTypeAndIdQueryReject sent message");

            res.status(202).json(null);

            this.logger.debug("getPartyByTypeAndIdQueryReject responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                res.status(400).json(error.errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                res.status(500).json(transformError);
            }
            return;
        }
    }

    private async getPartyByTypeAndIdAndSubIdQueryReject(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyByTypeAndIdAndSubIdQueryReject request");

        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const currency = req.query["currency"] as string || null;
            const partySubIdOrType = req.params["subid"] as string || null;
            const errorInformation = req.body["errorInformation"] || null;

            if (!type || !id || !requesterFspId || !errorInformation) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return;
            }

            if(currency) { 
                this._validator.currencyAndAmount({ 
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: GetPartyQueryRejectedEvtPayload = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency,
                errorInformation: errorInformation
            };

            const msg = new GetPartyQueryRejectedEvt(msgPayload);

            msg.validatePayload();

            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getPartyByTypeAndIdAndSubIdQueryReject sent message");

            res.status(202).json(null);

            this.logger.debug("getPartyByTypeAndIdAndSubIdQueryReject responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                res.status(400).json(error.errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                res.status(500).json(transformError);
            }
            return;
        }
    }

}
