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
import { QuoteRequestReceivedEvt, QuoteRequestReceivedEvtPayload, QuoteResponseReceivedEvt, QuoteResponseReceivedEvtPayload, QuoteQueryReceivedEvt, QuoteQueryReceivedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { schemaValidator } from "../ajv";
import ajv from "ajv";
import { BaseRoutes } from "../_base_router";

export class QuoteRoutes extends BaseRoutes {

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        super(producerOptions, kafkaTopic, logger);

        // bind routes

        // GET Quote by ID
        this.router.get("/:id/", this.quoteQueryReceived.bind(this));
        
        // POST Quote Calculation
        this.router.post("/", this.quoteRequestReceived.bind(this));

        // PUT Quote Created
        this.router.put("/:id", this.quoteResponseReceived.bind(this));
    }

    private async quoteRequestReceived(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got quoteRequestReceived request");
        
        const validate = schemaValidator.getSchema("QuotesPostRequest") as ajv.ValidateFunction;
        const valid = validate(req.body);
        
        if (!valid) {
            this.logger.error(validate.errors);

            this.logger.debug(`quoteRequestReceived body errors: ${JSON.stringify(validate.errors)}`);

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
        const quoteId = req.body["quoteId"] || null;
        const transactionId = req.body["transactionId"] || null;
        const transactionRequestId = req.body["transactionRequestId"] || null;
        const payee = req.body["payee"] || null;
        const payer = req.body["payer"] || null;
        const amountType = req.body["amountType"] || null;
        const amount = req.body["amount"] || null;
        const fees = req.body["fees"] || null;
        const transactionType = req.body["transactionType"] || null;
        const geoCode = req.body["geoCode"] || null;
        const note = req.body["note"] || null;
        const expiration = req.body["expiration"] || null;
        const extensionList = req.body["extensionList"] || null;

        if(!requesterFspId || !quoteId || !transactionId || !payee || !payer || !amountType || !amount || !transactionType) {
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
        } as QuoteRequestReceivedEvtPayload;

        const msg =  new QuoteRequestReceivedEvt(msgPayload);

        // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
        // we can use the builtin method of validatePayload of the evt messages to make sure consistency 
        // is shared between both
        msg.validatePayload();

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: clonedHeaders
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("quoteRequestReceived sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("quoteRequestReceived responded");
    }

    private async quoteResponseReceived(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got quoteResponseReceived request");
        
        const validate = schemaValidator.getSchema("QuotesIDPutResponse") as ajv.ValidateFunction;
        const valid = validate(req.body);
        
        if (!valid) {
            this.logger.error(validate.errors);

            this.logger.debug(`quoteResponseReceived body errors: ${JSON.stringify(validate.errors)}`);

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
        const quoteId = req.params["id"] || null;
        const transferAmount = req.body["transferAmount"] || null;
        const expiration = req.body["expiration"] || null;
        const ilpPacket = req.body["ilpPacket"] || null;
        const condition = req.body["condition"] || null;
        const payeeReceiveAmount = req.body["payeeReceiveAmount"] || null;
        const payeeFspFee = req.body["payeeFspFee"] || null;
        const payeeFspCommission = req.body["payeeFspCommission"] || null;
        const geoCode = req.body["geoCode"] || null;
        const extensionList = req.body["extensionList"] || null;


        if(!requesterFspId || !quoteId || !transferAmount || !expiration || !ilpPacket || !condition) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: QuoteResponseReceivedEvtPayload = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            quoteId: quoteId,
            transferAmount: transferAmount,
            expiration: expiration,
            ilpPacket: ilpPacket,
            condition: condition,
            payeeReceiveAmount: payeeReceiveAmount,
            payeeFspFee: payeeFspFee,
            payeeFspCommission: payeeFspCommission,
            geoCode: geoCode,
            extensionList: extensionList
        } as QuoteResponseReceivedEvtPayload;

        const msg =  new QuoteResponseReceivedEvt(msgPayload);

        // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
        // we can use the builtin method of validatePayload of the evt messages to make sure consistency 
        // is shared between both 
        msg.validatePayload();

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: clonedHeaders
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("quoteResponseReceived sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("quoteResponseReceived responded");
    }

    private async quoteQueryReceived(req: express.Request, res: express.Response): Promise<void> {
        this.logger.debug("Got quoteQueryReceived request");

        const clonedHeaders = { ...req.headers };
        const quoteId = req.params["id"] as string || null;
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

        if(!quoteId || !requesterFspId) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        const msgPayload: QuoteQueryReceivedEvtPayload = {
            quoteId: quoteId,
        };

        const msg =  new QuoteQueryReceivedEvt(msgPayload);

        msg.validatePayload();

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: clonedHeaders
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("quoteQueryReceived sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("quoteQueryReceived responded");
    }
}
