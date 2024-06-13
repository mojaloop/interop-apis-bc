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

import { IParticipantService } from "./interfaces/infrastructure";
import {AuthenticatedHttpRequester} from "@mojaloop/security-bc-client-lib";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-public-types-lib";
import path from "path";

import fs from "fs";

import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {
    DefaultConfigProvider,
    IConfigProvider
} from "@mojaloop/platform-configuration-bc-client-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";

import PromClient from "prom-client";
import {IMetrics} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {PrometheusMetrics} from "@mojaloop/platform-shared-lib-observability-client-lib";
import {FspiopJwsSignature} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

import Fastify, {FastifyInstance} from "fastify";
import fastifyUnderPressure from "@fastify/under-pressure";
import crypto from "crypto";
import {OpenTelemetryClient} from "@mojaloop/platform-shared-lib-observability-client-lib";
import { GetBoundedContextsConfigSet } from "@mojaloop/interop-apis-bc-config-lib";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const metricsPlugin = require("fastify-metrics");


//const API_SPEC_FILE_PATH = process.env["API_SPEC_FILE_PATH"] || "../dist/api_spec.yaml";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../package.json");

const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-event-handler-svc";
const APP_VERSION = packageJSON.version;

const SVC_DEFAULT_HTTP_PORT = 4001;

// Message Consumer/Publisher
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const KAFKA_AUTH_ENABLED = process.env["KAFKA_AUTH_ENABLED"] && process.env["KAFKA_AUTH_ENABLED"].toUpperCase()==="TRUE" || false;
const KAFKA_AUTH_PROTOCOL = process.env["KAFKA_AUTH_PROTOCOL"] || "sasl_plaintext";
const KAFKA_AUTH_MECHANISM = process.env["KAFKA_AUTH_MECHANISM"] || "plain";
const KAFKA_AUTH_USERNAME = process.env["KAFKA_AUTH_USERNAME"] || "user";
const KAFKA_AUTH_PASSWORD = process.env["KAFKA_AUTH_PASSWORD"] || "password";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || "/app/data/audit_private_key.pem";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "interop-api-bc-fspiop-api-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";


const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix


const PARTICIPANTS_SVC_URL = process.env["PARTICIPANTS_SVC_URL"] || "http://localhost:3010";
const PARTICIPANTS_CACHE_TIMEOUT_MS = (process.env["PARTICIPANTS_CACHE_TIMEOUT_MS"] && parseInt(process.env["PARTICIPANTS_CACHE_TIMEOUT_MS"])) || 5*60*1000;

