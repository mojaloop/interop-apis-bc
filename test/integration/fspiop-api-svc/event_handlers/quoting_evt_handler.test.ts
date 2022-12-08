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

 "use strict"

import { Request, Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { QuoteErrorEvt, QuoteErrorEvtPayload, QuoteQueryResponseEvt, QuoteQueryResponseEvtPayload, QuoteRequestAcceptedEvt, QuoteRequestAcceptedEvtPayload, QuoteRequestReceivedEvt, QuoteResponseAccepted, QuoteResponseAcceptedEvtPayload, QuotingBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
import waitForExpect from "wait-for-expect";
import jestOpenAPI from 'jest-openapi';
import path from "path";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, '../../../../packages/fspiop-api-svc/api-specs/quoting-service/api-swagger.yaml'));
 
import KafkaProducer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";

const kafkaProducer = new KafkaProducer()

const localhostUrl = 'http://127.0.0.1:4040';
const KAFKA_QUOTING_TOPIC = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainEvents;
const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || 'OperatorBcErrors';

const quoteEntity = "quotes";

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
import {ParticipantRoutes} from "../../../../packages/fspiop-api-svc/src/http_routes/account-lookup-bc/participant_routes";
import {PartyRoutes} from "../../../../packages/fspiop-api-svc/src/http_routes/account-lookup-bc/party_routes";
import { MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { QuotingEventHandler } from "../../../../packages/fspiop-api-svc/src/event_handlers/quoting_evt_handler";
import {Participant, ParticipantsHttpClient} from "@mojaloop/participants-bc-client-lib";

const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const APP_VERSION = "0.0.1";

const SVC_DEFAULT_HTTP_PORT = 4000;

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_CERT_FILE_PATH = process.env["AUDIT_CERT_FILE_PATH"] || path.join(__dirname, "../../../../packages/fspiop-api-svc/dist/tmp_key_file");
const PARTICIPANTS_URL_RESOURCE_NAME = "participants";
const PARTIES_URL_RESOURCE_NAME = "parties";

const PARTICIPANT_SVC_BASEURL = process.env["PARTICIPANT_SVC_BASEURL"] || "http://127.0.0.1:3010";


const kafkaProducerOptions = {
    kafkaBrokerList: KAFKA_URL
};

let logger:ILogger;
let expressServer: Server;
let participantRoutes:ParticipantRoutes;
let partyRoutes:PartyRoutes;
let participantServiceClient: ParticipantsHttpClient;
let auditClient:IAuditClient;


export async function setupExpress(loggerParam:ILogger): Promise<Server> {
    const app = express();
    app.use(express.json({
        type: (req)=>{
            return req.headers["content-type"]?.startsWith("application/vnd.interoperability.") || false;
        }
    })); // for parsing application/json
    app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

    participantRoutes = new ParticipantRoutes(kafkaProducerOptions, KAFKA_QUOTING_TOPIC, loggerParam);
    partyRoutes = new PartyRoutes(kafkaProducerOptions, KAFKA_QUOTING_TOPIC, loggerParam);

    await participantRoutes.init();
    await partyRoutes.init();

    app.use(`/${PARTICIPANTS_URL_RESOURCE_NAME}`, participantRoutes.router);
    app.use(`/${PARTIES_URL_RESOURCE_NAME}`, partyRoutes.router);

    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        // catch all
        loggerParam.warn(`Received unhandled request to url: ${req.url}`);
        res.sendStatus(404);
        next();
    });

    return createServer(app);
}

