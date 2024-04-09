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
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const bulk_quote_routes_1 = require("../../../src/http_routes/quoting-bc/bulk_quote_routes");
const platform_shared_lib_nodejs_kafka_client_lib_1 = require("@mojaloop/platform-shared-lib-nodejs-kafka-client-lib");
const logging_bc_public_types_lib_1 = require("@mojaloop/logging-bc-public-types-lib");
const logging_bc_client_lib_1 = require("@mojaloop/logging-bc-client-lib");
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const interop_apis_bc_shared_mocks_lib_1 = require("@mojaloop/interop-apis-bc-shared-mocks-lib");
const interop_apis_bc_fspiop_utils_lib_1 = require("@mojaloop/interop-apis-bc-fspiop-utils-lib");
const fastify_1 = tslib_1.__importDefault(require("fastify"));
const cors_1 = tslib_1.__importDefault(require("@fastify/cors"));
const formbody_1 = tslib_1.__importDefault(require("@fastify/formbody"));
const packageJSON = require("../../../package.json");
const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL = process.env["LOG_LEVEL"] || logging_bc_public_types_lib_1.LogLevel.DEBUG;
const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;
const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;
const BULK_QUOTES_URL_RESOURCE_NAME = "bulkQuotes";
const kafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};
const pathWithId = `/${interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES}/2243fdbe-5dea-3abd-a210-3780e7f2f1f4`;
const pathWithoutId = `/${interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES}`;
let configClientMock;
let jwsHelperMock;
let routeValidatorMock;
jest.setTimeout(10000);
describe("FSPIOP Routes - Unit Tests Bulk Quote", () => {
    let app;
    let bulkQuoteRoutes;
    let logger;
    let authTokenUrl;
    let producer;
    beforeAll(async () => {
        app = (0, fastify_1.default)();
        app.addContentTypeParser('*', { parseAs: 'buffer' }, function (req, body, done) {
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
                }
                else {
                    // If not a supported content type, do not parse the body
                    done(null, undefined);
                }
            }
            catch (err) {
                done(err, undefined);
            }
        });
        app.register(cors_1.default, { origin: true });
        app.register(formbody_1.default, {
            bodyLimit: 100 * 1024 * 1024 // 100MB
        });
        logger = new logging_bc_client_lib_1.KafkaLogger(BC_NAME, APP_NAME, APP_VERSION, kafkaJsonProducerOptions, KAFKA_LOGS_TOPIC, LOGLEVEL);
        authTokenUrl = "mocked_auth_url";
        configClientMock = new interop_apis_bc_shared_mocks_lib_1.MemoryConfigClientMock(logger, authTokenUrl);
        producer = new platform_shared_lib_nodejs_kafka_client_lib_1.MLKafkaJsonProducer(kafkaJsonProducerOptions);
        routeValidatorMock = (0, interop_apis_bc_shared_mocks_lib_1.getRouteValidator)();
        jwsHelperMock = (0, interop_apis_bc_shared_mocks_lib_1.getJwsConfig)();
        bulkQuoteRoutes = new bulk_quote_routes_1.QuoteBulkRoutes(producer, routeValidatorMock, jwsHelperMock, logger);
        app.register(bulkQuoteRoutes.bindRoutes, { prefix: `/${BULK_QUOTES_URL_RESOURCE_NAME}` });
        let portNum = SVC_DEFAULT_HTTP_PORT;
        app.listen({ port: portNum }, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });
        jest.spyOn(bulkQuoteRoutes, "init").mockImplementation(jest.fn());
        jest.spyOn(logger, "debug").mockImplementation(jest.fn());
        await bulkQuoteRoutes.init();
    });
    afterAll(async () => {
        jest.clearAllMocks();
        await producer.destroy();
        await bulkQuoteRoutes.destroy();
        await app.close();
    });
    it("should give a bad request calling bulkQuoteQueryReceived endpoint", async () => {
        // Arrange & Act
        await new Promise(resolve => setTimeout(resolve, 5000));
        const res = await (0, supertest_1.default)(server)
            .get(pathWithId)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_TRANSFERS, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.GET, null, ["fspiop-source"]));
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });
    it("should throw an error on kafka producer calling bulkQuoteQueryReceived endpoint", async () => {
        // Arrange & Act
        const res = await (0, supertest_1.default)(server)
            .get(pathWithId)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.GET));
        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });
    it("should give a bad request calling bulkQuoteRequest endpoint", async () => {
        // Arrange
        const bulkQuoteRequest = {
            "bulkQuoteId": "2244fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "fspId": "bluebank"
                }
            },
            "geoCode": {
                "latitude": "8.0",
                "longitude": "48.5378"
            },
            "expiration": "2099-01-04T22:49:25.375Z",
            "individualQuotes": [
                {
                    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f9",
                    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791648a",
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "1",
                            "fspId": "greenbank"
                        }
                    },
                    "amountType": "SEND",
                    "amount": {
                        "currency": "EUR",
                        "amount": "1"
                    },
                    "transactionType": {
                        "scenario": "DEPOSIT",
                        "initiator": "PAYER",
                        "initiatorType": "BUSINESS"
                    },
                    "status": "PENDING"
                }
            ]
        };
        // Act
        const bulkQuoteRes = await (0, supertest_1.default)(server)
            .post(pathWithoutId)
            .send(bulkQuoteRequest)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.POST, null, ["fspiop-source"]));
        // Assert
        expect(bulkQuoteRes.statusCode).toEqual(400);
        expect(bulkQuoteRes.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });
    it("should give a bad request due to currency code not allowed calling bulkQuoteRequest endpoint", async () => {
        // Arrange
        const bulkQuoteRequsetCurrency = {
            "bulkQuoteId": "2244fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "fspId": "bluebank"
                }
            },
            "geoCode": {
                "latitude": "8.0",
                "longitude": "48.5378"
            },
            "expiration": "2099-01-04T22:49:25.375Z",
            "individualQuotes": [
                {
                    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f9",
                    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791648a",
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "1",
                            "fspId": "greenbank"
                        }
                    },
                    "amountType": "SEND",
                    "amount": {
                        "currency": "EUR",
                        "amount": "1"
                    },
                    "transactionType": {
                        "scenario": "DEPOSIT",
                        "initiator": "PAYER",
                        "initiatorType": "BUSINESS"
                    },
                    "status": "PENDING"
                }
            ]
        };
        // Act
        const bulkQuoteCurrencyRes = await (0, supertest_1.default)(server)
            .post(pathWithoutId)
            .send(bulkQuoteRequsetCurrency)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.POST, null));
        // Assert
        expect(bulkQuoteCurrencyRes.statusCode).toEqual(400);
        expect(bulkQuoteCurrencyRes.body).toStrictEqual({
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
    it("should give a bad request due to currency code not allowing decimals points length calling bulkQuoteRequest endpoint", async () => {
        // Arrange
        const bulkQuoteRequestDecimal = {
            "bulkQuoteId": "2244fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "fspId": "bluebank"
                }
            },
            "geoCode": {
                "latitude": "8.0",
                "longitude": "48.5378"
            },
            "expiration": "2099-01-04T22:49:25.375Z",
            "individualQuotes": [
                {
                    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f9",
                    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791648a",
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "1",
                            "fspId": "greenbank"
                        }
                    },
                    "amountType": "SEND",
                    "amount": {
                        "currency": "USD",
                        "amount": "1.1234"
                    },
                    "transactionType": {
                        "scenario": "DEPOSIT",
                        "initiator": "PAYER",
                        "initiatorType": "BUSINESS"
                    },
                    "status": "PENDING"
                }
            ]
        };
        // Act
        const bulkQuoteDecimalRes = await (0, supertest_1.default)(server)
            .post(pathWithoutId)
            .send(bulkQuoteRequestDecimal)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.POST));
        // Assert
        expect(bulkQuoteDecimalRes.statusCode).toEqual(400);
        expect(bulkQuoteDecimalRes.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3100",
                "errorDescription": "Amount exceeds allowed decimal points for participant account of USD currency",
                "extensionList": null
            }
        });
    });
    it("should throw an error on kafka producer calling bulkQuoteRequest endpoint", async () => {
        // Arrange
        const bulkQuoteRequestKafka = {
            "bulkQuoteId": "2244fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "fspId": "bluebank"
                }
            },
            "geoCode": {
                "latitude": "8.0",
                "longitude": "48.5378"
            },
            "expiration": "2099-01-04T22:49:25.375Z",
            "individualQuotes": [
                {
                    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f9",
                    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791648a",
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "1",
                            "fspId": "greenbank"
                        }
                    },
                    "amountType": "SEND",
                    "amount": {
                        "currency": "USD",
                        "amount": "1"
                    },
                    "transactionType": {
                        "scenario": "DEPOSIT",
                        "initiator": "PAYER",
                        "initiatorType": "BUSINESS"
                    },
                    "status": "PENDING"
                }
            ]
        };
        // Act
        const bulkQuoteKafkaRes = await (0, supertest_1.default)(server)
            .post(pathWithoutId)
            .send(bulkQuoteRequestKafka)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.POST));
        // Assert
        expect(bulkQuoteKafkaRes.statusCode).toEqual(500);
        expect(bulkQuoteKafkaRes.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });
    it("should give a bad request calling bulkQuotePending endpoint", async () => {
        // Arrange
        const bulkQuotePending = {
            "expiration": "6908-02-29T07:27:32.463Z",
            "individualQuoteResults": [
                {
                    "quoteId": "c6607203-1a28-2101-820b-22ceb061146d",
                    "condition": "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                    "payeeFspFee": {
                        "currency": "EUR",
                        "amount": "1.23"
                    },
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "123",
                            "fspId": "greenbank"
                        },
                        "name": "John",
                        "personalInfo": {
                            "complexName": {
                                "firstName": "John",
                                "lastName": "P",
                                "middleName": "Martin"
                            },
                            "dateOfBirth": "9200-02-29"
                        },
                        "merchantClassificationCode": "78"
                    },
                    "ilpPacket": "r18Ukv==",
                    "payeeFspCommission": {
                        "currency": "USD",
                        "amount": "11"
                    },
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "22"
                    },
                    "payeeReceiveAmount": {
                        "currency": "USD",
                        "amount": "33"
                    }
                }
            ]
        };
        // Act
        const bulkQuotePendingRes = await (0, supertest_1.default)(server)
            .put(pathWithId)
            .send(bulkQuotePending)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));
        // Assert
        expect(bulkQuotePendingRes.statusCode).toEqual(400);
        expect(bulkQuotePendingRes.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });
    it("should give a bad request due to currency code not allowed calling bulkQuotePending endpoint", async () => {
        // Arrange
        const bulkQuotePendingCurrency = {
            "expiration": "6908-02-29T07:27:32.463Z",
            "individualQuoteResults": [
                {
                    "quoteId": "c6607203-1a28-2101-820b-22ceb061146d",
                    "condition": "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                    "payeeFspFee": {
                        "currency": "EUR",
                        "amount": "1.23"
                    },
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "123",
                            "fspId": "greenbank"
                        },
                        "name": "John",
                        "personalInfo": {
                            "complexName": {
                                "firstName": "John",
                                "lastName": "P",
                                "middleName": "Martin"
                            },
                            "dateOfBirth": "9200-02-29"
                        },
                        "merchantClassificationCode": "78"
                    },
                    "ilpPacket": "r18Ukv==",
                    "payeeFspCommission": {
                        "currency": "USD",
                        "amount": "11"
                    },
                    "transferAmount": {
                        "currency": "SGD",
                        "amount": "22"
                    },
                    "payeeReceiveAmount": {
                        "currency": "USD",
                        "amount": "33"
                    }
                }
            ]
        };
        // Act
        const bulkQuotePendingCurrencyRes = await (0, supertest_1.default)(server)
            .put(pathWithId)
            .send(bulkQuotePendingCurrency)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.PUT));
        // Assert
        expect(bulkQuotePendingCurrencyRes.statusCode).toEqual(400);
        expect(bulkQuotePendingCurrencyRes.body).toStrictEqual({
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
    it("should give a bad request due to currency code not allowing decimals points length calling bulkQuotePending endpoint", async () => {
        // Arrange
        const bulkQuotePendingDecimal = {
            "expiration": "6908-02-29T07:27:32.463Z",
            "individualQuoteResults": [
                {
                    "quoteId": "c6607203-1a28-2101-820b-22ceb061146d",
                    "condition": "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                    "payeeFspFee": {
                        "currency": "USD",
                        "amount": "1.1234"
                    },
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "123",
                            "fspId": "greenbank"
                        },
                        "name": "John",
                        "personalInfo": {
                            "complexName": {
                                "firstName": "John",
                                "lastName": "P",
                                "middleName": "Martin"
                            },
                            "dateOfBirth": "9200-02-29"
                        },
                        "merchantClassificationCode": "78"
                    },
                    "ilpPacket": "r18Ukv==",
                    "payeeFspCommission": {
                        "currency": "USD",
                        "amount": "11"
                    },
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "22.999"
                    },
                    "payeeReceiveAmount": {
                        "currency": "USD",
                        "amount": "33.9"
                    }
                }
            ]
        };
        // Act
        const bulkQuotePendingDecimalRes = await (0, supertest_1.default)(server)
            .put(pathWithId)
            .send(bulkQuotePendingDecimal)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.PUT));
        // Assert
        expect(bulkQuotePendingDecimalRes.statusCode).toEqual(400);
        expect(bulkQuotePendingDecimalRes.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3100",
                "errorDescription": "Amount exceeds allowed decimal points for participant account of USD currency",
                "extensionList": null
            }
        });
    });
    it("should throw an error on kafka producer calling bulkQuotePending endpoint", async () => {
        // Arrange
        const bulkQuotePendingKafka = {
            "expiration": "6908-02-29T07:27:32.463Z",
            "individualQuoteResults": [
                {
                    "quoteId": "c6607203-1a28-2101-820b-22ceb061146d",
                    "condition": "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                    "payeeFspFee": {
                        "currency": "USD",
                        "amount": "1.23"
                    },
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "123",
                            "fspId": "greenbank"
                        },
                        "name": "John",
                        "personalInfo": {
                            "complexName": {
                                "firstName": "John",
                                "lastName": "P",
                                "middleName": "Martin"
                            },
                            "dateOfBirth": "9200-02-29"
                        },
                        "merchantClassificationCode": "78"
                    },
                    "ilpPacket": "r18Ukv==",
                    "payeeFspCommission": {
                        "currency": "USD",
                        "amount": "11"
                    },
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "22"
                    },
                    "payeeReceiveAmount": {
                        "currency": "USD",
                        "amount": "33"
                    }
                }
            ]
        };
        // Act
        const bulkQuotePendingKafkaRes = await (0, supertest_1.default)(server)
            .put(pathWithId)
            .send(bulkQuotePendingKafka)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.PUT));
        // Assert
        expect(bulkQuotePendingKafkaRes.statusCode).toEqual(500);
        expect(bulkQuotePendingKafkaRes.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });
    it("should give a bad request calling bulkQuoteRejectRequest endpoint", async () => {
        // Arrange
        const bulkQuoteRejectRequest = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "quote error description"
            }
        };
        // Act
        const res = await (0, supertest_1.default)(server)
            .put(pathWithId + "/error")
            .send(bulkQuoteRejectRequest)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });
    it("should throw an error on kafka producer calling bulkQuoteRejectRequest endpoint", async () => {
        // Arrange
        const bulkQuoteRejectRequestKafka = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "quote error description"
            }
        };
        // Act
        const res = await (0, supertest_1.default)(server)
            .put(pathWithId + "/error")
            .send(bulkQuoteRejectRequestKafka)
            .set((0, interop_apis_bc_shared_mocks_lib_1.getHeaders)(interop_apis_bc_fspiop_utils_lib_1.Enums.EntityTypeEnum.BULK_QUOTES, interop_apis_bc_fspiop_utils_lib_1.Enums.FspiopRequestMethodsEnum.PUT));
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
//# sourceMappingURL=bulkQuote_routes.test.js.map