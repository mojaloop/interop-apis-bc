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
import { Constants, Validate } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { PartyQueryReceivedEvt, PartyQueryReceivedEvtPayload, PartyInfoAvailableEvt, PartyInfoAvailableEvtPayload} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { PutParty } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";
import { BaseRoutes } from "../_base_router";
import { PartiesPutTypeAndIdAndSubId } from "../../errors";

export class PartyRoutes extends BaseRoutes {

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        super(producerOptions, kafkaTopic, logger);

        // bind routes

        // Requests
        // GET Party by Type & ID
        this.router.get("/:type/:id/", this.getPartyQueryReceivedByTypeAndId.bind(this));
        // GET Parties by Type, ID & SubId
        this.router.get("/:type/:id/:subid", this.getPartyQueryReceivedByTypeAndIdSubId.bind(this));

        // Callbacks
        // PUT Party by Type & ID
        this.router.put("/:type/:id/", this.getPartyInfoAvailableByTypeAndId.bind(this));
        // PUT Parties by Type, ID & SubId
        this.router.put("/:type/:id/:subid", this.getPartyInfoAvailableByTypeAndIdAndSubId.bind(this));
    }

    private async getPartyQueryReceivedByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyQueryReceivedByTypeAndId request");

        const clonedHeaders = { ...req.headers };
        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        const currency = req.query["currency"] as string || null;

        const isValidHeaders = Validate.validateHeaders(Constants.RequiredHeaders.parties, clonedHeaders);

        if(!isValidHeaders || !type || !id || !requesterFspId){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            partyType: type,
            partyId: id,
            partySubType: null,
            currency: "USD",
        };

        const msg =  new PartyQueryReceivedEvt(msgPayload);

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
    }

    private async getPartyQueryReceivedByTypeAndIdSubId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyQueryReceivedByTypeAndIdSubId request");

        const clonedHeaders = { ...req.headers };
        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const partySubIdOrType = req.params["subid"] as string || null;
        const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const currency = req.query["currency"] as string || null;

        const isValidHeaders = Validate.validateHeaders(Constants.RequiredHeaders.parties, clonedHeaders);

        if(!isValidHeaders || !type || !id || !requesterFspId){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            partyType: type,
            partyId: id,
            partySubType: partySubIdOrType,
            currency: currency
        };

        const msg =  new PartyQueryReceivedEvt(msgPayload);

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
    }

    private async getPartyInfoAvailableByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyInfoAvailableByTypeAndId request");
        console.log(JSON.stringify(req.headers));

        const putPartyBody: PutParty = req.body?.party;

        const clonedHeaders = { ...req.headers };
        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const ownerFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const currency = req.query["currency"] as string || null;

        const isValidHeaders = Validate.validateHeaders(PartiesPutTypeAndIdAndSubId, clonedHeaders);

        if(!isValidHeaders || !type || !id || !requesterFspId || !ownerFspId){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyInfoAvailableEvtPayload = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            ownerFspId: ownerFspId,
            partyType: type,
            partyId: id,
            partySubType: null,
            currency: currency,
            partyName: `${putPartyBody?.personalInfo?.complexName?.firstName} ${putPartyBody?.personalInfo?.complexName?.lastName}`,
            partyDoB: putPartyBody?.personalInfo?.dateOfBirth
        };


        const msg =  new PartyInfoAvailableEvt(msgPayload);

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
    }

    private async getPartyInfoAvailableByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got getPartyInfoAvailableByTypeAndIdAndSubId request");

        const clonedHeaders = { ...req.headers };
        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const partySubIdOrType = req.params["subid"] as string || null;
        const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        const ownerFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const currency = req.query["currency"] as string || null;

        const isValidHeaders = Validate.validateHeaders(Constants.RequiredHeaders.parties, clonedHeaders);

        if(!isValidHeaders || !type || !id || !requesterFspId || !ownerFspId){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyInfoAvailableEvtPayload = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            ownerFspId: ownerFspId,
            partyType: type,
            partyId: id,
            partySubType: partySubIdOrType,
            currency: currency,
            partyName: 'partynmame',
            partyDoB: new Date(),
        };

        const msg =  new PartyInfoAvailableEvt(msgPayload);

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
    }
}
