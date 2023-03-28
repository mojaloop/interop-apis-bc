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
import {createServer, Server} from "http";
import express from "express";
import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {
    AuditClient,
    KafkaAuditClientDispatcher,
    LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import process from "process";
import {ParticipantAdapter} from "./implementations/index";
import {ParticipantRoutes} from "./http_routes/account-lookup-bc/participant_routes";
import {PartyRoutes} from "./http_routes/account-lookup-bc/party_routes";
import { MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions, MLKafkaRawProducerOptions, MLKafkaRawProducerPartitioners } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AccountLookupEventHandler } from "./event_handlers/account_lookup_evt_handler";
import { QuotingEventHandler } from "./event_handlers/quoting_evt_handler";
import { TransferEventHandler } from "./event_handlers/transfers_evt_handler";
import { AccountLookupBCTopics, QuotingBCTopics, TransfersBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { QuoteRoutes } from "./http_routes/quoting-bc/quote_routes";
import { QuoteBulkRoutes } from "./http_routes/quoting-bc/bulk_quote_routes";
import { TransfersRoutes } from "./http_routes/transfers-bc/transfers_routes";
import { IParticipantService } from "./interfaces/infrastructure";
import {
	AuthenticatedHttpRequester,
	IAuthenticatedHttpRequester
} from "@mojaloop/security-bc-client-lib";
import path from "path";


const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const APP_VERSION = process.env.npm_package_version || "0.0.0";

const SVC_DEFAULT_HTTP_PORT = 4000;

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || path.join(__dirname, "../dist/tmp_key_file");

// Account Lookup
const PARTICIPANTS_URL_RESOURCE_NAME = "participants";
const PARTIES_URL_RESOURCE_NAME = "parties";

const KAFKA_ACCOUNTS_LOOKUP_TOPIC = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainEvents;

// Quotes
const QUOTES_URL_RESOURCE_NAME = "quotes";
const BULK_QUOTES_URL_RESOURCE_NAME = "bulkQuotes";

const KAFKA_QUOTES_LOOKUP_TOPIC = process.env["KAFKA_QUOTES_LOOKUP_TOPIC"] || QuotingBCTopics.DomainEvents;

// Transfers
const TRANSFERS_URL_RESOURCE_NAME = "transfers";

const KAFKA_TRANSFERS_TOPIC = process.env["KAFKA_TRANSFERS_TOPIC"] || TransfersBCTopics.DomainEvents;

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "interop-api-bc-fspiop-api-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_ID"] || "superServiceSecret";


const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix

const PARTICIPANTS_SVC_URL = process.env["PARTICIPANTS_SVC_URL"] || "http://localhost:3010";
const HTTP_CLIENT_TIMEOUT_MS = 10_000;

const kafkaProducerOptions: MLKafkaRawProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    partitioner: MLKafkaRawProducerPartitioners.MURMUR2
};

// let loginHelper:LoginHelper;


let accountEvtHandler:AccountLookupEventHandler;
let quotingEvtHandler:QuotingEventHandler;
let transferEvtHandler:TransferEventHandler;


export class Service {
	static logger: ILogger;
	static expressServer: Server;
    static participantRoutes:ParticipantRoutes;
    static partyRoutes:PartyRoutes;
    static quotesRoutes:QuoteRoutes;
    static bulkQuotesRoutes:QuoteBulkRoutes;
    static transfersRoutes:TransfersRoutes;
    static participantService: IParticipantService;
    static auditClient: IAuditClient
    
