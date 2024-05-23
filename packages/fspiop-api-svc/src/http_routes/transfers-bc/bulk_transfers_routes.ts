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
    BulkTransferQueryReceivedEvt,
    BulkTransferQueryReceivedEvtPayload,
    BulkTransferPrepareRequestedEvt,
    BulkTransferPrepareRequestedEvtPayload,
    BulkTransferFulfilRequestedEvt,
    BulkTransferFulfilRequestedEvtPayload,
    BulkTransferRejectRequestedEvt,
    BulkTransferRejectRequestedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {
    Constants,
    FspiopJwsSignature,
    FspiopValidator,
    Transformer,
    ValidationdError,
    decodeIlpPacket,
    PostQuote
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { FSPIOPErrorCodes } from "../validation";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {IMetrics} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {FastifyInstance, FastifyPluginAsync, FastifyPluginOptions, FastifyReply, FastifyRequest} from "fastify";
import {
    BulkTransferFulfilRequestedDTO,
    BulkTransferPrepareRequestDTO,
    BulkTransferQueryReceivedDTO,
    BulkTransfersRejectRequestDTO
} from "./bulk_transfers_routes_dto";
import {BaseRoutesFastify} from "../_base_routerfastify";

export class TransfersBulkRoutes extends BaseRoutesFastify {

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        metrics: IMetrics,
        logger: ILogger
    ) {
        super(producer, validator, jwsHelper, metrics, logger);
    }

    public async bindRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void>{
        // bind common hooks like content-type validation and tracing extraction
        this._addHooks(fastify);

        // GET Bulk Transfers by ID
        fastify.get("/:id", this.bulkTransferQueryReceived.bind(this));

        // POST Bulk Transfers Calculation
        fastify.post("/", this.bulkTransferPrepareRequest.bind(this));

        // PUT Bulk Transfers Created
        fastify.put("/:id", this.bulkTransferFulfilRequested.bind(this));

        // Errors
        fastify.put("/:id/error", this.bulkTransfersRejectRequest.bind(this));
    }

    private async bulkTransferQueryReceived(req: FastifyRequest<BulkTransferQueryReceivedDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulkTransferQueryReceived request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const bulkTransfersId = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            if (!bulkTransfersId || !requesterFspId) {
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

            const msgPayload: BulkTransferQueryReceivedEvtPayload = {
                bulkTransferId: bulkTransfersId,
            };

            const msg = new BulkTransferQueryReceivedEvt(msgPayload);

            msg.validatePayload();

            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("bulkTransferQueryReceived sent message");

            reply.code(202).send(null);

            this.logger.debug("bulkTransferQueryReceived responded");

        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });
            reply.code(500).send(transformError);
        }
    }

    private async bulkTransferPrepareRequest(req: FastifyRequest<BulkTransferPrepareRequestDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulkTransfersRequest request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const bulkTransferId = req.body["bulkTransferId"] || null;
            const bulkQuoteId = req.body["bulkQuoteId"] || null;
            const payerFsp = req.body["payerFsp"] || null;
            const payeeFsp = req.body["payeeFsp"] || null;
            const expiration = req.body["expiration"];
            const individualTransfers = req.body["individualTransfers"] || null;
            const extensionList = req.body["extensionList"] || null;

            //TODO: validate ilpPacket

            if (!requesterFspId || !bulkTransferId || !bulkQuoteId || !payerFsp || !payeeFsp || !individualTransfers) {
                const transformError = Transformer.transformPayloadError({
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
                    extensionList: null
                });

                reply.code(400).send(transformError);
                return;
            }

            for(let i=0 ; i<individualTransfers.length ; i+=1) {
                this._validator.currencyAndAmount(individualTransfers[i].transferAmount);
            }

            if(this._jwsHelper.isEnabled()) {
                this._jwsHelper.validate(req.headers, req.body);
            }

            const msgPayload: BulkTransferPrepareRequestedEvtPayload = {
                bulkTransferId: bulkTransferId,
                bulkQuoteId: bulkQuoteId,
                payerFsp: payerFsp,
                payeeFsp: payeeFsp,
                expiration: expiration,
                individualTransfers: individualTransfers.map((individualTransfer:BulkTransferPrepareRequestedEvtPayload["individualTransfers"][number]) => {
                    const decodedIlpPacket:PostQuote = decodeIlpPacket(individualTransfer.ilpPacket);

                    individualTransfer.payerIdType = decodedIlpPacket.payer.partyIdInfo.partyIdType;
                    individualTransfer.payeeIdType = decodedIlpPacket.payee.partyIdInfo.partyIdType;
                    individualTransfer.transferType = decodedIlpPacket.transactionType.scenario;

                    return individualTransfer;
                }),
                extensionList: extensionList
            };

            const msg = new BulkTransferPrepareRequestedEvt(msgPayload);

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

            this.logger.debug("bulkTransfersRequest sent message");

            reply.code(202).send(null);

            this.logger.debug("bulkTransfersRequest responded");

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

    private async bulkTransferFulfilRequested(req: FastifyRequest<BulkTransferFulfilRequestedDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulkTransferFulfilRequested request");
        try {
            // Headers
            const clonedHeaders = { ...req.headers };
            const bulkTransferId = req.params["id"] as string || null;
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            // Date Model
            const completedTimestamp = req.body["completedTimestamp"];
            const bulkTransferState = req.body["bulkTransferState"] || null;
            const individualTransferResults = req.body["individualTransferResults"] || null;
            const extensionList = req.body["extensionList"] || null;

            if (!bulkTransferId || !requesterFspId || !individualTransferResults) {
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

            const msgPayload: BulkTransferFulfilRequestedEvtPayload = {
                bulkTransferId: bulkTransferId,
                completedTimestamp: completedTimestamp,
                bulkTransferState: bulkTransferState,
                individualTransferResults: individualTransferResults,
                extensionList: extensionList,
            };

            const msg = new BulkTransferFulfilRequestedEvt(msgPayload);

            msg.validatePayload();

            // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("bulkTransferFulfilRequested sent message");

            reply.code(202).send(null);

            this.logger.debug("bulkTransferFulfilRequested responded");
        } catch (error: unknown) {
            const transformError = Transformer.transformPayloadError({
                errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
                errorDescription: (error as Error).message,
                extensionList: null
            });

            reply.code(500).send(transformError);
        }
    }

    private async bulkTransfersRejectRequest(req: FastifyRequest<BulkTransfersRejectRequestDTO>, reply: FastifyReply): Promise<void> {
        this.logger.debug("Got bulk transfer rejected request");

        try{
            const clonedHeaders = { ...req.headers };
            const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
            const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;

            const bulkTransferId = req.params["id"] as string || null;
            const errorInformation = req.body["errorInformation"] || null;

            if(!bulkTransferId || !errorInformation || !requesterFspId) {
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

            const msgPayload: BulkTransferRejectRequestedEvtPayload = {
                bulkTransferId: bulkTransferId,
                errorInformation: errorInformation
            };

            const msg =  new BulkTransferRejectRequestedEvt(msgPayload);

            msg.validatePayload();

            msg.fspiopOpaqueState = {
                requesterFspId: requesterFspId,
                destinationFspId: destinationFspId,
                headers: clonedHeaders
            };

            await this.kafkaProducer.send(msg);

            this.logger.debug("bulk transfer rejected sent message");

            reply.code(202).send({
                status: "ok"
            });

            this.logger.debug("bulk transfer rejected responded");
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
