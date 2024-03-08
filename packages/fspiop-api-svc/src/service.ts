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
import {existsSync} from "fs";
import {Server} from "http";
import express, {Express} from "express";
import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {
    AuditClient,
    KafkaAuditClientDispatcher,
    LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import process from "process";
import {ParticipantAdapter} from "./implementations/external_adapters/participant_adapter";
import {ParticipantRoutes} from "./http_routes/account-lookup-bc/participant_routes";
import {PartyRoutes} from "./http_routes/account-lookup-bc/party_routes";
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
    ForeignExchangeBCSvcTopics,
    ForeignExchangeBCQuoteTopics,
    QuotingBCTopics,
    TransfersBCTopics
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { QuoteRoutes } from "./http_routes/quoting-bc/quote_routes";
import { QuoteBulkRoutes } from "./http_routes/quoting-bc/bulk_quote_routes";
import { TransfersRoutes } from "./http_routes/transfers-bc/transfers_routes";
import { IParticipantServiceAdapter } from "./interfaces/infrastructure";
import {AuthenticatedHttpRequester} from "@mojaloop/security-bc-client-lib";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-public-types-lib";
import path from "path";
import { OpenApiDocument, OpenApiValidator } from "express-openapi-validate";
import jsYaml from "js-yaml";
import fs from "fs";
import { validateHeaders } from "./header_validation";
import { TransfersBulkRoutes } from "./http_routes/transfers-bc/bulk_transfers_routes";
import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {
    DefaultConfigProvider,
    IConfigProvider
} from "@mojaloop/platform-configuration-bc-client-lib";
import {GetParticipantsConfigs} from "./configset";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { FspiopValidator, FspiopJwsSignature } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ForeignExchangeServicesRoutes } from "./http_routes/foreign-exchange-bc/fx_services_routes";
import { ForeignExchangeServicesEventHandler } from "./event_handlers/fx_services_evt_handler";
import { ForeignExchangeQuotesEventHandler } from "./event_handlers/fx_quotes_evt_handler";
import { ForeignExchangeQuotesRoutes } from "./http_routes/foreign-exchange-bc/fx_quotes_routes";

const API_SPEC_FILE_PATH = process.env["API_SPEC_FILE_PATH"] || "../dist/api_spec.yaml";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../package.json");

const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

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

// Forign Exchange
const FOREIGN_EXCHANGE_SERVICE_RESOURCE_NAME = "services";
const FOREIGN_EXCHANGE_QUOTES_RESOURCE_NAME = "fxQuotes";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "interop-api-bc-fspiop-api-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";


const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix


const PARTICIPANTS_SVC_URL = process.env["PARTICIPANTS_SVC_URL"] || "http://localhost:3010";
const PARTICIPANTS_CACHE_TIMEOUT_MS = (process.env["PARTICIPANTS_CACHE_TIMEOUT_MS"] && parseInt(process.env["PARTICIPANTS_CACHE_TIMEOUT_MS"])) || 5*60*1000;