	static async start(
        logger?:ILogger,
        expressServer?: Server,
        participantService?: IParticipantService,
        auditClient?: IAuditClient
    ):Promise<void> {
        console.log(`Fspiop-api-svc - service starting with PID: ${process.pid}`);

        if(!logger) {
            logger = new KafkaLogger(
                    BC_NAME,
                    APP_NAME,
                    APP_VERSION,
                    kafkaProducerOptions,
                    KAFKA_LOGS_TOPIC,
                    LOGLEVEL
            );
            await (logger as KafkaLogger).init();
        }
        this.logger = logger;

        if(!auditClient) {
            if (!existsSync(AUDIT_KEY_FILE_PATH)) {
                if (PRODUCTION_MODE) process.exit(9);

                // create e tmp file
                LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH, 2048);
            }

            const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_KEY_FILE_PATH);
            const auditDispatcher = new KafkaAuditClientDispatcher(kafkaProducerOptions, KAFKA_AUDITS_TOPIC, logger);
            // NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
            auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);

            await auditClient.init();
        }
        this.auditClient = auditClient;


        const participantLogger = logger.createChild("participantLogger");

        const authRequester:IAuthenticatedHttpRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);

        authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
        participantLogger.setLogLevel(LogLevel.INFO);
        participantService = new ParticipantAdapter(participantLogger, PARTICIPANTS_SVC_URL, authRequester, HTTP_CLIENT_TIMEOUT_MS);
        this.participantService = participantService;
        
        await Service.setupEventHandlers();

        const app = await Service.setupExpress(logger);

        let portNum = SVC_DEFAULT_HTTP_PORT;
        if(process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
            portNum = parseInt(process.env["SVC_HTTP_PORT"]);
        }

        expressServer = app.listen(portNum, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            this.logger.info(`Fspiop-api service v: ${APP_VERSION} started`);
        });
        this.expressServer = expressServer;

    }

    static async setupEventHandlers():Promise<void>{
        const kafkaJsonConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}`,
        };
    
        const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
            kafkaBrokerList: KAFKA_URL,
            producerClientId: `${BC_NAME}_${APP_NAME}`,
            skipAcknowledgements: true,
        };
    
        accountEvtHandler = new AccountLookupEventHandler(
            this.logger,
            kafkaJsonConsumerOptions,
            kafkaJsonProducerOptions,
            [KAFKA_ACCOUNTS_LOOKUP_TOPIC],
            this.participantService
        );
        await accountEvtHandler.init();
    
        quotingEvtHandler = new QuotingEventHandler(
            this.logger,
            kafkaJsonConsumerOptions,
            kafkaJsonProducerOptions,
            [KAFKA_QUOTES_LOOKUP_TOPIC],
            this.participantService
        );
        await quotingEvtHandler.init();
    
        transferEvtHandler = new TransferEventHandler(
            this.logger,
            kafkaJsonConsumerOptions,
            kafkaJsonProducerOptions,
            [KAFKA_TRANSFERS_TOPIC],
            this.participantService
        );
        await transferEvtHandler.init();
    
    }

    static async setupExpress(loggerParam:ILogger): Promise<Server> {
        const app = express();
        app.use(express.json({
            limit: "100mb",
            type: (req)=>{
                return req.headers["content-type"]?.toUpperCase()==="application/json".toUpperCase()
                    || req.headers["content-type"]?.startsWith("application/vnd.interoperability.")
                    || false;
            }
        })); // for parsing application/json
        app.use(express.urlencoded({limit: '100mb', extended: true})); // for parsing application/x-www-form-urlencoded
    
        // TODO: find another way around this since it's only a temporary fix for admin-ui date header 
        app.use((req, res, next) => {
            if(req.headers['fspiop-date']) {
                req.headers.date = req.headers["fspiop-date"] as string;
                delete req.headers["fspiop-date"];
            }
            next()
        })
    
        this.participantRoutes = new ParticipantRoutes(kafkaProducerOptions, KAFKA_ACCOUNTS_LOOKUP_TOPIC, loggerParam);
        this.partyRoutes = new PartyRoutes(kafkaProducerOptions, KAFKA_ACCOUNTS_LOOKUP_TOPIC, loggerParam);
    
        await this.participantRoutes.init();
        await this.partyRoutes.init();
    
        app.use(`/${PARTICIPANTS_URL_RESOURCE_NAME}`, this.participantRoutes.router);
        app.use(`/${PARTIES_URL_RESOURCE_NAME}`, this.partyRoutes.router);
    
        this.quotesRoutes = new QuoteRoutes(kafkaProducerOptions,  KAFKA_QUOTES_LOOKUP_TOPIC, loggerParam);
        this.bulkQuotesRoutes = new QuoteBulkRoutes(kafkaProducerOptions, KAFKA_QUOTES_LOOKUP_TOPIC, loggerParam);
        this.transfersRoutes = new TransfersRoutes(kafkaProducerOptions,  KAFKA_TRANSFERS_TOPIC, loggerParam);
    
        await this.quotesRoutes.init();
        await this.bulkQuotesRoutes.init();
        await this.transfersRoutes.init();
    
        app.use(`/${QUOTES_URL_RESOURCE_NAME}`, this.quotesRoutes.router);
        app.use(`/${BULK_QUOTES_URL_RESOURCE_NAME}`, this.bulkQuotesRoutes.router);
        app.use(`/${TRANSFERS_URL_RESOURCE_NAME}`, this.transfersRoutes.router);
    
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            // catch all
            loggerParam.warn(`Received unhandled request to url: ${req.url}`);
            res.sendStatus(404);
            next();
        });
    
        return createServer(app);
    }

	static async stop() {
		// if (this.handler) await this.handler.stop();
		// if (this.messageConsumer) await this.messageConsumer.destroy(true);

		// if (this.auditClient) await this.auditClient.destroy();
		// if (this.logger && this.logger instanceof KafkaLogger) await this.logger.destroy();

        await accountEvtHandler.destroy();
        await quotingEvtHandler.destroy();
        await transferEvtHandler.destroy();
        this.expressServer.close();
        this.auditClient.destroy();
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
    setTimeout(() => { clean_exit || process.abort();}, 5000);

    // call graceful stop routine
    await Service.stop();

    clean_exit = true;
    process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals.bind(this));
//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals.bind(this));

//do something when app is closing
process.on("exit", async () => {
    console.log("Microservice - exiting...");
});
process.on("uncaughtException", (err: Error) => {
    console.log(err);
    console.log("UncaughtException - EXITING...");
    process.exit(999);
});