let quotingEvtHandler:QuotingEventHandler;

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

    quotingEvtHandler = new QuotingEventHandler(
            logger,
            kafkaJsonConsumerOptions,
            kafkaJsonProducerOptions,
            [KAFKA_QUOTING_TOPIC],
            participantServiceClient
    );
    await quotingEvtHandler.init();
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
        
    } else{
        logger = loggerParam;
    }

    if(!auditClientParam) {
        const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_CERT_FILE_PATH);
        const auditDispatcher = new KafkaAuditClientDispatcher(kafkaProducerOptions, KAFKA_AUDITS_TOPIC, logger);
        // NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
        auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);

        await auditClient.init();
    } else{
        auditClient = auditClientParam;
    }


    const fixedToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InVVbFFjbkpJUk93dDIxYXFJRGpRdnVnZERvUlYzMzEzcTJtVllEQndDbWMifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwYXJ0aWNpcGFudHMtc3ZjIiwicm9sZXMiOlsiNTI0YTQ1Y2QtNGIwOS00NmVjLThlNGEtMzMxYTVkOTcyNmVhIl0sImlhdCI6MTY2Njc3MTgyOSwiZXhwIjoxNjY3Mzc2NjI5LCJhdWQiOiJtb2phbG9vcC52bmV4dC5kZWZhdWx0X2F1ZGllbmNlIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDozMjAxLyIsInN1YiI6ImFwcDo6cGFydGljaXBhbnRzLXN2YyIsImp0aSI6IjMzNDUyODFiLThlYzktNDcyOC1hZGVkLTdlNGJmMzkyMGZjMSJ9.s2US9fEAE3SDdAtxxttkPIyxmNcACexW3Z-8T61w96iji9muF_Zdj2koKvf9tICd25rhtCkolI03hBky3mFNe4c7U1sV4YUtCNNRgReMZ69rS9xdfquO_gIaABIQFsu1WTc7xLkAccPhTHorartdQe7jvGp-tOSkqA-azj0yGjwUccFhX3Bgg3rWasmJDbbblIMih4SJuWE7MGHQxMzhX6c9l1TI-NpFRRFDTYTg1H6gXhBvtHMXnC9PPbc9x_RxAPBqmMcleIJZiMZ8Cn805OL9Wt_sMFfGPdAQm0l4cdjdesgfQahsrtCOAcp5l7NKmehY0pbLmjvP6zlrDM_D3A";

    participantServiceClient = new ParticipantsHttpClient(logger, PARTICIPANT_SVC_BASEURL, fixedToken, 5000);

    await setupEventHandlers();

    const app = await setupExpress(logger);

    const portNum = SVC_DEFAULT_HTTP_PORT;

    expressServer = app.listen(portNum, () => {
        console.log(`🚀 Server ready at: http://localhost:${portNum}`);
        logger.info("Fspiop-api service started");
    });
}

export async function stop(){
    await quotingEvtHandler.destroy();
    await expressServer.closeAllConnections();
    await expressServer.close();
    await auditClient.destroy();
    setTimeout(async () => {
        await (logger as KafkaLogger).destroy();
    }, 5000);
}
 
jest.setTimeout(20000);

const validPostPayload = {
    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
    "payee": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "1",
        "fspId": "fspPayeeOriginal",
        partySubIdOrType: null
      },
      merchantClassificationCode: null,
      name: null,
      personalInfo: null
    },
    "payer": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "1",
        "fspId": "fspPayerOriginal",
        partySubIdOrType: null
      },
      merchantClassificationCode: null,
      name: null,
      personalInfo: null
    },
    "amountType": Enums.AmountTypeEnum.SEND,
    "amount": {
      "currency": "EUR",
      "amount": "1"
    },
    "transactionType": {
      "scenario": "DEPOSIT",
      "initiator": "PAYER",
      "initiatorType": "BUSINESS",
      subScenario: null,
      refundInfo: null,
      balanceOfPayments: null,
    },
    
    transactionRequestId: null,
    fees: null,
    geoCode: null,
    note: null,
    expiration: null,
    extensionList: null
}

const validPutPayload = {
    "transferAmount": {
        "currency": "EUR",
        "amount": "1"
      },
      "expiration": "2022-12-06T09:47:12.783Z",
      "ilpPacket": "AYICFwAAAAAAAABkFGcudW5kZWZpbmVkLm1zaXNkbi4xggH2ZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTjJZMVpEazNPRFF0TTJFMU55MDFPRFkxTFRsaFlUQXROMlJrWlRjM09URTFORGhoSWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMll5WmpGbU5DSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNKOWZTd2ljR0Y1WlhJaU9uc2ljR0Z5ZEhsSlpFbHVabThpT25zaWNHRnlkSGxKWkZSNWNHVWlPaUpOVTBsVFJFNGlMQ0p3WVhKMGVVbGtaVzUwYVdacFpYSWlPaUl4SW4xOUxDSmhiVzkxYm5RaU9uc2lZM1Z5Y21WdVkza2lPaUpGVlZJaUxDSmhiVzkxYm5RaU9pSXhJbjBzSW5SeVlXNXpZV04wYVc5dVZIbHdaU0k2ZXlKelkyVnVZWEpwYnlJNklrUkZVRTlUU1ZRaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkNWVk5KVGtWVFV5SjlmUQA",
      "condition": "ytl5JHBqkN1GGczeIqjN6mAgVEcilC8JVyWHDVOXoAA",
      "payeeFspCommission": {
        "currency": "EUR",
        "amount": "0.3"
      },
      "geoCode": {
        "latitude": "+90.000000",
        "longitude": "-7.882352"
      },
      "payeeReceiveAmount": {
        "currency": "EUR",
        "amount": "1"
      },
      "payeeFspFee": {
        "currency": "EUR",
        "amount": "0.2"
      },
      extensionList: null,
}