// this service has more handlers, might take longer than the usual 30 sec
const SERVICE_START_TIMEOUT_MS= (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 120_000;

const INSTANCE_NAME = `${BC_NAME}_${APP_NAME}`;
const INSTANCE_ID = `${INSTANCE_NAME}__${crypto.randomUUID()}`;

const JWS_FILES_PATH = process.env["JWS_FILES_PATH"] || "/app/data/keys/";

const CONSUMER_BATCH_SIZE = (process.env["CONSUMER_BATCH_SIZE"] && parseInt(process.env["CONSUMER_BATCH_SIZE"])) || 1;
const CONSUMER_BATCH_TIMEOUT_MS = (process.env["CONSUMER_BATCH_TIMEOUT_MS"] && parseInt(process.env["CONSUMER_BATCH_TIMEOUT_MS"])) || 10;

// kafka common options
const kafkaProducerCommonOptions:MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${INSTANCE_ID}`,
};
const kafkaConsumerCommonOptions:MLKafkaJsonConsumerOptions ={
    kafkaBrokerList: KAFKA_URL
};
if(KAFKA_AUTH_ENABLED){
    kafkaProducerCommonOptions.authentication = kafkaConsumerCommonOptions.authentication = {
        protocol: KAFKA_AUTH_PROTOCOL as "plaintext" | "ssl" | "sasl_plaintext" | "sasl_ssl",
        mechanism: KAFKA_AUTH_MECHANISM as "PLAIN" | "GSSAPI" | "SCRAM-SHA-256" | "SCRAM-SHA-512",
        username: KAFKA_AUTH_USERNAME,
        password: KAFKA_AUTH_PASSWORD
    };
}

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    ...kafkaProducerCommonOptions,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false // never change this to true without understanding what it does
};

// JWS Signature
const JWS_DISABLED = process.env["JWS_DISABLED"] || "false";
const MAX_RAM_MB = (process.env["MAX_RAM_MB"] && parseInt(process.env["MAX_RAM_MB"])) || 128;

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

export class Service {
    static logger: ILogger;
    static app: FastifyInstance;
    static participantService: IParticipantService;
    static auditClient: IAuditClient;
    static configClient: IConfigurationClient;
    static producer:IMessageProducer;
    static metrics: IMetrics;
    static startupTimer: NodeJS.Timeout;

    static async start(
        logger?:ILogger,
        participantService?: IParticipantService,
        auditClient?: IAuditClient,
        configProvider?: IConfigProvider,
        metrics?: IMetrics,
    ):Promise<void> {
        console.log(`Fspiop-event-handler-svc - service starting with PID: ${process.pid}`);

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
                ...kafkaConsumerCommonOptions,
                kafkaGroupId: `${APP_NAME}_${Date.now()}` // unique consumer group - use instance id when possible
            }, this.logger.createChild("configClient.consumer"));
            configProvider = new DefaultConfigProvider(logger, authRequester, messageConsumer);
        }

        this.configClient = GetBoundedContextsConfigSet(BC_NAME);
        await this.configClient.init();
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

        if (!metrics) {
            const labels: Map<string, string> = new Map<string, string>();
            labels.set("bc", BC_NAME);
            labels.set("app", APP_NAME);
            labels.set("version", APP_VERSION);
            labels.set("instance_id", INSTANCE_ID);
            PrometheusMetrics.Setup({prefix: "", defaultLabels: labels}, this.logger, PromClient);
            metrics = PrometheusMetrics.getInstance();
        }
        this.metrics = metrics;

        await Service.setupTracing();

        if(!participantService){
            const participantLogger = logger.createChild("participantLogger");
            participantLogger.setLogLevel(LogLevel.INFO);

            const authRequester:IAuthenticatedHttpRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
            authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
            participantService = new ParticipantAdapter(participantLogger, PARTICIPANTS_SVC_URL, authRequester, PARTICIPANTS_CACHE_TIMEOUT_MS);
        }
        this.participantService = participantService;


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

        // Create and initialise the http hanlders
        this.producer = new MLKafkaJsonProducer(kafkaJsonProducerOptions);
        await this.producer.connect();

        await Service.setupEventHandlers(jwsHelper);

        await Service.setupFastify();

        this.logger.info(`Fspiop-api service v: ${APP_VERSION} started`);

        // remove startup timeout
        clearTimeout(this.startupTimer);
    }

    static async setupTracing():Promise<void>{
        OpenTelemetryClient.Start(BC_NAME, APP_NAME, APP_VERSION, INSTANCE_ID, this.logger);
    }

    static async setupEventHandlers(jwsHelper:FspiopJwsSignature):Promise<void>{
        const accountEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            ...kafkaConsumerCommonOptions,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_AccountLookupEventHandler`,
            batchSize: CONSUMER_BATCH_SIZE,
            batchTimeoutMs: CONSUMER_BATCH_TIMEOUT_MS
        };

        accountEvtHandler = new AccountLookupEventHandler(
            this.logger,
            accountEvtHandlerConsumerOptions,
            this.producer,
            [AccountLookupBCTopics.DomainEvents],
            this.participantService,
            jwsHelper,
            this.metrics
        );

        const quotingEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            ...kafkaConsumerCommonOptions,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_QuotingEventHandler`,
        };

        quotingEvtHandler = new QuotingEventHandler(
            this.logger,
            quotingEvtHandlerConsumerOptions,
            this.producer,
            [QuotingBCTopics.DomainEvents],
            this.participantService,
            jwsHelper,
            this.metrics
        );

        const transferEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            ...kafkaConsumerCommonOptions,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_TransferEventHandler`,
        };

        transferEvtHandler = new TransferEventHandler(
            this.logger,
            transferEvtHandlerConsumerOptions,
            this.producer,
            [TransfersBCTopics.DomainEvents],
            this.participantService,
            jwsHelper,
            this.metrics
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
                logger: false
            });

            // automatically return 503's when the system is under pressure
            this.app.register(fastifyUnderPressure, {
                maxEventLoopDelay: 200,
                maxHeapUsedBytes: MAX_RAM_MB*1024**2,
                maxRssBytes: MAX_RAM_MB*1024**2,
                maxEventLoopUtilization: 0.80,
                exposeStatusRoute: "/health"
            });

            // setup prom-bundle to automatically collect express metrics
            this.app.register(metricsPlugin, {
                routeMetrics: true,
                defaultMetrics: {enabled: false}, // already collected by our own metrics lib
                endpoint: "/metrics",
                promClient: PromClient,
            });

            let portNum = SVC_DEFAULT_HTTP_PORT;
            if(process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
                portNum = parseInt(process.env["SVC_HTTP_PORT"]);
            }

            this.app.listen({host:"0.0.0.0", port: portNum }, () => {
                this.logger.info(`🚀 Server ready at: http://0.0.0.0:${portNum}`);
                this.logger.info(`FSPIOP-EVENT-HANDLER-SVC Service started, version: ${APP_VERSION}`);
                resolve();
            });
        });
    }

    static async stop() {
        if (this.app) {
            await this.app.close();
        }
        await accountEvtHandler.destroy();
        await quotingEvtHandler.destroy();
        await transferEvtHandler.destroy();

        await this.producer.destroy();

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
    globalLogger.info(`Microservice pid: ${process.pid} - exiting...`);
});
process.on("uncaughtException", (err: Error) => {
    globalLogger.error(err);
    console.log("UncaughtException - EXITING...");
    process.exit(999);
});
