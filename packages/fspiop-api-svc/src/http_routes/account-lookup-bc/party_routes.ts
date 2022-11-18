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

 --------------
 ******/

 "use strict";
 import express from "express";
 import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
 import {Constants} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
 import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
 import { PartyQueryReceivedEvt, PartyQueryReceivedEvtPayload, ParticipantDisassociateRequestReceivedEvt, ParticipantAssociationRequestReceivedEvt, ParticipantAssociationRequestReceivedEvtPayload, ParticipantDisassociateRequestReceivedEvtPayload, PartyInfoAvailableEvt, PartyInfoAvailableEvtPayload} from "@mojaloop/platform-shared-lib-public-messages-lib";
 import { IncomingHttpHeaders } from "http";
 import { PutParty } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";
 
 const getEnabledHeaders = (headers: IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([headerKey]) => Constants.FSPIOP_REQUIRED_HEADERS_LIST.includes(headerKey)));
 
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
         this._router.get("/:type/:id/", this.getPartyQueryReceivedByTypeAndId.bind(this));
         // GET Parties by Type, ID & SubId
         this._router.get("/:type/:id/:subid", this.getPartyQueryReceivedByTypeAndIdSubId.bind(this));
         // PUT Party by Type & ID
         this._router.put("/:type/:id/", this.getPartyInfoAvailableByTypeAndId.bind(this));
         // PUT Parties by Type, ID & SubId
         this._router.put("/:type/:id/:subid", this.getPartyInfoAvailableByTypeAndIdAndSubId.bind(this));
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
 
     private async getPartyQueryReceivedByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got getPartyQueryReceivedByTypeAndId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
 
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId){
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
             currency: currency,
         };
 
         const msg =  new PartyQueryReceivedEvt(msgPayload);
 
         // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
         msg.fspiopOpaqueState = {
             requesterFspId: requesterFspId,
             destinationFspId: destinationFspId,
             headers: getEnabledHeaders(clonedHeaders)
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("getPartyQueryReceivedByTypeAndId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("getPartyQueryReceivedByTypeAndId responded");
     }
 
     private async getPartyQueryReceivedByTypeAndIdSubId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got getPartyQueryReceivedByTypeAndIdSubId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const partySubIdOrType = req.params["subid"] as string || null;
         const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const destinationFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
 
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId){
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
             headers: getEnabledHeaders(clonedHeaders)
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("getPartyQueryReceivedByTypeAndIdSubId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("getPartyQueryReceivedByTypeAndIdSubId responded");
     }
 
     private async getPartyInfoAvailableByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got getPartyInfoAvailableByTypeAndId request");
         console.log(JSON.stringify(req.headers));
 
         const putPartyBody: PutParty = req.body?.party;
         // TODO validate putPartyBody
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
         const ownerFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
 
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId || !ownerFspId){
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
             headers: getEnabledHeaders(clonedHeaders)
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("getPartyInfoAvailableByTypeAndId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("getPartyInfoAvailableByTypeAndId responded");
     }
 
     private async getPartyInfoAvailableByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got getPartyInfoAvailableByTypeAndIdAndSubId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const partySubIdOrType = req.params["subid"] as string || null;
         const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
         const ownerFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
 
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId || !ownerFspId){
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
             headers: getEnabledHeaders(clonedHeaders)
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("getPartyInfoAvailableByTypeAndIdAndSubId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("getPartyInfoAvailableByTypeAndIdAndSubId responded");
     }
 
     private async associatePartyByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got associatePartyByTypeAndId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId){
             res.status(400).json({
                 status: "not ok"
             });
             return;
         }
 
         const msgPayload: ParticipantAssociationRequestReceivedEvtPayload = {
             ownerFspId: requesterFspId,
             partyId: id,
             partyType: type,
             partySubType: null,
             currency: currency
         };
 
         const msg = new ParticipantAssociationRequestReceivedEvt(msgPayload);
 
         // this is an entry request (1st in the sequence), so carry over the fspiopOpaqueState to the next event
         msg.fspiopOpaqueState = {
             requesterFspId: requesterFspId,
             destinationFspId: null,
             headers: getEnabledHeaders(clonedHeaders)
 
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("associatePartyByTypeAndId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("associatePartyByTypeAndId responded");
     }
 
     private async associatePartyByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got associatePartyByTypeAndId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const partySubIdOrType = req.params["subid"] as string || null;
         const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId){
             res.status(400).json({
                 status: "not ok"
             });
             return;
         }
 
         const msgPayload: ParticipantAssociationRequestReceivedEvtPayload = {
             ownerFspId: requesterFspId,
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
             headers: getEnabledHeaders(clonedHeaders)
 
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("associatePartyByTypeAndId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("associatePartyByTypeAndId responded");
     }
 
     private async disassociatePartyByTypeAndId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got disassociatePartyByTypeAndId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId){
             res.status(400).json({
                 status: "not ok"
             });
             return;
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
             headers: getEnabledHeaders(clonedHeaders)
 
         };
 
         await this._kafkaProducer.send(msg);
 
         this._logger.debug("disassociatePartyByTypeAndId sent message");
 
         res.status(202).json({
             status: "ok"
         });
 
         this._logger.debug("disassociatePartyByTypeAndId responded");
     }
 
     private async disassociatePartyByTypeAndIdAndSubId(req: express.Request, res: express.Response): Promise<void> {
         this._logger.debug("Got disassociatePartyByTypeAndIdAndSubId request");
 
         const clonedHeaders = { ...req.headers };
         const type = req.params["type"] as string || null;
         const id = req.params["id"] as string || null;
         const partySubIdOrType = req.params["subid"] as string || null;
         const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
         const currency = req.query["currency"] as string || null;
 
         if(!type || !id || !requesterFspId){
             res.status(400).json({
                 status: "not ok"
             });
             return;
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
             headers: getEnabledHeaders(clonedHeaders)
         };
 
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
 