// this service has more handlers, might take longer than the usual 30 sec
const SERVICE_START_TIMEOUT_MS= (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 120_000;

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


let accountEvtHandler:AccountLookupEventHandler;
let quotingEvtHandler:QuotingEventHandler;
let transferEvtHandler:TransferEventHandler;
let foreignExchangeServicesEvtHandler:ForeignExchangeServicesEventHandler;
let foreignExchangeQuotesEvtHandler: ForeignExchangeQuotesEventHandler;

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
    static app: Express;
    static expressServer: Server;
    static participantRoutes: ParticipantRoutes;
    static partyRoutes: PartyRoutes;
    static quotesRoutes: QuoteRoutes;
    static bulkQuotesRoutes: QuoteBulkRoutes;
    static transfersRoutes: TransfersRoutes;
    static bulkTransfersRoutes:TransfersBulkRoutes;
    static foreignExchangeServicesRoutes: ForeignExchangeServicesRoutes;
    static foreignExchangeQuotesRoutes: ForeignExchangeQuotesRoutes;
    static participantService: IParticipantServiceAdapter;
    static auditClient: IAuditClient;
    static configClient: IConfigurationClient;
    static producer:IMessageProducer;

    static startupTimer: NodeJS.Timeout;

    static async start(
        logger?:ILogger,
        participantService?: IParticipantServiceAdapter,
        auditClient?: IAuditClient,
        configProvider?: IConfigProvider,
    ):Promise<void> {
        console.log(`Fspiop-api-svc - service starting with PID: ${process.pid}`);

        this.startupTimer = setTimeout(()=>{
            throw new Error("Service start timed-out");
        }, SERVICE_START_TIMEOUT_MS);


        if(!logger) {
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

        if(!configProvider) {
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


        if(!auditClient) {
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


        if(!participantService){
            const participantLogger = logger.createChild("participantLogger");
            participantLogger.setLogLevel(LogLevel.INFO);

            const authRequester:IAuthenticatedHttpRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
            authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
            participantService = new ParticipantAdapter(participantLogger, PARTICIPANTS_SVC_URL, authRequester, PARTICIPANTS_CACHE_TIMEOUT_MS);
        }
        this.participantService = participantService;

        // Singleton for Validation and JWS functions
        const currencyList = this.configClient.globalConfigs.getCurrencies();
        const routeValidator = FspiopValidator.getInstance();
        routeValidator.addCurrencyList(currencyList);

        if(jwsConfig.enabled) {
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
        if(jwsConfig.privateKey) {
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
        this.foreignExchangeServicesRoutes = new ForeignExchangeServicesRoutes(this.producer, routeValidator, jwsHelper, this.logger);
        this.foreignExchangeQuotesRoutes = new ForeignExchangeQuotesRoutes(this.producer, routeValidator, jwsHelper, this.logger);

        await Promise.all([
            this.participantRoutes.init(),
            this.partyRoutes.init(),
            this.quotesRoutes.init(),
            this.bulkQuotesRoutes.init(),
            this.transfersRoutes.init(),
            this.bulkTransfersRoutes.init(),
            this.foreignExchangeServicesRoutes.init(),
            this.foreignExchangeQuotesRoutes.init()
        ]);

        await Service.setupExpress();

        this.logger.info(`Fspiop-api service v: ${APP_VERSION} started`);

        // remove startup timeout
        clearTimeout(this.startupTimer);
    }

    static async setupEventHandlers(jwsHelper:FspiopJwsSignature):Promise<void>{
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

        const foreignExchangeEventHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_ForeignExchangeEventHandler`,
        };

        foreignExchangeServicesEvtHandler = new ForeignExchangeServicesEventHandler(
            this.logger,
            foreignExchangeEventHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [ForeignExchangeBCSvcTopics.DomainEvents],
            this.participantService,
            jwsHelper
        );

        foreignExchangeQuotesEvtHandler = new ForeignExchangeQuotesEventHandler(
            this.logger,
            foreignExchangeEventHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [ForeignExchangeBCQuoteTopics.DomainEvents],
            this.participantService,
            jwsHelper
        );

        await Promise.all([
            accountEvtHandler.init(),
            quotingEvtHandler.init(),
            transferEvtHandler.init(),
            foreignExchangeServicesEvtHandler.init(),
            foreignExchangeQuotesEvtHandler.init()
        ]);
    }

    static async setupExpress(): Promise<void> {
        return new Promise<void>(resolve => {
            this.app = express();
            this.app.use(express.json({
                limit: "100mb",
                type: (req)=>{
                    const contentLength = req.headers["content-length"];
                    if(contentLength) {
                        // We need to send this as a number
                        req.headers["content-length"]= parseInt(contentLength) as unknown as string;
                    }

                    return req.headers["content-type"]?.toUpperCase()==="application/json".toUpperCase()
                        || req.headers["content-type"]?.startsWith("application/vnd.interoperability.")
                        || false;
                }
            })); // for parsing application/json
            this.app.use(express.urlencoded({limit: "100mb", extended: true})); // for parsing application/x-www-form-urlencoded

            // // Call header validation
            this.app.use(validateHeaders);

            // Call the request validator in every request
            const openApiDocument = jsYaml.load(
                fs.readFileSync(path.join(__dirname, API_SPEC_FILE_PATH), "utf-8"),
            ) as OpenApiDocument;
            const validator = new OpenApiValidator(openApiDocument); // TODO: find a way to limit currencies on this point
            this.app.use(validator.match());

            // hook http handler's routes
            this.app.use(`/${PARTICIPANTS_URL_RESOURCE_NAME}`, this.participantRoutes.router);
            this.app.use(`/${PARTIES_URL_RESOURCE_NAME}`, this.partyRoutes.router);
            this.app.use(`/${QUOTES_URL_RESOURCE_NAME}`, this.quotesRoutes.router);
            this.app.use(`/${BULK_QUOTES_URL_RESOURCE_NAME}`, this.bulkQuotesRoutes.router);
            this.app.use(`/${TRANSFERS_URL_RESOURCE_NAME}`, this.transfersRoutes.router);
            this.app.use(`/${BULK_TRANSFERS_URL_RESOURCE_NAME}`, this.bulkTransfersRoutes.router);
            this.app.use(`/${FOREIGN_EXCHANGE_SERVICE_RESOURCE_NAME}`, this.foreignExchangeServicesRoutes.router);
            this.app.use(`/${FOREIGN_EXCHANGE_QUOTES_RESOURCE_NAME}`, this.foreignExchangeQuotesRoutes.router);

            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            /* istanbul ignore next */
            this.app.use((err: FspiopHttpRequestError, req: express.Request, res: express.Response, next: express.NextFunction) => {
                if(!err.data) {
                    next();
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
                },
                {
                    key: "instancePath",
                    value: err.data[0].instancePath
                }];
                for (const [key, value] of Object.entries(err.data[0].params)) {
                    extensionList.push({ key, value });
                }
                const customFSPIOPHeaders = ["content-type"];

                const customHeaders:{[key: string]: string} = {};
                for (const value of customFSPIOPHeaders) {
                    const headerValue = req.headers[value] as string;

                    if(req.headers[value]) {
                        customHeaders[value] = headerValue;
                    }
                }

                res.set(customHeaders);

                let errorCode:string;
                const errorType = err.data[0].instancePath;

                if(errorType.includes("body")){
                    errorCode = "3100";
                }else if(!errorType.includes("body")) {
                    errorCode = "3102";
                }else{
                    errorCode = "3100";
                }

                res.status(statusCode).json(errorResponseBuilder(errorCode, `${err.data[0].message} - path: ${err.data[0].instancePath}`, { extensionList: { extension: extensionList} }));
            });

            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
                // catch all
                this.logger.warn(`Received unhandled request to url: ${req.url}`);
                res.status(404).json({
                    errorInformation: {
                        errorCode: "3002",
                        errorDescription: "Unknown URI"
                    }
                });

                next();
            });

            let portNum = SVC_DEFAULT_HTTP_PORT;
            if(process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
                portNum = parseInt(process.env["SVC_HTTP_PORT"]);
            }

            this.expressServer = this.app.listen(portNum, () => {
                this.logger.info(`🚀 Server ready at: http://localhost:${portNum}`);
                this.logger.info(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
                resolve();
            });
        });
    }

    static async stop() {
        // if (this.handler) await this.handler.stop();
        // if (this.messageConsumer) await this.messageConsumer.destroy(true);

        // if (this.auditClient) await this.auditClient.destroy();
        // if (this.logger && this.logger instanceof KafkaLogger) await this.logger.destroy();
        if (this.expressServer){
            await this.participantRoutes.destroy();
            await this.partyRoutes.destroy();
            await this.quotesRoutes.destroy();
            await this.bulkQuotesRoutes.destroy();
            await this.bulkQuotesRoutes.destroy();
            await this.transfersRoutes.destroy();
            await this.foreignExchangeServicesRoutes.destroy();
            await this.foreignExchangeQuotesRoutes.destroy();

            await this.expressServer.close();
            // const closeExpress = util.promisify(this.expressServer.close);
            // await closeExpress();
        }
        if(this.producer){
            await this.producer.destroy();
        }

        await accountEvtHandler.destroy();
        await quotingEvtHandler.destroy();
        await transferEvtHandler.destroy();
        await foreignExchangeServicesEvtHandler.destroy();
        await foreignExchangeQuotesEvtHandler.destroy();

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
