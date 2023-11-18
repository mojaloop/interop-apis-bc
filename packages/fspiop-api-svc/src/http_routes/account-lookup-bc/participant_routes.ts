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
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ParticipantQueryReceivedEvtPayload, ParticipantQueryReceivedEvt, ParticipantDisassociateRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvtPayload, ParticipantAssociationRequestReceivedEvt, ParticipantAssociationRequestReceivedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { BaseRoutes } from "../_base_router";
import { FSPIOPErrorCodes } from "../../validation";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";

export class ParticipantRoutes extends BaseRoutes {

    constructor(
        configClient: IConfigurationClient,
        producer: IMessageProducer,
        logger: ILogger
    ) {
        super(configClient, producer, logger);

        // bind routes

        // GET Participant by Type & ID
        this.router.get("/:type/:id/", this.getParticipantsByTypeAndID.bind(this));
        // GET Participants by Type, ID & SubId
        this.router.get("/:type/:id/:subid", this.getParticipantsByTypeAndIDAndSubId.bind(this));
        // POST Associate Party Party by Type & ID
        this.router.post("/:type/:id/", this.associatePartyByTypeAndId.bind(this));
        // POST Associate Party Party by Type, ID & SubId
        this.router.post("/:type/:id/:subid", this.associatePartyByTypeAndIdAndSubId.bind(this));
        // DELETE Disassociate Party Party by Type & ID
        this.router.delete("/:type/:id/", this.disassociatePartyByTypeAndId.bind(this));
        // DELETE Disassociate Party Party by Type, ID & SubId
        this.router.delete("/:type/:id/:subid", this.disassociatePartyByTypeAndIdAndSubId.bind(this));
    }

    get Router(): express.Router {
        return this.router;
    }

    private async getParticipantsByTypeAndID(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this.logger.debug("Got getParticipantsByTypeAndID request");
        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

            const currency = req.query["currency"] as string || null;

            if (!type || !id || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                res.status(400).json(transformError);
                return next();
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: ParticipantQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                partyType: type,
                partyId: id,
                partySubType: null,
                currency: currency
            };

            const msg = new ParticipantQueryReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: null,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getParticipantsByTypeAndID sent message");

            res.status(202).json(null);

            this.logger.debug("getParticipantsByTypeAndID responded");

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

    private async getParticipantsByTypeAndIDAndSubId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this.logger.debug("Got getParticipantsByTypeAndIDAndSubId request");
        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const partySubIdOrType = req.params["subid"] as string || null;
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

            const currency = req.query["currency"] as string || null;

            if (!type || !id || !requesterFspId || !partySubIdOrType) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });


                res.status(400).json(transformError);
                return next();
            }

            if(currency) {
                this._validator.currencyAndAmount({
                    currency: currency,
                    amount: null
                });
            }

            const msgPayload: ParticipantQueryReceivedEvtPayload = {
                requesterFspId: requesterFspId,
                partyType: type,
                partyId: id,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new ParticipantQueryReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: null,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("getParticipantsByTypeAndIDAndSubId sent message");

            res.status(202).json(null);

            this.logger.debug("getParticipantsByTypeAndIDAndSubId responded");

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

    private async associatePartyByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got associatePartyByTypeAndId request");
        try {
            const clonedHeaders = { ...req.headers };
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const ownerFspId = req.body["fspId"] as string || null;
            const currency = req.body["currency"] as string || null;

            if (!type || !id || !ownerFspId || !requesterFspId) {
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

            const msgPayload: ParticipantAssociationRequestReceivedEvtPayload = {
                ownerFspId: ownerFspId,
                partyId: id,
                partyType: type,
                partySubType: null,
                currency: currency,
            };

            const msg = new ParticipantAssociationRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: null,
                headers: clonedHeaders

            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("associatePartyByTypeAndId sent message");

            res.status(202).json(null);

            this.logger.debug("associatePartyByTypeAndId responded");

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

    private async associatePartyByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got associatePartyByTypeAndId request");
        try {
            const clonedHeaders = { ...req.headers };
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const partySubIdOrType = req.params["subid"] as string || null;
            const ownerFspId = req.body["fspId"] as string || null;
            const currency = req.body["currency"] as string || null;

            if (!type || !id || !ownerFspId || !requesterFspId) {
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

            const msgPayload: ParticipantAssociationRequestReceivedEvtPayload = {
                ownerFspId: ownerFspId,
                partyId: id,
                partyType: type,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new ParticipantAssociationRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: null,
                headers: clonedHeaders

            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("associatePartyByTypeAndId sent message");

            res.status(202).json(null);

            this.logger.debug("associatePartyByTypeAndId responded");

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

    private async disassociatePartyByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got disassociatePartyByTypeAndId request");
        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
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

            const msgPayload: ParticipantDisassociateRequestReceivedEvtPayload = {
                ownerFspId: requesterFspId,
                partyId: id,
                partyType: type,
                partySubType: null,
                currency: currency
            };

            const msg = new ParticipantDisassociateRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: null,
                headers: clonedHeaders

            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("disassociatePartyByTypeAndId sent message");

            res.status(202).json(null);

            this.logger.debug("disassociatePartyByTypeAndId responded");

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

    private async disassociatePartyByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got disassociatePartyByTypeAndIdAndSubId request");
        try {
            const clonedHeaders = { ...req.headers };
            const type = req.params["type"] as string || null;
            const id = req.params["id"] as string || null;
            const partySubIdOrType = req.params["subid"] as string || null;
            const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
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

            const msgPayload: ParticipantDisassociateRequestReceivedEvtPayload = {
                ownerFspId: requesterFspId,
                partyId: id,
                partyType: type,
                partySubType: partySubIdOrType,
                currency: currency
            };

            const msg = new ParticipantDisassociateRequestReceivedEvt(msgPayload);

            // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: null,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("disassociatePartyByTypeAndIdAndSubId sent message");

            res.status(202).json(null);

            this.logger.debug("disassociatePartyByTypeAndIdAndSubId responded");
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
