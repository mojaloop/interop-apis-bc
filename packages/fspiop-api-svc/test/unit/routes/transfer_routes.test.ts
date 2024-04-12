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

import { TransfersRoutes } from "../../../src/http_routes/transfers-bc/transfers_routes";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import request from "supertest";
import { getHeaders, getJwsConfig, getRouteValidator, MemoryConfigClientMock, MemoryMetric } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums, FspiopJwsSignature, FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import fastify, { FastifyInstance, FastifyRequest } from "fastify";
import { fastifyCors } from "@fastify/cors";
import { fastifyFormbody } from "@fastify/formbody";
import { IMetrics } from "@mojaloop/platform-shared-lib-observability-types-lib";

const packageJSON = require("../../../package.json");

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const TRANSFERS_URL_RESOURCE_NAME = "transfers";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const pathWithId = `/${Enums.EntityTypeEnum.TRANSFERS}/2243fdbe-5dea-3abd-a210-3780e7f2f1f4`;
const pathWithoutId = `/${Enums.EntityTypeEnum.TRANSFERS}`;

let configClientMock: IConfigurationClient;
let jwsHelperMock: FspiopJwsSignature;
let routeValidatorMock: FspiopValidator;
let metricsMock:IMetrics;

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Transfer", () => {
    let app: FastifyInstance;
    let fastifyServer: FastifyInstance;
    let transferRoutes: TransfersRoutes;
    let logger: ILogger;
    let authTokenUrl: string;
    let producer:IMessageProducer;

    beforeAll(async () => {
        app = fastify();
        app.addContentTypeParser('*', { parseAs: 'buffer' }, function (req:FastifyRequest, body: Buffer, done) {
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
            } catch (err:unknown) {
                done((err as Error), undefined);
            }
        });
        app.register(fastifyCors, { origin: true });
        app.register(fastifyFormbody, {
            bodyLimit: 100 * 1024 * 1024 // 100MB
        });

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
        
        routeValidatorMock = getRouteValidator();

        jwsHelperMock = getJwsConfig();

        metricsMock = new MemoryMetric(logger);

        transferRoutes = new TransfersRoutes(producer, routeValidatorMock, jwsHelperMock, metricsMock, logger);

        app.register(transferRoutes.bindRoutes, { prefix: `/${TRANSFERS_URL_RESOURCE_NAME}` }); 

        let portNum = SVC_DEFAULT_HTTP_PORT as number;
        app.listen({ port: portNum, host: "localhost" }, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });

        fastifyServer = app;

        jest.spyOn(transferRoutes, "init").mockImplementation(jest.fn());
        jest.spyOn(logger, "debug").mockImplementation(jest.fn());

        await transferRoutes.init();
    });


    afterAll(async () => {
        jest.clearAllMocks();

        await producer.destroy();
        await transferRoutes.destroy();
        await fastifyServer.close()
    });


    it("should give a bad request calling transferQueryReceived endpoint", async () => {
        // Arrange & Act
        await new Promise(resolve => setTimeout(resolve, 5000));
        const res = await request(server)
        .get(pathWithId)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.GET, null,  ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling transferQueryReceived endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithId)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.GET));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling transferPrepareRequested endpoint", async () => {
        // Arrange
        const payload = {
            "transferId": "0fbee0f5-c58e-5afe-8cdd-7e65eea2fca3",
            "payerFsp": "bluebank",
            "payeeFsp": "greenbank",
            "amount": {
                "currency": "USD",
                "amount": "10"
            },
            "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            "expiration": "2024-02-28T13:27:53.536Z",
        }

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling transferPrepareRequested endpoint", async () => {
        // Arrange
        const payload = {
            "transferId": "0fbee0f5-c58e-5afe-8cdd-7e65eea2fca3",
            "payerFsp": "bluebank",
            "payeeFsp": "greenbank",
            "amount": {
                "currency": "AED",
                "amount": "10"
            },
            "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            "expiration": "2024-02-28T13:27:53.536Z",
        }

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST));

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

    it("should give a bad request due to currency code not allowing decimals points length calling transferPrepareRequested endpoint", async () => {
        // Arrange
        const payload = {
            "transferId": "0fbee0f5-c58e-5afe-8cdd-7e65eea2fca3",
            "payerFsp": "bluebank",
            "payeeFsp": "greenbank",
            "amount": {
                "currency": "USD",
                "amount": "10.123"
            },
            "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            "expiration": "2024-02-28T13:27:53.536Z",
        }

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST));

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

    it("should throw an error on kafka producer calling transferPrepareRequested endpoint", async () => {
        // Arrange
        const payload = {
            "transferId": "0fbee0f5-c58e-5afe-8cdd-7e65eea2fca3",
            "payerFsp": "bluebank",
            "payeeFsp": "greenbank",
            "amount": {
                "currency": "USD",
                "amount": "10"
            },
            "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            "expiration": "2024-02-28T13:27:53.536Z",
        }

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling transferFulfilRequested endpoint", async () => {
        // Arrange
        const payload = {
            "transferState": "COMMITTED",
            "completedTimestamp": "2099-09-18T10:57:25.163Z",
            "fulfilment": "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0"
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling transferFulfilRequested endpoint", async () => {
        // Arrange
        const payload = {
            "transferState": "COMMITTED",
            "completedTimestamp": "2099-09-18T10:57:25.163Z",
            "fulfilment": "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0"
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling transferRejectRequested endpoint", async () => {
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
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling transferRejectRequested endpoint", async () => {
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
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.PUT));

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
