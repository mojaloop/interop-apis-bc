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
 import { MLKafkaJsonProducer, MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
 import { QuoteRequestReceivedEvt, QuoteRequestReceivedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
 import { IncomingHttpHeaders } from "http";
import { schemaValidator } from "../ajv";
import ajv from "ajv"

 const getEnabledHeaders = (headers: IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([headerKey]) => Constants.FSPIOP_REQUIRED_HEADERS_LIST.includes(headerKey)));
 
export interface IParty {
    id: string;
    type: string;
    currency: string | null;
    subId: string | null;
}

 export class QuoteRoutes {
    private _logger: ILogger;
    private _producerOptions: MLKafkaJsonProducerOptions;
    private _kafkaProducer: MLKafkaJsonProducer;
    private _kafkaTopic: string;

    private _router = express.Router();

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        this._logger = logger.createChild("QuotesRoutes");
        this._producerOptions = producerOptions;
        this._kafkaTopic = kafkaTopic;
        this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);

        // bind routes

        // POST Quote Calculation
        this._router.post("/", this.createQuoteCalculation.bind(this));
    }

    get Router(): express.Router {
        return this._router;
    }
    
    private async createQuoteCalculation(req: express.Request, res: express.Response): Promise<void> {
        this._logger.debug("Got createQuoteCalculation request");
        
        const validate = schemaValidator.getSchema("QuotesPostRequest") as ajv.ValidateFunction;
        const valid = validate(req.body);
        
        if (!valid) {
            this._logger.error(validate.errors)

            this._logger.debug(`createQuoteCalculation body errors: ${JSON.stringify(validate.errors)}`);

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
        const quoteId = req.body["quoteId"] as string || null;
        const transactionId = req.body["transactionId"] as string || null;
        const transactionRequestId = req.body["transactionRequestId"] as string || null;
        const payee = req.body["payee"] as string || null;
        const payer = req.body["payer"] as string || null;
        const amountType = req.body["amountType"] as string || null;
        const amount = req.body["amount"] as string || null;
        const fees = req.body["fees"] as string || null;
        const transactionType = req.body["transactionType"] as string || null;
        const geoCode = req.body["geoCode"] as string || null;
        const note = req.body["note"] as string || null;
        const expiration = req.body["expiration"] as string || null;
        const extensionList = req.body["extensionList"] as string || null;

        if(!requesterFspId || !destinationFspId || !quoteId || !transactionId || !payee || !payer || !amountType || !amount || !transactionType) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: QuoteRequestReceivedEvtPayload = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            quoteId: quoteId,
            transactionId: transactionId,
            transactionRequestId: transactionRequestId,
            payee: payee,
            payer: payer,
            amountType: amountType,
            amount: amount,
            fees: fees,
            transactionType: transactionType,
            geoCode: geoCode,
            note: note,
            expiration: expiration,
            extensionList: extensionList,
        };

        const msg =  new QuoteRequestReceivedEvt(msgPayload);

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: getEnabledHeaders(clonedHeaders)
        };

        await this._kafkaProducer.send(msg);

        this._logger.debug("createQuoteCalculation sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("createQuoteCalculation responded");
    }


    async init(): Promise<void>{
        await this._kafkaProducer.connect();
    }

    async destroy(): Promise<void>{
        await this._kafkaProducer.destroy();
    }
 }
 