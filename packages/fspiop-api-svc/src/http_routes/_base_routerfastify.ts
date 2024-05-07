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

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import { FspiopJwsSignature, FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import fastify, {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {IHistogram, IMetrics} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {GetParticipantByTypeAndIdDTO} from "./account-lookup-bc/participant_route_dto";
import { parseAcceptHeader, parseContentTypeHeader, protocolVersions, FSPIOPErrorCodes } from "./validation";
import {RawReplyDefaultExpression, RawRequestDefaultExpression} from "fastify/types/utils";

// Define resource types and error messages with type annotations for better type safety
const defaultProtocolResources: string[] = [
    "parties",
    "participants",
    "quotes",
    "transfers",
    "bulkTransfers",
    "bulkQuotes",
    "transactionRequests",
    "authorizations"
];

const defaultProtocolVersions = [
    ...protocolVersions.ONE,
    protocolVersions.anyVersion
] as string[];

const errorMessages: { [key: string]: string } = {
    REQUESTED_VERSION_NOT_SUPPORTED: "The Client requested an unsupported version, see extension list for supported version(s).",
    INVALID_ACCEPT_HEADER: "Invalid accept header",
    INVALID_CONTENT_TYPE_HEADER: "Invalid content-type header",
    REQUIRE_ACCEPT_HEADER: "accept is required",
    REQUIRE_CONTENT_TYPE_HEADER: "Content-type is required",
    SUPPLIED_VERSION_NOT_SUPPORTED: "Client supplied a protocol version which is not supported by the server"
};

export abstract class BaseRoutesFastify {
    private _logger: ILogger;
    private _kafkaProducer: IMessageProducer;
    private _router: FastifyInstance;

    protected _validator: FspiopValidator;
    protected _jwsHelper: FspiopJwsSignature;

    protected readonly _metrics: IMetrics;
    protected readonly _histogram: IHistogram;

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        metrics: IMetrics,
        logger: ILogger
    ) {
        this._kafkaProducer = producer;
        this._logger = logger;
        this._validator = validator;
        this._jwsHelper = jwsHelper;
        this._router = fastify({ logger: false });

        this._metrics = metrics;

        this._histogram = metrics.getHistogram(this.constructor.name, `${this.constructor.name} metrics`, ["callName", "success"]);
    }

    // common header validation to be hooked by adding "fastify.addHook("preHandler", this._preHandler.bind(this));"
    // in the bindRoutes() of the implementation of this base class
    protected async _preHandler(request: FastifyRequest<GetParticipantByTypeAndIdDTO>, reply: FastifyReply): Promise<void> {
        // extract tracing headers


        // check accept
        const url = request.routeOptions.url || request.raw.url as string;
        const resource = url.replace(/^\//, "").split("/")[0];

        // Only validate requests for the requested resources
        if (!defaultProtocolResources.includes(resource)) {
            reply.status(400).send({
                errorInformation: {
                    errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                    errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
                }
            });
            return;
        }

        // Temporary fix for admin-ui date header
        if (request.headers["fspiop-date"]) {
            request.headers.date = request.headers["fspiop-date"] as string;
            delete request.headers["fspiop-date"];
        }

        // Always validate the accept header for a get request, or optionally if it has been supplied
        if (request.method.toLowerCase() === "get" || request.headers.accept) {
            if (!request.headers["content-type"] || request.headers["content-type"] === "application/json") {
                reply.status(400).send({
                    errorInformation: {
                        errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
                        errorDescription: errorMessages.REQUIRE_CONTENT_TYPE_HEADER
                    }
                });
                return;
            }

            const contentType = parseContentTypeHeader(resource, request.headers["content-type"]);
            if (!contentType.valid) {
                reply.status(400).send({
                    errorInformation: {
                        errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                        errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
                    }
                });
                return;
            }

            if (!request.headers.accept) {
                reply.status(400).send({
                    errorInformation: {
                        errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
                        errorDescription: errorMessages.REQUIRE_ACCEPT_HEADER
                    }
                });
                return;
            }

            const accept = parseAcceptHeader(resource, request.headers.accept);
            if (!accept.valid) {
                reply.status(400).send({
                    errorInformation: {
                        errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
                        errorDescription: errorMessages.INVALID_ACCEPT_HEADER
                    }
                });
                return;
            }

            if (!defaultProtocolVersions.some(version => accept.versions?.has(version))) {
                reply.status(400).send({
                    errorInformation: {
                        errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
                        errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
                    }
                });
                return;
            }
        }

        if (request.headers["date"]) {
            const headerDate = new Date(request.headers["date"]);
            if (isNaN(headerDate.getTime())) { // Using isNaN to check for invalid date
                reply.status(400).send({
                    errorInformation: {
                        errorCode: "3102",
                        errorDescription: "Invalid date-type"
                    }
                });
                return;
            }
        }
    };

    get logger(): ILogger {
        return this._logger;
    }

    get kafkaProducer(): IMessageProducer {
        return this._kafkaProducer;
    }

    get router(): FastifyInstance {
        return this._router;
    }

    async init(): Promise<void> {
        await this._router.ready();
        return Promise.resolve();
    }

    async destroy(): Promise<void> {
        await this._router.close();
        return Promise.resolve();
    }
}
