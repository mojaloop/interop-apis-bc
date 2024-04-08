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
import { existsSync } from "fs";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import { KafkaLogger } from "@mojaloop/logging-bc-client-lib";
import {
    AuditClient,
    KafkaAuditClientDispatcher,
    LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import { IAuditClient } from "@mojaloop/auditing-bc-public-types-lib";
import process from "process";
import { ParticipantAdapter } from "./implementations/external_adapters/participant_adapter";
import { ParticipantRoutes } from "./http_routes/account-lookup-bc/participant_routes";
import { PartyRoutes } from "./http_routes/account-lookup-bc/party_routes";
import {
    MLKafkaJsonConsumer,
    MLKafkaJsonConsumerOptions, MLKafkaJsonProducer,
    MLKafkaJsonProducerOptions
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AccountLookupEventHandler } from "./event_handlers/account_lookup_evt_handler";
import { QuotingEventHandler } from "./event_handlers/quoting_evt_handler";
import { TransferEventHandler } from "./event_handlers/transfers_evt_handler";
import {
    AccountLookupBCTopics,
    QuotingBCTopics,
    TransfersBCTopics
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { QuoteRoutes } from "./http_routes/quoting-bc/quote_routes";
import { QuoteBulkRoutes } from "./http_routes/quoting-bc/bulk_quote_routes";
import { TransfersRoutes } from "./http_routes/transfers-bc/transfers_routes";
import { IParticipantServiceAdapter } from "./interfaces/infrastructure";
import { AuthenticatedHttpRequester } from "@mojaloop/security-bc-client-lib";
import { IAuthenticatedHttpRequester } from "@mojaloop/security-bc-public-types-lib";
import path from "path";
import jsYaml from "js-yaml";
import fs from "fs";
import { validateHeadersPlugin } from "./header_validation";
import { TransfersBulkRoutes } from "./http_routes/transfers-bc/bulk_transfers_routes";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {
    DefaultConfigProvider,
    IConfigProvider
} from "@mojaloop/platform-configuration-bc-client-lib";
import { GetParticipantsConfigs } from "./configset";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { FspiopValidator, FspiopJwsSignature } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyFormbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import fastifyOAS from "fastify-oas";

const API_SPEC_FILE_PATH = process.env["API_SPEC_FILE_PATH"] || "../dist/api_spec.yaml";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../package.json");

const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOGLEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const APP_VERSION = packageJSON.version;

const SVC_DEFAULT_HTTP_PORT = 4000;

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || "/app/data/audit_private_key.pem";

// Account Lookup
const PARTICIPANTS_URL_RESOURCE_NAME = "participants";
const PARTIES_URL_RESOURCE_NAME = "parties";
// Quotes
const QUOTES_URL_RESOURCE_NAME = "quotes";
const BULK_QUOTES_URL_RESOURCE_NAME = "bulkQuotes";
// Transfers
const TRANSFERS_URL_RESOURCE_NAME = "transfers";
const BULK_TRANSFERS_URL_RESOURCE_NAME = "bulkTransfers";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "interop-api-bc-fspiop-api-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";


const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix


const PARTICIPANTS_SVC_URL = process.env["PARTICIPANTS_SVC_URL"] || "http://localhost:3010";
const PARTICIPANTS_CACHE_TIMEOUT_MS = (process.env["PARTICIPANTS_CACHE_TIMEOUT_MS"] && parseInt(process.env["PARTICIPANTS_CACHE_TIMEOUT_MS"])) || 5 * 60 * 1000;

// this service has more handlers, might take longer than the usual 30 sec
const SERVICE_START_TIMEOUT_MS = (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 120_000;

const JWS_FILES_PATH = process.env["JWS_FILES_PATH"] || "/app/data/keys/";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false // never change this to true without understanding what it does
};

// JWS Signature
const JWS_DISABLED = process.env["JWS_DISABLED"] || "false";

const jwsConfig: {
    enabled: boolean;
    privateKey: Buffer | null;
    publicKeys: { [key: string]: Buffer }
} = {
    enabled: JWS_DISABLED === "false" ? true : false,
    privateKey: null,
    publicKeys: {}
};

let globalLogger: ILogger;


let accountEvtHandler: AccountLookupEventHandler;
let quotingEvtHandler: QuotingEventHandler;
let transferEvtHandler: TransferEventHandler;

type FspiopHttpRequestError = {
    name: string;
    statusCode: number;
    data: {
        keyword: string;
        instancePath: string;
        params: string;
        message: string;
    }[]
}
export class Service {
    static logger: ILogger;
    static app: FastifyInstance;
    static participantRoutes: ParticipantRoutes;
    static partyRoutes: PartyRoutes;
    static quotesRoutes: QuoteRoutes;
    static bulkQuotesRoutes: QuoteBulkRoutes;
    static transfersRoutes: TransfersRoutes;
    static bulkTransfersRoutes: TransfersBulkRoutes;
    static participantService: IParticipantServiceAdapter;
    static auditClient: IAuditClient;
    static configClient: IConfigurationClient;
    static producer: IMessageProducer;

    static startupTimer: NodeJS.Timeout;

    static async start(
        logger?: ILogger,
        participantService?: IParticipantServiceAdapter,
        auditClient?: IAuditClient,
        configProvider?: IConfigProvider,
    ): Promise<void> {
        console.log(`Fspiop-api-svc - service starting with PID: ${process.pid}`);

        this.startupTimer = setTimeout(() => {
            throw new Error("Service start timed-out");
        }, SERVICE_START_TIMEOUT_MS);


        if (!logger) {
            logger = new KafkaLogger(
                BC_NAME,
                APP_NAME,
                APP_VERSION,
                kafkaJsonProducerOptions,
                KAFKA_LOGS_TOPIC,
                LOGLEVEL
            );
            await (logger as KafkaLogger).init();
        }
        globalLogger = this.logger = logger;

        if (!configProvider) {
            // create the instance of IAuthenticatedHttpRequester
            const authRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
            authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);

            const messageConsumer = new MLKafkaJsonConsumer({
                kafkaBrokerList: KAFKA_URL,
                kafkaGroupId: `${APP_NAME}_${Date.now()}` // unique consumer group - use instance id when possible
            }, this.logger.createChild("configClient.consumer"));
            configProvider = new DefaultConfigProvider(logger, authRequester, messageConsumer);
        }

        this.configClient = GetParticipantsConfigs(configProvider, BC_NAME, APP_NAME, APP_VERSION);
        await this.configClient.init();
        await this.configClient.bootstrap(true);
        await this.configClient.fetch();


        if (!auditClient) {
            if (!existsSync(AUDIT_KEY_FILE_PATH)) {
                if (PRODUCTION_MODE) process.exit(9);

                // create e tmp file
                LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH, 2048);
            }

            const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_KEY_FILE_PATH);
            const auditDispatcher = new KafkaAuditClientDispatcher(kafkaJsonProducerOptions, KAFKA_AUDITS_TOPIC, logger);
            // NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
            auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);

            await auditClient.init();
        }
        this.auditClient = auditClient;


        if (!participantService) {
            const participantLogger = logger.createChild("participantLogger");
            participantLogger.setLogLevel(LogLevel.INFO);

            const authRequester: IAuthenticatedHttpRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
            authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
            participantService = new ParticipantAdapter(participantLogger, PARTICIPANTS_SVC_URL, authRequester, PARTICIPANTS_CACHE_TIMEOUT_MS);
        }
        this.participantService = participantService;

        // Singleton for Validation and JWS functions
        const currencyList = this.configClient.globalConfigs.getCurrencies();
        const routeValidator = FspiopValidator.getInstance();
        routeValidator.addCurrencyList(currencyList);

        if (jwsConfig.enabled) {
            const privateKey = fs.readFileSync(path.join(__dirname, `${JWS_FILES_PATH}/hub/privatekey.pem`));
            jwsConfig.privateKey = privateKey;

            const fileList = fs.readdirSync(path.join(__dirname, `${JWS_FILES_PATH}/dfsps/`));
            for (const fileName of fileList) {
                const publicKey = fs.readFileSync(path.join(__dirname, `${JWS_FILES_PATH}/dfsps/${fileName}`));
                jwsConfig.publicKeys[fileName.replace("-pub.pem", "")] = publicKey;
            }
        }

        const jwsHelper = FspiopJwsSignature.getInstance();
        jwsHelper.addLogger(this.logger);
        jwsHelper.enableJws(jwsConfig.enabled);
        jwsHelper.addPublicKeys(jwsConfig.publicKeys);
        if (jwsConfig.privateKey) {
            jwsHelper.addPrivateKey(jwsConfig.privateKey);
        }

        await Service.setupEventHandlers(jwsHelper);

        // Create and initialise the http hanlders
        this.producer = new MLKafkaJsonProducer(kafkaJsonProducerOptions);
        await this.producer.connect();

        this.participantRoutes = new ParticipantRoutes(this.producer, routeValidator, jwsHelper, this.logger);
        this.partyRoutes = new PartyRoutes(this.producer, routeValidator, jwsHelper, this.logger);
        this.quotesRoutes = new QuoteRoutes(this.producer, routeValidator, jwsHelper, this.logger);
        this.bulkQuotesRoutes = new QuoteBulkRoutes(this.producer, routeValidator, jwsHelper, this.logger);
        this.transfersRoutes = new TransfersRoutes(this.producer, routeValidator, jwsHelper, this.logger);
        this.bulkTransfersRoutes = new TransfersBulkRoutes(this.producer, routeValidator, jwsHelper, this.logger);

        await Promise.all([
            this.participantRoutes.init(),
            this.partyRoutes.init(),
            this.quotesRoutes.init(),
            this.bulkQuotesRoutes.init(),
            this.transfersRoutes.init(),
            this.bulkTransfersRoutes.init()
        ]);

        await Service.setupFastify();

        this.logger.info(`Fspiop-api service v: ${APP_VERSION} started`);

        // remove startup timeout
        clearTimeout(this.startupTimer);
    }

    static async setupEventHandlers(jwsHelper: FspiopJwsSignature): Promise<void> {
        const accountEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_AccountLookupEventHandler`,
        };

        accountEvtHandler = new AccountLookupEventHandler(
            this.logger,
            accountEvtHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [AccountLookupBCTopics.DomainEvents],
            this.participantService,
            jwsHelper
        );

        const quotingEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_QuotingEventHandler`,
        };

        quotingEvtHandler = new QuotingEventHandler(
            this.logger,
            quotingEvtHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [QuotingBCTopics.DomainEvents],
            this.participantService,
            jwsHelper
        );

        const transferEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_TransferEventHandler`,
        };

        transferEvtHandler = new TransferEventHandler(
            this.logger,
            transferEvtHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [TransfersBCTopics.DomainEvents],
            this.participantService,
            jwsHelper
        );

        await Promise.all([
            accountEvtHandler.init(),
            quotingEvtHandler.init(),
            transferEvtHandler.init()
        ]);
    }

    static async setupFastify(): Promise<void> {
        return new Promise<void>(resolve => {
            this.app = Fastify({ 
                logger: true
            });
    
            this.app.register(fastifyCors, { origin: true });
            this.app.register(fastifyFormbody, {
                bodyLimit: 100 * 1024 * 1024 // 100MB
            });

            // Setup routes
            this.app.register(fastifyStatic, {
                root: path.join(__dirname, 'public'),
                prefix: '/public/', // optional: default '/'
            });

            // Custom content type for handling specific versioned JSON types
            this.app.addContentTypeParser('*', { parseAs: 'buffer' }, function (req:any, body:any, done) {
                try {
                  const contentLength = req.headers['content-length'];
                  if (contentLength) {
                    req.headers['content-length'] = parseInt(contentLength, 10).toString();
                  }
              
                  const contentType = req.headers['content-type']?.toLowerCase();
              
                  if (contentType === 'application/json' ||
                      contentType?.startsWith('application/vnd.interoperability.')) {
                    const json = JSON.parse(body.toString());
                    done(null, json);
                  } else {
                    // If not a supported content type, do not parse the body
                    done(null, undefined);
                  }
                } catch (err:any) {
                  done(err, undefined);
                }
            });

            const openApiDocument = jsYaml.load(
                fs.readFileSync(path.join(__dirname, API_SPEC_FILE_PATH), 'utf-8')
            );

            this.app.register(fastifyOAS, {
                specification: openApiDocument,
            });
            
            this.app.addHook('preHandler', validateHeadersPlugin);

            this.app.register(this.participantRoutes.bindRoutes, { prefix: `/${PARTICIPANTS_URL_RESOURCE_NAME}` });
            this.app.register(this.partyRoutes.bindRoutes, { prefix: `/${PARTIES_URL_RESOURCE_NAME}` });
            this.app.register(this.quotesRoutes.bindRoutes, { prefix: `/${QUOTES_URL_RESOURCE_NAME}` });
            this.app.register(this.bulkQuotesRoutes.bindRoutes, { prefix: `/${BULK_QUOTES_URL_RESOURCE_NAME}` });
            this.app.register(this.transfersRoutes.bindRoutes, { prefix: `/${TRANSFERS_URL_RESOURCE_NAME}` });
            this.app.register(this.bulkTransfersRoutes.bindRoutes, { prefix: `/${BULK_TRANSFERS_URL_RESOURCE_NAME}` });
    
            // Error handling middleware
            this.app.setErrorHandler((error, request, reply) => {
                const err = error as unknown as FspiopHttpRequestError; 
              
                if (!err.data) {
                  reply.callNotFound();
                  return;
                }
              
                const errorResponseBuilder = (errorCode: string, errorDescription: string, additionalProperties = {}) => {
                  return {
                    errorInformation: {
                      errorCode,
                      errorDescription,
                      ...additionalProperties
                    }
                  };
                };
              
                const statusCode = err.statusCode || 500;
                const extensionList = [{
                  key: "keyword",
                  value: err.data[0].keyword
                }, {
                  key: "instancePath",
                  value: err.data[0].instancePath
                }];
              
                for (const [key, value] of Object.entries(err.data[0].params)) {
                  extensionList.push({ key, value });
                }
              
                const customFSPIOPHeaders = ["content-type"];
                const customHeaders: {[key: string]: string} = {};
                customFSPIOPHeaders.forEach(headerKey => {
                  const headerValue = request.headers[headerKey];
                  if (headerValue) {
                    customHeaders[headerKey] = headerValue as string;
                  }
                });
              
                // Setting custom headers
                Object.entries(customHeaders).forEach(([key, value]) => {
                  reply.header(key, value);
                });
              
                let errorCode: string;
                const errorType = err.data[0].instancePath;
              
                if (errorType.includes("body")) {
                  errorCode = "3100";
                } else {
                  errorCode = "3102";
                }
              
                reply.code(statusCode).send(errorResponseBuilder(errorCode, `${err.data[0].message} - path: ${err.data[0].instancePath}`, { extensionList: { extension: extensionList } }));
            });
            
            // Catch-all for unhandled requests
            this.app.setNotFoundHandler((request, reply) => {
                request.log.warn(`Received unhandled request to url: ${request.url}`);
                reply.code(404).send({
                errorInformation: {
                    errorCode: "3002",
                    errorDescription: "Unknown URI"
                }
                });
            });

            let portNum = SVC_DEFAULT_HTTP_PORT;
            if (process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
                portNum = parseInt(process.env["SVC_HTTP_PORT"]);
            }

            this.app.listen(portNum, () => {
                this.logger.info(`🚀 Server ready at: http://localhost:${portNum}`);
                this.logger.info(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
                resolve();
            });
        });
    }

    static async stop() {
        if (this.app) {
            await this.participantRoutes.destroy();
            await this.partyRoutes.destroy();
            await this.quotesRoutes.destroy();
            await this.bulkQuotesRoutes.destroy();
            await this.bulkQuotesRoutes.destroy();
            await this.transfersRoutes.destroy();

            await this.app.close();
        }
        if (this.producer) {
            await this.producer.destroy();
        }

        await accountEvtHandler.destroy();
        await quotingEvtHandler.destroy();
        await transferEvtHandler.destroy();

        await this.auditClient.destroy();
        setTimeout(async () => {
            await (this.logger as KafkaLogger).destroy();
        }, 5000);
    }
}


/**
 * process termination and cleanup
 */

async function _handle_int_and_term_signals(signal: NodeJS.Signals): Promise<void> {
    console.info(`Service - ${signal} received - cleaning up...`);
    let clean_exit = false;
    setTimeout(() => {
        clean_exit || process.exit(99);
    }, 5000);

    // call graceful stop routine
    await Service.stop();

    clean_exit = true;
    process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals);
//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals);

//do something when app is closing
process.on("exit", async () => {
    globalLogger.info("Microservice - exiting...");
});
process.on("uncaughtException", (err: Error) => {
    globalLogger.error(err);
    console.log("UncaughtException - EXITING...");
    process.exit(999);
});

