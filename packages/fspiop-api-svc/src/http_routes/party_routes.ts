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

"use strict"
import express from "express";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Constants} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {PartyQueryReceivedEvtPayload, PartyQueryReceivedEvt} from "@mojaloop/platform-shared-lib-public-messages-lib";

export class PartyRoutes {
    private _logger: ILogger;
    private _producerOptions: MLKafkaJsonProducerOptions;
    private _kafkaProducer: MLKafkaJsonProducer;
    private _kafkaTopic: string;

    private _router = express.Router();

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        this._logger = logger.createChild("PartyRoutes");
        this._producerOptions = producerOptions;
        this._kafkaTopic = kafkaTopic;
        
        this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);

        // bind routes

        // GET Party by Type & ID
        this._router.get("/:type/:id/", this.getPartyByTypeAndId.bind(this));
        // GET Parties by Type, ID & SubId
        this._router.get("/:type/:id/:subid", this.getPartyByTypeAndIdAndSubId.bind(this));
        // POST Associate Party Party by Type & ID
        this._router.post("/:type/:id/", this.associatePartyByTypeAndId.bind(this));
        // POST Associate Party Party by Type, ID & SubId
        this._router.post("/:type/:id/:subid", this.associatePartyByTypeAndIdAndSubId.bind(this));
        // DELETE Disassociate Party Party by Type & ID
        this._router.delete("/:type/:id/", this.disassociatePartyByTypeAndId.bind(this));
        // DELETE Disassociate Party Party by Type, ID & SubId
        this._router.delete("/:type/:id/:subid", this.disassociatePartyByTypeAndIdAndSubId.bind(this));
    }

    get Router(): express.Router {
        return this._router;
    }

    private async getPartyByTypeAndId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this._logger.debug("Got getPartyByTypeAndId request");

        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const requesterName = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        if(!type || !id || !requesterName){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterName,
            partyType: type,
            partyId: id,
            partySubType: null,
            currency: currency
        }

        const msg =  new PartyQueryReceivedEvt(msgPayload);

        await this._kafkaProducer.send(msg);

        this._logger.debug("getPartyByTypeAndId sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("getPartyByTypeAndId responded");
    }

    private async getPartyByTypeAndIdAndSubId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this._logger.debug("Got getPartyByTypeAndIdAndSubId request");

        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const partySubIdOrType = req.params["subid"] as string || null;
        const requesterName = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        if(!type || !id || !requesterName){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterName,
            partyType: type,
            partyId: id,
            partySubType: partySubIdOrType,
            currency: currency
        }

        const msg =  new PartyQueryReceivedEvt(msgPayload);

        await this._kafkaProducer.send(msg);

        this._logger.debug("getPartyByTypeAndIdAndSubId sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("getPartyByTypeAndIdAndSubId responded");
    }

    private async associatePartyByTypeAndId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this._logger.debug("Got associatePartyByTypeAndId request");

        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const requesterName = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        if(!type || !id || !requesterName){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterName,
            partyType: type,
            partyId: id,
            partySubType: null,
            currency: currency
        }

        const msg =  new PartyQueryReceivedEvt(msgPayload);

        await this._kafkaProducer.send(msg);

        this._logger.debug("associatePartyByTypeAndId sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("associatePartyByTypeAndId responded");
    }

    private async associatePartyByTypeAndIdAndSubId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this._logger.debug("Got associatePartyByTypeAndId request");

        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const partySubIdOrType = req.params["subid"] as string || null;
        const requesterName = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        if(!type || !id || !requesterName){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterName,
            partyType: type,
            partyId: id,
            partySubType: partySubIdOrType,
            currency: currency
        }

        const msg =  new PartyQueryReceivedEvt(msgPayload);

        await this._kafkaProducer.send(msg);

        this._logger.debug("associatePartyByTypeAndId sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("associatePartyByTypeAndId responded");
    }

    private async disassociatePartyByTypeAndId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this._logger.debug("Got disassociatePartyByTypeAndId request");

        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const requesterName = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        if(!type || !id || !requesterName){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterName,
            partyType: type,
            partyId: id,
            partySubType: null,
            currency: currency
        }

        const msg =  new PartyQueryReceivedEvt(msgPayload);

        await this._kafkaProducer.send(msg);

        this._logger.debug("disassociatePartyByTypeAndId sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("disassociatePartyByTypeAndId responded");
    }

    private async disassociatePartyByTypeAndIdAndSubId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this._logger.debug("Got disassociatePartyByTypeAndIdAndSubId request");

        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const partySubIdOrType = req.params["subid"] as string || null;
        const requesterName = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        if(!type || !id || !requesterName){
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: PartyQueryReceivedEvtPayload = {
            requesterFspId: requesterName,
            partyType: type,
            partyId: id,
            partySubType: partySubIdOrType,
            currency: currency
        }

        const msg =  new PartyQueryReceivedEvt(msgPayload);

        await this._kafkaProducer.send(msg);

        this._logger.debug("disassociatePartyByTypeAndIdAndSubId sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("disassociatePartyByTypeAndIdAndSubId responded");
    }

    async init(): Promise<void>{
        await this._kafkaProducer.connect();
    }

    async destroy(): Promise<void>{
        await this._kafkaProducer.destroy();
    }
}
