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
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Constants} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { IncomingHttpHeaders } from "http";
import ajv from "ajv";
import { schemaValidator } from "../ajv";
import { BulkQuotePendingReceivedEvt, BulkQuotePendingReceivedEvtPayload, BulkQuoteRequestedEvt, BulkQuoteRequestedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { BaseRoutes } from "../_base_router";

const getEnabledHeaders = (headers: IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([headerKey]) => Constants.FSPIOP_REQUIRED_HEADERS_LIST.includes(headerKey)));
 
export class QuoteBulkRoutes extends BaseRoutes {

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        super(producerOptions, kafkaTopic, logger);

        // bind routes
 
        // // GET Quote by ID
        // this.router.get("/:id/", this.quoteQueryReceived.bind(this));
        
        // POST Quote Calculation
        this.router.post("/", this.bulkQuoteRequest.bind(this));

        // PUT Quote Created
        this.router.put("/:id", this.bulkQuotePending.bind(this));
    }

    get Router(): express.Router {
        return this.router;
    }

    
    private async bulkQuoteRequest(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got bulkQuoteRequest request");
        
        const validate = schemaValidator.getSchema("BulkQuotesPostRequest") as ajv.ValidateFunction;
        const valid = validate(req.body);
        
        if (!valid) {
            this.logger.error(validate.errors);

            this.logger.debug(`bulkQuoteRequest body errors: ${JSON.stringify(validate.errors)}`);

            res.status(422).json({
                status: "invalid request body",
                errors: validate.errors
            });
            return;
        }
          
        // Headers
        const clonedHeaders = { ...req.headers };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        
        // Date Model
        const bulkQuoteId = req.body["bulkQuoteId"] || null;
        const payer = req.body["payer"] || null;
        const geoCode = req.body["geoCode"] || null;
        const expiration = req.body["expiration"] || null;
        const individualQuotes = req.body["individualQuotes"] || null;
        const extensionList = req.body["extensionList"] || null;

        if(!requesterFspId || !bulkQuoteId || !payer || !individualQuotes) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }
        
        const msgPayload: BulkQuoteRequestedEvtPayload = {
            bulkQuoteId: bulkQuoteId,
            payer: payer,
            geoCode: geoCode,
            expiration: expiration,
            individualQuotes: individualQuotes,
            extensionList: extensionList,
        } as BulkQuoteRequestedEvtPayload;

        const msg =  new BulkQuoteRequestedEvt(msgPayload);

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

        this.logger.debug("bulkQuoteRequest sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("bulkQuoteRequest responded");
    }

    private async bulkQuotePending(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got bulkQuotePending request");
        
        const validate = schemaValidator.getSchema("BulkQuotesIDPutResponse") as ajv.ValidateFunction;
        const valid = validate(req.body);
        
        if (!valid) {
            this.logger.error(validate.errors);

            this.logger.debug(`bulkQuotePending body errors: ${JSON.stringify(validate.errors)}`);

            // TODO: Check what's wrong with the complexName returned from the TTK
            // res.status(422).json({
            //     status: "invalid request body",
            //     errors: validate.errors
            // });
            // return;
        }
          
        // Headers
        const clonedHeaders = { ...req.headers };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        
        // Date Model
        const expiration = req.body["expiration"] || null;
        const individualQuoteResults = req.body["individualQuoteResults"] || null;
        const extensionList = req.body["extensionList"] || null;

        if(!requesterFspId || !individualQuoteResults) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }
        
        const msgPayload: BulkQuotePendingReceivedEvtPayload = {
            expiration: expiration,
            individualQuoteResults: individualQuoteResults,
            extensionList: extensionList,
        };

        const msg =  new BulkQuotePendingReceivedEvt(msgPayload);

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

        this.logger.debug("bulkQuotePending sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("bulkQuotePending responded");
    }
}
 