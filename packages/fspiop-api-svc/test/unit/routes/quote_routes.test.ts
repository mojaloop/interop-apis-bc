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
import { QuoteRoutes } from "../../../src/http_routes/quoting-bc/quote_routes";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import request from "supertest";
import { MemoryConfigClientMock, getHeaders, getJwsConfig, getRouteValidator } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums, FspiopJwsSignature, FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { Server } from "http";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
const packageJSON = require("../../../package.json");

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const QUOTES_URL_RESOURCE_NAME = "quotes";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const pathWithId = `/${Enums.EntityTypeEnum.QUOTES}/2243fdbe-5dea-3abd-a210-3780e7f2f1f4`;
const pathWithoutId = `/${Enums.EntityTypeEnum.QUOTES}`;

let configClientMock: IConfigurationClient;
let jwsHelperMock: FspiopJwsSignature;
let routeValidatorMock: FspiopValidator;

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Quote", () => {
    let app: Express;
    let expressServer: Server;
    let quoteRoutes: QuoteRoutes;
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
        
        routeValidatorMock = getRouteValidator();

        jwsHelperMock = getJwsConfig();

        quoteRoutes = new QuoteRoutes(producer, routeValidatorMock, jwsHelperMock, logger);
        app.use(`/${QUOTES_URL_RESOURCE_NAME}`, quoteRoutes.router);

        let portNum = SVC_DEFAULT_HTTP_PORT;
        expressServer = app.listen(portNum, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });

        jest.spyOn(quoteRoutes, "init").mockImplementation(jest.fn());
        jest.spyOn(logger, "debug").mockImplementation(jest.fn());

        await quoteRoutes.init();
    });


    afterAll(async () => {
        jest.clearAllMocks();

        await producer.destroy();
        await quoteRoutes.destroy();
        await expressServer.close()
    });


    it("should give a bad request calling quoteQueryReceived endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling quoteQueryReceived endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.GET));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling quoteRequestReceived endpoint", async () => {
        // Arrange
        const payload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "9f5d9784-3a57-5865-9aa0-7dde77915481",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "blue_acc_1",
                    "fspId": "bluebank"
                }
            },
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "green_acc_1",
                    "fspId": "greenbank"
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": "EUR",
                "amount": "10"
            },
            "transactionType": {
                "scenario": "DEPOSIT",
                "initiator": "PAYER",
                "initiatorType": "BUSINESS"
            }
        };

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST, null,  ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling quoteRequestReceived endpoint", async () => {
        // Arrange
        const payload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "9f5d9784-3a57-5865-9aa0-7dde77915481",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "blue_acc_1",
                    "fspId": "bluebank"
                }
            },
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "green_acc_1",
                    "fspId": "greenbank"
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": "EUR",
                "amount": "10"
            },
            "transactionType": {
                "scenario": "DEPOSIT",
                "initiator": "PAYER",
                "initiatorType": "BUSINESS"
            }
        };

        // Act
        const res = await request(server)
            .post(pathWithoutId)
            .send(payload)
            .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST));

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

    it("should give a bad request due to currency code not allowing decimals points length calling quoteRequestReceived endpoint", async () => {
        // Arrange
        const payload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "9f5d9784-3a57-5865-9aa0-7dde77915481",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "blue_acc_1",
                    "fspId": "bluebank"
                }
            },
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "green_acc_1",
                    "fspId": "greenbank"
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": "USD",
                "amount": "10.1234"
            },
            "transactionType": {
                "scenario": "DEPOSIT",
                "initiator": "PAYER",
                "initiatorType": "BUSINESS"
            }
        };

        // Act
        const res = await request(server)
            .post(pathWithoutId)
            .send(payload)
            .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST));

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

    it("should throw an error on kafka producer calling quoteRequestReceived endpoint", async () => {
        // Arrange
        const payload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "9f5d9784-3a57-5865-9aa0-7dde77915481",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "blue_acc_1",
                    "fspId": "bluebank"
                }
            },
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "green_acc_1",
                    "fspId": "greenbank"
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": "USD",
                "amount": "10"
            },
            "transactionType": {
                "scenario": "DEPOSIT",
                "initiator": "PAYER",
                "initiatorType": "BUSINESS"
            }
        };

        // Act
        const res = await request(server)
        .post(pathWithoutId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling quoteResponseReceived endpoint", async () => {
        // Arrange
        const payload = {
            "transferAmount": {
                "currency": "USD",
                "amount": "1"
            },
            "expiration": "2023-09-22T20:52:37.671Z",
            "ilpPacket": "AYICSwAAAAAAAABkFGcuZ3JlZW5iYW5rLm1zaXNkbi4xggIqZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTUdaaVlXWXhZVFV0WkRneVlpMDFZbUptTFRsbVptVXRPV1E0TldabFpEbGpabVE0SWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMlkwWmpGbU5TSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNJc0ltWnpjRWxrSWpvaVozSmxaVzVpWVc1ckluMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpFaUxDSm1jM0JKWkNJNkltSnNkV1ZpWVc1ckluMTlMQ0poYlc5MWJuUWlPbnNpWTNWeWNtVnVZM2tpT2lKVlUwUWlMQ0poYlc5MWJuUWlPaUl4SW4wc0luUnlZVzV6WVdOMGFXOXVWSGx3WlNJNmV5SnpZMlZ1WVhKcGJ5STZJa1JGVUU5VFNWUWlMQ0pwYm1sMGFXRjBiM0lpT2lKUVFWbEZVaUlzSW1sdWFYUnBZWFJ2Y2xSNWNHVWlPaUpDVlZOSlRrVlRVeUo5ZlEA",
            "condition": "VFWFNc85U0f23hniAuTmwk6XVVlR0llxRZ-xqPrCShk",
            "payeeFspFee": {
                "currency": "USD",
                "amount": "0.2"
            },
            "payeeFspCommission": {
                "currency": "USD",
                "amount": "0.3"
            },
            "geoCode": {
                "latitude": "2",
                "longitude": "5.6"
            },
            "payeeReceiveAmount": {
                "currency": "USD",
                "amount": "1"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null,  ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling quoteResponseReceived endpoint", async () => {
        // Arrange
        const payload = {
            "transferAmount": {
                "currency": "AED",
                "amount": "1"
            },
            "expiration": "2023-09-22T20:52:37.671Z",
            "ilpPacket": "AYICSwAAAAAAAABkFGcuZ3JlZW5iYW5rLm1zaXNkbi4xggIqZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTUdaaVlXWXhZVFV0WkRneVlpMDFZbUptTFRsbVptVXRPV1E0TldabFpEbGpabVE0SWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMlkwWmpGbU5TSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNJc0ltWnpjRWxrSWpvaVozSmxaVzVpWVc1ckluMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpFaUxDSm1jM0JKWkNJNkltSnNkV1ZpWVc1ckluMTlMQ0poYlc5MWJuUWlPbnNpWTNWeWNtVnVZM2tpT2lKVlUwUWlMQ0poYlc5MWJuUWlPaUl4SW4wc0luUnlZVzV6WVdOMGFXOXVWSGx3WlNJNmV5SnpZMlZ1WVhKcGJ5STZJa1JGVUU5VFNWUWlMQ0pwYm1sMGFXRjBiM0lpT2lKUVFWbEZVaUlzSW1sdWFYUnBZWFJ2Y2xSNWNHVWlPaUpDVlZOSlRrVlRVeUo5ZlEA",
            "condition": "VFWFNc85U0f23hniAuTmwk6XVVlR0llxRZ-xqPrCShk",
            "payeeFspFee": {
                "currency": "AED",
                "amount": "0.2"
            },
            "payeeFspCommission": {
                "currency": "AED",
                "amount": "0.3"
            },
            "geoCode": {
                "latitude": "2",
                "longitude": "5.6"
            },
            "payeeReceiveAmount": {
                "currency": "AED",
                "amount": "1"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, ));

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
                            "value": "enum"
                        },
                        {
                            "key": "instancePath",
                            "value": "/body/amount/currency"
                        },
                        {
                            "key": "allowedValues",
                            "value": [
                                "USD"
                            ]
                        }
                    ]
                }
            }
        });
    });

    it("should give a bad request due to currency code not allowing decimals points length calling quoteResponseReceived endpoint", async () => {
        // Arrange
        const payload = {
            "transferAmount": {
                "currency": "USD",
                "amount": "1"
            },
            "expiration": "2023-09-22T20:52:37.671Z",
            "ilpPacket": "AYICSwAAAAAAAABkFGcuZ3JlZW5iYW5rLm1zaXNkbi4xggIqZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTUdaaVlXWXhZVFV0WkRneVlpMDFZbUptTFRsbVptVXRPV1E0TldabFpEbGpabVE0SWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMlkwWmpGbU5TSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNJc0ltWnpjRWxrSWpvaVozSmxaVzVpWVc1ckluMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpFaUxDSm1jM0JKWkNJNkltSnNkV1ZpWVc1ckluMTlMQ0poYlc5MWJuUWlPbnNpWTNWeWNtVnVZM2tpT2lKVlUwUWlMQ0poYlc5MWJuUWlPaUl4SW4wc0luUnlZVzV6WVdOMGFXOXVWSGx3WlNJNmV5SnpZMlZ1WVhKcGJ5STZJa1JGVUU5VFNWUWlMQ0pwYm1sMGFXRjBiM0lpT2lKUVFWbEZVaUlzSW1sdWFYUnBZWFJ2Y2xSNWNHVWlPaUpDVlZOSlRrVlRVeUo5ZlEA",
            "condition": "VFWFNc85U0f23hniAuTmwk6XVVlR0llxRZ-xqPrCShk",
            "payeeFspFee": {
                "currency": "USD",
                "amount": "0.1234"
            },
            "payeeFspCommission": {
                "currency": "USD",
                "amount": "0.3"
            },
            "geoCode": {
                "latitude": "2",
                "longitude": "5.6"
            },
            "payeeReceiveAmount": {
                "currency": "USD",
                "amount": "1"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT));

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

    it("should throw an error on kafka producer calling quoteResponseReceived endpoint", async () => {
        // Arrange
        const payload = {
            "transferAmount": {
                "currency": "USD",
                "amount": "1"
            },
            "expiration": "2023-09-22T20:52:37.671Z",
            "ilpPacket": "AYICSwAAAAAAAABkFGcuZ3JlZW5iYW5rLm1zaXNkbi4xggIqZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTUdaaVlXWXhZVFV0WkRneVlpMDFZbUptTFRsbVptVXRPV1E0TldabFpEbGpabVE0SWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMlkwWmpGbU5TSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNJc0ltWnpjRWxrSWpvaVozSmxaVzVpWVc1ckluMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpFaUxDSm1jM0JKWkNJNkltSnNkV1ZpWVc1ckluMTlMQ0poYlc5MWJuUWlPbnNpWTNWeWNtVnVZM2tpT2lKVlUwUWlMQ0poYlc5MWJuUWlPaUl4SW4wc0luUnlZVzV6WVdOMGFXOXVWSGx3WlNJNmV5SnpZMlZ1WVhKcGJ5STZJa1JGVUU5VFNWUWlMQ0pwYm1sMGFXRjBiM0lpT2lKUVFWbEZVaUlzSW1sdWFYUnBZWFJ2Y2xSNWNHVWlPaUpDVlZOSlRrVlRVeUo5ZlEA",
            "condition": "VFWFNc85U0f23hniAuTmwk6XVVlR0llxRZ-xqPrCShk",
            "payeeFspFee": {
                "currency": "USD",
                "amount": "0.2"
            },
            "payeeFspCommission": {
                "currency": "USD",
                "amount": "0.3"
            },
            "geoCode": {
                "latitude": "2",
                "longitude": "5.6"
            },
            "payeeReceiveAmount": {
                "currency": "USD",
                "amount": "1"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling quoteRejectRequest endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "quote error description"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling quoteRejectRequest endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "quote error description"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithId + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT));

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
