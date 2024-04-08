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

import { 
    BulkQuotePendingReceivedEvt,
    BulkQuotePendingReceivedEvtPayload,
    BulkQuoteQueryReceivedEvt,
    BulkQuoteQueryReceivedEvtPayload,
    BulkQuoteRequestedEvt,
    BulkQuoteRequestedEvtPayload,
    GetBulkQuoteQueryRejectedEvt,
    GetBulkQuoteQueryRejectedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { 
    Constants,
    FspiopJwsSignature, 
    FspiopValidator,
    Transformer,
    ValidationdError
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { BaseRoutes } from "../_base_router";
import { FSPIOPErrorCodes } from "../../validation";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { 
    BulkQuotePendingDTO,
    BulkQuoteQueryReceivedDTO,
    BulkQuoteRejectRequestDTO,
    BulkQuoteRequestDTO 
} from "./bulk_quote_routes_dto";

export class QuoteBulkRoutes extends BaseRoutes {

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        logger: ILogger
    ) {
        super(producer, validator, jwsHelper, logger);
    }

    public bindRoutes: FastifyPluginAsync = async (fastify, opts) => {
        // GET Bulk Quote by ID
        fastify.get("/:id", this.bulkQuoteQueryReceived.bind(this));

        // POST Bulk Quote Calculation
        fastify.post("/", this.bulkQuoteRequest.bind(this));

        // PUT Bulk Quote Created
        fastify.put("/:id", this.bulkQuotePending.bind(this));

        // Errors
        fastify.put("/:id/error", this.bulkQuoteRejectRequest.bind(this));
    };

    private async bulkQuoteQueryReceived(req: FastifyRequest<BulkQuoteQueryReceivedDTO>, reply: FastifyReply): Promise<void> {
        try {
            this.logger.debug("Got bulkQuoteQueryReceived request");

            // Headers
            const clonedHeaders = { ...req.headers };
            const bulkQuoteId = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            if (!bulkQuoteId || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            const msgPayload: BulkQuoteQueryReceivedEvtPayload = {
                bulkQuoteId: bulkQuoteId,
            };

            const msg = new BulkQuoteQueryReceivedEvt(msgPayload);

            msg.validatePayload();

            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("bulkQuoteQueryReceived sent message");

            reply.code(202).send(null);

            this.logger.debug("bulkQuoteQueryReceived responded");

        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });
            reply.code(500).send(transformError);
        }
    }

    private async bulkQuoteRequest(req: FastifyRequest<BulkQuoteRequestDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulkQuoteRequest request");
        try {
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

            //TODO: validate ilpPacket

            if (!requesterFspId || !bulkQuoteId || !payer || !individualQuotes) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            for(let i=0 ; i<individualQuotes.length ; i+=1) {
                this._validator.currencyAndAmount(individualQuotes[i].amount);
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: BulkQuoteRequestedEvtPayload = {
                bulkQuoteId: bulkQuoteId,
                payer: payer,
                geoCode: geoCode,
                expiration: expiration,
                individualQuotes: individualQuotes,
                extensionList: extensionList,
            } as BulkQuoteRequestedEvtPayload;

            const msg = new BulkQuoteRequestedEvt(msgPayload);

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

            this.logger.debug("bulkQuoteRequest sent message");

            reply.code(202).send(null);

            this.logger.debug("bulkQuoteRequest responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            return;
        }
    }

    private async bulkQuotePending(req: FastifyRequest<BulkQuotePendingDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulkQuotePending request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const bulkQuoteId = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const expiration = req.body["expiration"] || null;
            const individualQuoteResults = req.body["individualQuoteResults"] || null;
            const extensionList = req.body["extensionList"] || null;

            if (!bulkQuoteId || !requesterFspId || !individualQuoteResults) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            for(let i=0 ; i<individualQuoteResults.length ; i+=1) {
                if(individualQuoteResults[i].transferAmount) {
                    this._validator.currencyAndAmount(individualQuoteResults[i].transferAmount);
                }
                if(individualQuoteResults[i].payeeReceiveAmount) {
                    this._validator.currencyAndAmount(individualQuoteResults[i].payeeReceiveAmount);
                }
                if(individualQuoteResults[i].payeeFspCommission) {
                    this._validator.currencyAndAmount(individualQuoteResults[i].payeeFspCommission);
                }
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: BulkQuotePendingReceivedEvtPayload = {
                bulkQuoteId: bulkQuoteId,
                expiration: expiration,
                individualQuoteResults: individualQuoteResults,
                extensionList: extensionList,
            } as BulkQuotePendingReceivedEvtPayload;

            const msg = new BulkQuotePendingReceivedEvt(msgPayload);

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

            this.logger.debug("bulkQuotePending sent message");

            reply.code(202).send(null);

            this.logger.debug("bulkQuotePending responded");

        } catch (error: unknown) {
            if(error instanceof ValidationdError) {
                reply.code(400).send((error as ValidationdError).errorInformation);
            } else {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                    errorDescription: (error as Error).message,
                    extensionList: null
                });
                reply.code(500).send(transformError);
            }
            return;
        }
    }

    private async bulkQuoteRejectRequest(req: FastifyRequest<BulkQuoteRejectRequestDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulk quote rejected request");

        try{
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            const bulkQuoteId = req.params["id"] as string || null;
            const errorInformation = req.body["errorInformation"] || null;

            if(!bulkQuoteId || !errorInformation || !requesterFspId) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: GetBulkQuoteQueryRejectedEvtPayload = {
                bulkQuoteId: bulkQuoteId,
                errorInformation: errorInformation
            };

            const msg =  new GetBulkQuoteQueryRejectedEvt(msgPayload);

            msg.validatePayload();

            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("bulk quote rejected sent message");

            reply.code(202).send({
                status: "ok"
            });

            this.logger.debug("bulk quote rejected responded");

        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }
}
