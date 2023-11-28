/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
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
**/

"use strict";


import express, {Express} from "express";
import { TransfersBulkRoutes } from "../../src/http_routes/transfers-bc/bulk_transfers_routes";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import request from "supertest";
import { MemoryConfigClientMock, getHeaders } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums, JwsConfig } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { Server } from "http";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import path from "path";
import { readFileSync } from "fs";
const packageJSON = require("../../package.json");

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const BULK_TRANSFERS_URL_RESOURCE_NAME = "bulkTransfers";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const pathWithId = `/${Enums.EntityTypeEnum.BULK_TRANSFERS}/1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9`;
const pathWithoutId = `/${Enums.EntityTypeEnum.BULK_TRANSFERS}`;

let configClientMock : IConfigurationClient;

jest.setTimeout(10000);


// JWS Signature
const privKey = path.join(__dirname, "../../dist/privatekey.pem");
const pubKey = path.join(__dirname, "../../dist/publickey.cer");
const pubKeyCont = readFileSync(pubKey)
const privKeyCont = readFileSync(privKey)

const jwsConfig:JwsConfig = {
    enabled: false,
    privateKey: privKeyCont,
    publicKeys: {

    }
}

describe("FSPIOP Routes - Unit Tests Bulk Transfer", () => {
    let app: Express;
    let expressServer: Server;
    let bulkTransferRoutes: TransfersBulkRoutes;
    let logger: ILogger;
    let authTokenUrl: string;
    let producer:IMessageProducer;

    beforeAll(async () => {
        app = express();
        app.use(express.json({
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
        app.use(express.urlencoded({limit: "100mb", extended: true})); // for parsing application/x-www-form-urlencoded

        logger = new KafkaLogger(
            BC_NAME,
            APP_NAME,
            APP_VERSION,
            kafkaJsonProducerOptions,
            KAFKA_LOGS_TOPIC,
            LOGLEVEL
        );
        authTokenUrl = "mocked_auth_url";
        configClientMock = new MemoryConfigClientMock(logger, authTokenUrl);

        producer = new MLKafkaJsonProducer(kafkaJsonProducerOptions);

        bulkTransferRoutes = new TransfersBulkRoutes(configClientMock, producer, jwsConfig, logger);
        app.use(`/${BULK_TRANSFERS_URL_RESOURCE_NAME}`, bulkTransferRoutes.router);

        let portNum = SVC_DEFAULT_HTTP_PORT;
        expressServer = app.listen(portNum, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });

        jest.spyOn(bulkTransferRoutes, "init").mockImplementation(jest.fn());
        jest.spyOn(logger, "debug").mockImplementation(jest.fn());

        await bulkTransferRoutes.init();
    });


    afterAll(async () => {
        jest.clearAllMocks();

        await producer.destroy();
        await bulkTransferRoutes.destroy();
        await expressServer.close()
    });


    it("should give a bad request calling bulkTransferQueryReceived endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.GET, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling bulkTransferQueryReceived endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.GET));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling bulkTransferPrepareRequest endpoint", async () => {
        // Arrange
        const payload = {
            "bulkTransferId": "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            "bulkQuoteId": "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            "payeeFsp": "greenbank",
            "payerFsp": "bluebank",
            "individualTransfers": [
                {
                    "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                }
            ],
            "expiration": "2024-02-28T13:27:53.536Z"
        };

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling bulkTransferPrepareRequest endpoint", async () => {
        // Arrange
        const payload = {
            "bulkTransferId": "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            "bulkQuoteId": "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            "payeeFsp": "greenbank",
            "payerFsp": "bluebank",
            "individualTransfers": [
                {
                    "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "AUD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                }
            ],
            "expiration": "2024-02-28T13:27:53.536Z"
        };

        // Act
        const res = await request(server)
            .post(pathWithoutId)
            .send(payload)
            .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST, null, ));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3100",
                "errorDescription": "must be equal to one of the allowed values - path: /body/amount/currency",
                "extensionList": {
                   "extension": [
                        {
                            "key": "keyword",
                            "value": "enum",
                        },
                        {
                            "key": "instancePath",
                            "value": "/body/amount/currency",
                        },
                        {
                            "key": "allowedValues",
                            "value": [
                                "USD"
                            ],
                        }
                    ]
                }
            }
        });
    });

    it("should give a bad request due to currency code not allowing decimals points length calling bulkTransferPrepareRequest endpoint", async () => {
        // Arrange
        const payload = {
            "bulkTransferId": "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            "bulkQuoteId": "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            "payeeFsp": "greenbank",
            "payerFsp": "bluebank",
            "individualTransfers": [
                {
                    "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "1.1234"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                }
            ],
            "expiration": "2024-02-28T13:27:53.536Z"
        };

        // Act
        const res = await request(server)
            .post(pathWithoutId)
            .send(payload)
            .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3100",
                "errorDescription": "Amount exceeds allowed decimal points for participant account of USD currency",
                "extensionList": null
            }
        });
    });

    it("should throw an error on kafka producer calling bulkTransferPrepareRequest endpoint", async () => {
        // Arrange
        const payload = {
            "bulkTransferId": "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            "bulkQuoteId": "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            "payeeFsp": "greenbank",
            "payerFsp": "bluebank",
            "individualTransfers": [
                {
                    "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                }
            ],
            "expiration": "2024-02-28T13:27:53.536Z"
        };

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling bulkTransferFulfilRequested endpoint", async () => {
        // Arrange
        const payload = {
            "bulkTransferId": "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            "bulkQuoteId": "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            "payeeFsp": "greenbank",
            "payerFsp": "bluebank",
            "individualTransfers": [
                {
                    "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                }
            ],
            "expiration": "2024-02-28T13:27:53.536Z"
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling bulkTransferFulfilRequested endpoint", async () => {
        // Arrange
        const payload = {
            "bulkTransferState": "COMPLETED",
            "individualTransferResults": {
                "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                "fulfilment": "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0"            }
        };
        
        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling bulkTransfersRejectRequest endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": " error transfer description"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling bulkTransfersRejectRequest endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "transfer error description"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });
});