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
import {FspiopJwsSignature, FspiopValidator} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import fastify, {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {IHistogram, IMetrics, SpanStatusCode, Tracer} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {GetParticipantByTypeAndIdDTO} from "./account-lookup-bc/participant_route_dto";
import {FSPIOPErrorCodes, parseAcceptHeader, parseContentTypeHeader, protocolVersions} from "./validation";

import * as OpentelemetryApi from "@opentelemetry/api";
import {SpanKind, SpanOptions, BaggageEntry} from "@opentelemetry/api";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";

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

// These need to match the simulator - Should go to the observability types
export const TRACING_REQ_START_TS_HEADER_NAME="tracing-request-start-timestamp";
export const TRACING_RESP_START_TS_HEADER_NAME="tracing-response-start-timestamp";

export abstract class BaseRoutesFastify {
    protected _logger: ILogger;
    protected _kafkaProducer: IMessageProducer;
    private _router: FastifyInstance;

    protected _validator: FspiopValidator;
    protected _jwsHelper: FspiopJwsSignature;

    protected readonly _metrics: IMetrics;
    protected readonly _histogram: IHistogram;
    protected readonly _tracer: Tracer;

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
        this._router = fastify({logger: false});

        this._metrics = metrics;

        this._tracer = OpenTelemetryClient.getInstance().trace.getTracer(this.constructor.name);

        this._histogram = metrics.getHistogram(this.constructor.name, `${this.constructor.name} metrics`, ["callName", "success"]);
    }

    async init(): Promise<void> {
        await this._router.ready();
        return Promise.resolve();
    }

    async destroy(): Promise<void> {
        await this._router.close();
        return Promise.resolve();
    }

    protected _addHooks(fastify: FastifyInstance): void {
        // hook header validation from base class - MANDATORY for FSPIOP Routes
        fastify.addHook("preHandler", this._preHandlerContentType.bind(this));

        // hook span preprocessor - tries to propagate trace info from headers
        // @ts-ignore
        fastify.addHook("preHandler", this._preHandlerTracing.bind(this));

        // fastify.addHook("preHandler", (instance, opts, done)=>{
        //     console.log("start");
        //     done();
        //     console.log("end");
        // });
    }

    /**
     * Returns the automatically created span with propagated context if available
     * (was created in the preHandler hook and will also be automatically ended)
     * @protected
     */
    protected _getActiveSpan(): OpentelemetryApi.Span {
        const span = OpentelemetryApi.trace.getActiveSpan();
        if (span) return span;

        // BaseRoutesFastify._preHandlerTracing makes sure there is always a span,
        // in the context of a request handler, even if a non-recording one
        throw new Error("Invalid Span in BaseRoutesFastify - this should not happen");
    }

    // @ts-ignore
    protected _preHandlerTracing(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
        // try to get a tracing context from headers
        const headersCtx = OpentelemetryApi.propagation.extract(OpentelemetryApi.context.active(), request.headers);

        // try to get existing baggage that might've come in the headers (or create new)
        let baggage = OpentelemetryApi.propagation.getActiveBaggage() || OpentelemetryApi.propagation.createBaggage();
        const reqTs = request.headers[TRACING_REQ_START_TS_HEADER_NAME] != undefined ? String(request.headers[TRACING_REQ_START_TS_HEADER_NAME]) : undefined;
        if (reqTs) {
            baggage = baggage.setEntry(TRACING_REQ_START_TS_HEADER_NAME, {value: reqTs});
        }
        const respTs = request.headers[TRACING_RESP_START_TS_HEADER_NAME] != undefined ? String(request.headers[TRACING_RESP_START_TS_HEADER_NAME]) : undefined;
        if (respTs) {
            baggage = baggage.setEntry(TRACING_RESP_START_TS_HEADER_NAME, {value: respTs});
        }

        /// capture the context created by attaching baggage to the tracing context from headers
        const newContext = OpentelemetryApi.propagation.setBaggage(headersCtx, baggage)

        const spanName = this._getDefaultFormatSpanName(request);
        const spanOptions: SpanOptions = {
            kind: SpanKind.SERVER,
            attributes: {
                "url": request.raw.method,
                "method": request.raw.url,
            }
        };

        // call the continuation chain with the active span/context set
        this._tracer.startActiveSpan(spanName, spanOptions, newContext, (span) => {
            // capture the end of the request to close/end the span
            reply.then(() => {
                // will be called when a response has been fully sent,
                if (reply.statusCode >= 400) span.setStatus({code: SpanStatusCode.ERROR});
                span.setAttributes({"reply.statusCode": reply.statusCode});
                span.end();
            }, (err: Error) => {
                // will be called if the underlying stream had an error, e.g. the socket has been destroyed
                span.setStatus({code: SpanStatusCode.ERROR});
                span.setAttributes({
                    "reply.statusCode": reply.statusCode,
                    "error.name": err.name,
                    "error.message": err.message,
                    "error.stack": err.stack
                });
                span.end();
            });

            // this will execute the rest of the http request, with the above span and context being "active"
            done();
        });
    }

    // common header validation to be hooked by adding "fastify.addHook("preHandler", this._preHandler.bind(this));"
    // in the bindRoutes() of the implementation of this base class
    protected async _preHandlerContentType(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
    }


    // borrowed from https://github.com/autotelic/fastify-opentelemetry/blob/main/index.js
    private _getDefaultFormatSpanName(request: FastifyRequest): string {
        const {method} = request;
        let path;
        if (request.routeOptions) {
            path = request.routeOptions.url;
        } else {
            path = request.routerPath;
        }
        return path ? `${method} ${path}` : method;
    }
}
