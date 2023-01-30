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
import path from "path";
import { IParticipantService } from "./interfaces/infrastructure";
import { ParticipantAdapter } from "@mojaloop/interop-apis-bc-implementations";
// import {AuthorizationClient, LoginHelper} from "@mojaloop/security-bc-client-lib";



const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const APP_VERSION = "0.0.1";

const SVC_DEFAULT_HTTP_PORT = 4000;

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_CERT_FILE_PATH = process.env["AUDIT_CERT_FILE_PATH"] || path.join(__dirname, "../dist/tmp_key_file");

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

const PARTICIPANT_SVC_BASEURL = process.env["PARTICIPANT_SVC_BASEURL"] || "http://localhost:3010";
// const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";


const kafkaProducerOptions: MLKafkaRawProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    partitioner: MLKafkaRawProducerPartitioners.MURMUR2
};

// only the vars required outside the start fn
let logger:ILogger;
let expressServer: Server;
let participantRoutes:ParticipantRoutes;
let partyRoutes:PartyRoutes;
let quotesRoutes:QuoteRoutes;
let bulkQuotesRoutes:QuoteBulkRoutes;
let transfersRoutes:TransfersRoutes;
let participantService: IParticipantService;
let auditClient: IAuditClient;
// let loginHelper:LoginHelper;


export async function setupExpress(loggerParam:ILogger): Promise<Server> {
    const app = express();
    app.use(express.json({
        limit: '100mb',
        type: (req)=>{
            return req.headers["content-type"]?.startsWith("application/vnd.interoperability.") || false;
        }
    })); // for parsing application/json
    app.use(express.urlencoded({limit: '100mb', extended: true})); // for parsing application/x-www-form-urlencoded

    participantRoutes = new ParticipantRoutes(kafkaProducerOptions, KAFKA_ACCOUNTS_LOOKUP_TOPIC, loggerParam);
    partyRoutes = new PartyRoutes(kafkaProducerOptions, KAFKA_ACCOUNTS_LOOKUP_TOPIC, loggerParam);

    await participantRoutes.init();
    await partyRoutes.init();

    app.use(`/${PARTICIPANTS_URL_RESOURCE_NAME}`, participantRoutes.router);
    app.use(`/${PARTIES_URL_RESOURCE_NAME}`, partyRoutes.router);

    quotesRoutes = new QuoteRoutes(kafkaProducerOptions,  KAFKA_QUOTES_LOOKUP_TOPIC, loggerParam);
    bulkQuotesRoutes = new QuoteBulkRoutes(kafkaProducerOptions, KAFKA_QUOTES_LOOKUP_TOPIC, loggerParam);
    transfersRoutes = new TransfersRoutes(kafkaProducerOptions,  KAFKA_TRANSFERS_TOPIC, loggerParam);

    await quotesRoutes.init();
    await bulkQuotesRoutes.init();
    await transfersRoutes.init();
    
    app.use(`/${QUOTES_URL_RESOURCE_NAME}`, quotesRoutes.router);
    app.use(`/${BULK_QUOTES_URL_RESOURCE_NAME}`, bulkQuotesRoutes.router);
    app.use(`/${TRANSFERS_URL_RESOURCE_NAME}`, transfersRoutes.router);

    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        // catch all
        loggerParam.warn(`Received unhandled request to url: ${req.url}`);
        res.sendStatus(404);
        next();
    });

    return createServer(app);
}

let accountEvtHandler:AccountLookupEventHandler;
let quotingEvtHandler:QuotingEventHandler;
let transferEvtHandler:TransferEventHandler;

async function setupEventHandlers():Promise<void>{
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
        logger,
        kafkaJsonConsumerOptions,
        kafkaJsonProducerOptions,
        [KAFKA_ACCOUNTS_LOOKUP_TOPIC],
        participantService
    );
    await accountEvtHandler.init();

    quotingEvtHandler = new QuotingEventHandler(
        logger,
        kafkaJsonConsumerOptions,
        kafkaJsonProducerOptions,
        [KAFKA_QUOTES_LOOKUP_TOPIC],
        participantService
    );
    await quotingEvtHandler.init();

    transferEvtHandler = new TransferEventHandler(
        logger,
        kafkaJsonConsumerOptions,
        kafkaJsonProducerOptions,
        [KAFKA_TRANSFERS_TOPIC],
        participantService
    );
    await transferEvtHandler.init();

}


