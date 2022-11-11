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
import {ParticipantRoutes} from "./http_routes/participant_routes";
import {PartyRoutes} from "./http_routes/party_routes";
import { MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AccountLookupEventHandler } from "./event_handlers/account_lookup_evt_handler";
import { AccountLookupBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
import {ParticipantsHttpClient} from "@mojaloop/participants-bc-client-lib";
import { ParticipantRoutesbk } from "./http_routes/participant_routes_bk";
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
const AUDIT_CERT_FILE_PATH = process.env["AUDIT_CERT_FILE_PATH"] || "./dist/tmp_key_file";
const PARTICIPANTS_URL_RESOURCE_NAME = "participants";
const PARTIES_URL_RESOURCE_NAME = "parties";

const KAFKA_ACCOUNTS_LOOKUP_TOPIC = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainEvents;

const PARTICIPANT_SVC_BASEURL = process.env["PARTICIPANT_SVC_BASEURL"] || "http://127.0.0.1:3010";
const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";


const kafkaProducerOptions = {
    kafkaBrokerList: KAFKA_URL
};

// only the vars required outside the start fn
let logger:ILogger;
let expressServer: Server;
let participantRoutes:ParticipantRoutes;
let partyRoutes:PartyRoutes;
let participantServiceClient: ParticipantsHttpClient;
// let loginHelper:LoginHelper;


export async function setupExpress(loggerParam:ILogger): Promise<Server> {
    const app = express();
    app.use(express.json({
        type: (req)=>{
            return req.headers["content-type"]?.startsWith("application/vnd.interoperability.") || false;
        }
    })); // for parsing application/json
    app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

    participantRoutes = new ParticipantRoutes(kafkaProducerOptions, KAFKA_ACCOUNTS_LOOKUP_TOPIC, loggerParam);
    partyRoutes = new PartyRoutes(kafkaProducerOptions, KAFKA_ACCOUNTS_LOOKUP_TOPIC, loggerParam);

    await participantRoutes.init();

    app.use(`/${PARTICIPANTS_URL_RESOURCE_NAME}`, participantRoutes.Router);
    app.use(`/${PARTIES_URL_RESOURCE_NAME}`, partyRoutes.Router);

    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        // catch all
        loggerParam.warn(`Received unhandled request to url: ${req.url}`);
        res.sendStatus(404);
        next();
    });

    return createServer(app);
}

let accountEvtHandler:AccountLookupEventHandler;

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
            participantServiceClient
    );
    await accountEvtHandler.init();

}


export async function start(
        loggerParam?:ILogger,
        auditClient?:IAuditClient):Promise<void> {
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

    if(!auditClient) {
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
    }

    // TODO setup login helper
    //loginHelper = new LoginHelper(AUTH_N_SVC_BASEURL, logger);
    //loginHelper.init()

    const fixedToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InVVbFFjbkpJUk93dDIxYXFJRGpRdnVnZERvUlYzMzEzcTJtVllEQndDbWMifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwYXJ0aWNpcGFudHMtc3ZjIiwicm9sZXMiOlsiNTI0YTQ1Y2QtNGIwOS00NmVjLThlNGEtMzMxYTVkOTcyNmVhIl0sImlhdCI6MTY2Njc3MTgyOSwiZXhwIjoxNjY3Mzc2NjI5LCJhdWQiOiJtb2phbG9vcC52bmV4dC5kZWZhdWx0X2F1ZGllbmNlIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDozMjAxLyIsInN1YiI6ImFwcDo6cGFydGljaXBhbnRzLXN2YyIsImp0aSI6IjMzNDUyODFiLThlYzktNDcyOC1hZGVkLTdlNGJmMzkyMGZjMSJ9.s2US9fEAE3SDdAtxxttkPIyxmNcACexW3Z-8T61w96iji9muF_Zdj2koKvf9tICd25rhtCkolI03hBky3mFNe4c7U1sV4YUtCNNRgReMZ69rS9xdfquO_gIaABIQFsu1WTc7xLkAccPhTHorartdQe7jvGp-tOSkqA-azj0yGjwUccFhX3Bgg3rWasmJDbbblIMih4SJuWE7MGHQxMzhX6c9l1TI-NpFRRFDTYTg1H6gXhBvtHMXnC9PPbc9x_RxAPBqmMcleIJZiMZ8Cn805OL9Wt_sMFfGPdAQm0l4cdjdesgfQahsrtCOAcp5l7NKmehY0pbLmjvP6zlrDM_D3A";

    participantServiceClient = new ParticipantsHttpClient(logger, PARTICIPANT_SVC_BASEURL, fixedToken, 5000);


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
    expressServer.close();
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