describe("FSPIOP API Service Quoting Handler", () => {
    let participantClientSpy: jest.SpyInstance;

    beforeAll(async () => {
        await start();
        await kafkaProducer.init();
    });

    beforeEach(async () => {
        participantClientSpy = jest.spyOn(participantServiceClient, "getParticipantById");

        participantClientSpy.mockResolvedValue({
                id: 1,
                participantEndpoints: [{
                    id: 1,
                    protocol: "HTTPs/REST",
                    type: "FSPIOP",
                    value: "http://127.0.0.1:4040",
                }]
        } as unknown as Participant);
    })

    afterAll(async () => {
        await stop();
        kafkaProducer.destroy();
    });

    //#region QuoteErrorEvt
    it("should successful treat QuoteErrorEvt for Quote type event", async () => {
        // Arrange
        const payload : QuoteErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: '2243fdbe-5dea-3abd-a210-3780e7f2f1f4',
            errorMsg: "test error message",
            sourceEvent: QuoteRequestReceivedEvt.name,
        };

        const event = new QuoteErrorEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${quoteEntity}/${payload.quoteId}/error`
            }));
        });


        expect(await res()).toSatisfyApiSpec();
    })

    it("should log error when QuoteErrorEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : QuoteErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: '2243fdbe-5dea-3abd-a210-3780e7f2f1f4',
            errorMsg: "test error message",
            sourceEvent: "non-existing-source-event",
        };

        const event = new QuoteErrorEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteErrorEvt.name);
        });
    })

    it("should log when QuoteErrorEvt throws an error", async () => {
        // Arrange
        const payload : QuoteErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: '2243fdbe-5dea-3abd-a210-3780e7f2f1f4',
            errorMsg: "test error message",
            sourceEvent: "non-existing-source-event",
            ...validPutPayload
        };

        const event = new QuoteErrorEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");
            
        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0)
        });
    })

    it("should use default case when QuoteErrorEvt has no correct name", async () => {
        // Arrange
        const payload : QuoteErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: '2243fdbe-5dea-3abd-a210-3780e7f2f1f4',
            errorMsg: "test error message",
            sourceEvent: "non-existing-source-event",
            ...validPutPayload
        };

        const event = new QuoteErrorEvt(payload);

        event.msgName = "non-existing-message-name";

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");
            
        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0)
        });
    })
    // //#endregion

    //#region QuoteRequestAcceptedEvt
    it("should log error when QuoteRequestAcceptedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : QuoteRequestAcceptedEvtPayload = {
            ...validPostPayload,

        };

        const event = new QuoteRequestAcceptedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-owner-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteRequestAcceptedEvt.name);
        });
    })

    it("should throw error QuoteRequestAcceptedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : QuoteRequestAcceptedEvtPayload = {
            ...validPostPayload
        };

        const event = new QuoteRequestAcceptedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${quoteEntity}/${payload.quoteId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion

     //#region QuoteResponseAccepted
     it("should successful treat QuoteResponseAccepted", async () => {
        // Arrange
        const payload : QuoteResponseAcceptedEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteResponseAccepted(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${quoteEntity}/${payload.quoteId}`
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    })

    it("should log error when QuoteResponseAccepted finds no participant endpoint", async () => {
        // Arrange
        const payload : QuoteResponseAcceptedEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteResponseAccepted(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteResponseAccepted.name);
        });
    })

    it("should throw error QuoteResponseAccepted due to failing to sendRequest", async () => {
        // Arrange
        const payload : QuoteResponseAcceptedEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteResponseAccepted(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${quoteEntity}/${payload.quoteId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion

    //#region QuoteQueryResponseEvt
    it("should successful treat QuoteQueryResponseEvt", async () => {
        // Arrange
        const payload : QuoteQueryResponseEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${quoteEntity}/${payload.quoteId}`
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    })

    it("should log error when QuoteQueryResponseEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : QuoteQueryResponseEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteQueryResponseEvt.name);
        });
    })

    it("should throw error QuoteQueryResponseEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : QuoteQueryResponseEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${quoteEntity}/${payload.quoteId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion
});