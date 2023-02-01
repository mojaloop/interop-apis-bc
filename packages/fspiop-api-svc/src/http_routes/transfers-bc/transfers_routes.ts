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

import express from "express";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { Constants } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { TransferPrepareRequestedEvt, TransferPrepareRequestedEvtPayload, TransferFulfilCommittedRequestedEvt, TransferFulfilCommittedRequestedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { IncomingHttpHeaders } from "http";
import { schemaValidator } from "../ajv";
import ajv from "ajv";
import { BaseRoutes } from "../_base_router";

const getEnabledHeaders = (headers: IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([headerKey]) => Constants.FSPIOP_REQUIRED_HEADERS_LIST.includes(headerKey)));

export class TransfersRoutes extends BaseRoutes {

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        super(producerOptions, kafkaTopic, logger);

        // bind routes
        
        // POST Transfers
        this.router.post("/", this.transferPrepareRequested.bind(this));

        // PUT Transfers
        this.router.put("/:id", this.transferFulfilCommittedRequested.bind(this));
    }

    private async transferPrepareRequested(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got transferPrepareRequested request");
        
        // const validate = schemaValidator.getSchema("TransfersPostRequest") as ajv.ValidateFunction;
        // const valid = validate(req.body);
        
        // if (!valid) {
        //     this.logger.error(validate.errors);

        //     this.logger.debug(`transferPrepareRequested body errors: ${JSON.stringify(validate.errors)}`);

        //     res.status(422).json({
        //         status: "invalid request body",
        //         errors: validate.errors
        //     });
        //     return;
        // }
          
        // Headers
        const clonedHeaders = { ...req.headers };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        
        // Date Model
        const transferId = req.body["transferId"] || null;
        const payeeFsp = req.body["payeeFsp"] || null;
        const payerFsp = req.body["payerFsp"] || null;
        const amount = req.body["amount"] || null;
        const ilpPacket = req.body["ilpPacket"] || null;
        const condition = req.body["condition"] || null;
        const expiration = req.body["expiration"] || null;
        const extensionList = req.body["extensionList"] || null;


        if(!transferId || !payeeFsp || !payerFsp || !amount || !ilpPacket || !condition || !expiration) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: TransferPrepareRequestedEvtPayload = {
            transferId: transferId,
            payeeFsp: payeeFsp,
            payerFsp: payerFsp,
            amount: amount,
            ilpPacket: ilpPacket,
            condition: condition,
            expiration: expiration,
            extensionList: extensionList
        };

        const msg =  new TransferPrepareRequestedEvt(msgPayload);

        // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
        // we can use the builtin method of validatePayload of the evt messages to make sure consistency 
        // is shared between both
        msg.validatePayload();

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: getEnabledHeaders(clonedHeaders)
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("transferPrepareRequested sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("transferPrepareRequested responded");
    }

    private async transferFulfilCommittedRequested(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got transferFulfilCommittedRequested request");
        
        // const validate = schemaValidator.getSchema("TransfersPostRequest") as ajv.ValidateFunction;
        // const valid = validate(req.body);
        
        // if (!valid) {
        //     this.logger.error(validate.errors);

        //     this.logger.debug(`transferFulfilCommittedRequested body errors: ${JSON.stringify(validate.errors)}`);

        //     res.status(422).json({
        //         status: "invalid request body",
        //         errors: validate.errors
        //     });
        //     return;
        // }
          
        // Headers
        const clonedHeaders = { ...req.headers };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        
        // Date Model
        const transferId = req.params["id"] as string || null;
        const transferState = req.body["transferState"] || null;
        const fulfilment = req.body["fulfilment"] || null;
        const completedTimestamp = req.body["completedTimestamp"] || null;
        const extensionList = req.body["extensionList"] || null;


        if(!transferId || !transferState) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: TransferFulfilCommittedRequestedEvtPayload = {
            transferId: transferId,
            transferState: transferState,
            fulfilment: fulfilment,
            completedTimestamp: completedTimestamp,
            extensionList: extensionList
        };

        const msg =  new TransferFulfilCommittedRequestedEvt(msgPayload);

        // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
        // we can use the builtin method of validatePayload of the evt messages to make sure consistency 
        // is shared between both
        msg.validatePayload();

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: getEnabledHeaders(clonedHeaders)
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("transferFulfilCommittedRequested sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("transferFulfilCommittedRequested responded");
    }
}