export async function start(
        loggerParam?:ILogger,
        auditClientParam?:IAuditClient):Promise<void> {
    console.log(`Fspiop-api-svc - service starting with PID: ${process.pid}`);

    if(!loggerParam) {
        logger = new KafkaLogger(
                BC_NAME,
                APP_NAME,
                APP_VERSION,
                kafkaProducerOptions,
                KAFKA_LOGS_TOPIC,
                LOGLEVEL
        );
        await (logger as KafkaLogger).start();
    }else{
        logger = loggerParam;
    }

    if(!auditClientParam) {
        if (!existsSync(AUDIT_CERT_FILE_PATH)) {
            if (PRODUCTION_MODE) process.exit(9);

            // create e tmp file
            LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_CERT_FILE_PATH, 2048);
        }

        const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_CERT_FILE_PATH);
        const auditDispatcher = new KafkaAuditClientDispatcher(kafkaProducerOptions, KAFKA_AUDITS_TOPIC, logger);
        // NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
        auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);

        await auditClient.init();
    } else{
        auditClient = auditClientParam;
    }
    

    // TODO setup login helper
    //loginHelper = new LoginHelper(AUTH_N_SVC_BASEURL, logger);
    //loginHelper.init()

    const fixedToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Iml2SC1pVUVDRHdTVnVGS0QtRzdWc0MzS0pnLXN4TFgteWNvSjJpOTFmLTgifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzZWN1cml0eS1iYy11aSIsInJvbGVzIjpbIjI2ODBjYTRhLTRhM2EtNGU5YS1iMWZhLTY1MDAyMjkyMTAwOSJdLCJpYXQiOjE2NzExNzUxNDAsImV4cCI6MTY3MTc3OTk0MCwiYXVkIjoibW9qYWxvb3Audm5leHQuZGVmYXVsdF9hdWRpZW5jZSIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzIwMS8iLCJzdWIiOiJ1c2VyOjp1c2VyIiwianRpIjoiNDMwZmFkODUtNTMyNy00MzU5LWEwYTktOTZjMDAyOWZiMmExIn0.RbTr0ZXzLwyJqrTW3KZRxc3hwSIR4WE8t-pJZLc35_ell0kiDx94c3sxNn5mbwzM-x5gzElSBJ8jVjVMl1Q-Bc8_zy9zd62na3cnYnVWLJLBTMtRbg4I3bUAhVdHKiv8sfzZuCFM4MkvSiPC0LlyHEIqLbHsMgqLQL1VTnIwCE4yhONpG9TFzMg0uymGDG5lZ_-haI9lSxQw_f9yqmHia6iFAHyahLRv4By7Y7dglchaDfvx9UkByl6T53VlA3GVLV1CEXlzw_ZohVLiW7if8GWfF-XSRlJlw6WN1whecD7zWsjM0v4tthts_QlIksBM73zSIAYTSzWY8JdXEpd-FA";

    participantService = new ParticipantAdapter(logger, PARTICIPANT_SVC_BASEURL, fixedToken);

    await setupEventHandlers();

    const app = await setupExpress(logger);

    let portNum = SVC_DEFAULT_HTTP_PORT;
    if(process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
        portNum = parseInt(process.env["SVC_HTTP_PORT"]);
    }

    expressServer = app.listen(portNum, () => {
        console.log(`🚀 Server ready at: http://localhost:${portNum}`);
        logger.info("Fspiop-api service started");
    });
}

export async function stop(){
    await accountEvtHandler.destroy();
    await quotingEvtHandler.destroy();
    await transferEvtHandler.destroy();
    expressServer.close();
    auditClient.destroy();
    setTimeout(async () => {
        await (logger as KafkaLogger).destroy();
    }, 5000);
}

/**
 * process termination and cleanup
 */

async function _handle_int_and_term_signals(signal: NodeJS.Signals): Promise<void> {
    console.info(`Service - ${signal} received - cleaning up...`);
    let clean_exit = false;
    setTimeout(() => { clean_exit || process.abort();}, 5000);

    // call graceful stop routine
    await stop();

    clean_exit = true;
    process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals.bind(this));
//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals.bind(this));

//do something when app is closing
process.on("exit", async () => {
    logger.info("Microservice - exiting...");
});
process.on("uncaughtException", (err: Error) => {
    logger.error(err);
    console.log("UncaughtException - EXITING...");
    process.exit(999);
});
