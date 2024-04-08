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

import { PartyRoutes } from "../../../src/http_routes/account-lookup-bc/party_routes";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import request from "supertest";
import { MemoryConfigClientMock, getHeaders, getJwsConfig, getRouteValidator } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums, FspiopJwsSignature, FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import fastify, { FastifyInstance, FastifyRequest } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyFormbody from "@fastify/formbody";
const packageJSON = require("../../../package.json");

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const PARTIES_URL_RESOURCE_NAME = "parties";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const pathWithoutSubType = `/${Enums.EntityTypeEnum.PARTIES}/MSISDN/123456789`;
const pathWithSubType = `/${Enums.EntityTypeEnum.PARTIES}/MSISDN/123456789/123`;

let configClientMock: IConfigurationClient;
let jwsHelperMock: FspiopJwsSignature;
let routeValidatorMock: FspiopValidator;

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Party", () => {
    let app: FastifyInstance;
    let fastifyServer: FastifyInstance;
    let partyRoutes: PartyRoutes;
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

        partyRoutes = new PartyRoutes(producer, routeValidatorMock, jwsHelperMock, logger);
        app.register(partyRoutes.bindRoutes, { prefix: `/${PARTIES_URL_RESOURCE_NAME}` }); 

        let portNum = SVC_DEFAULT_HTTP_PORT as number;
        app.listen({ port: portNum }, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });

        fastifyServer = app;

        jest.spyOn(partyRoutes, "init").mockImplementation(jest.fn());
        jest.spyOn(logger, "debug").mockImplementation(jest.fn());

        await partyRoutes.init();
    });


    afterAll(async () => {
        jest.clearAllMocks();

        await producer.destroy();
        await partyRoutes.destroy();
        await fastifyServer.close()
    });


    it("should give a bad request calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Arrange & Act
        await new Promise(resolve => setTimeout(resolve, 5000));
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES,  Enums.FspiopRequestMethodsEnum.GET, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Arrange
        const currency = "AED";

        // Act
        const res = await request(server)
        .get(`${pathWithoutSubType}?currency=${currency}`)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

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

    it("should throw an error on kafka producer calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Arrange
        const currency = "AED";

        // Act
        const res = await request(server)
        .get(`${pathWithSubType}?currency=${currency}`)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

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

    it("should throw an error on kafka producer calling getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling getPartyInfoAvailableByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "party": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "greenbank",
                },
                "personalInfo": {
                    "dateOfBirth": "1968-10-22",
                    "complexName": {
                        "middleName": "P",
                        "firstName": "Paul",
                        "lastName": "Lopez"
                    }
                },
                "merchantClassificationCode": "1",
                "name": "John"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling getPartyInfoAvailableByTypeAndId endpoint", async () => {
        // Arrange
        const currency = "AED";
        const payload = {
            "party": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "greenbank",
                },
                "personalInfo": {
                    "dateOfBirth": "1968-10-22",
                    "complexName": {
                        "middleName": "P",
                        "firstName": "Paul",
                        "lastName": "Lopez"
                    }
                },
                "merchantClassificationCode": "1",
                "name": "John"
            }
        };

        // Act
        const res = await request(server)
        .get(`${pathWithoutSubType}?currency=${currency}`)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

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

    it("should throw an error on kafka producer calling getPartyInfoAvailableByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "party": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "greenbank",
                },
                "personalInfo": {
                    "dateOfBirth": "1968-10-22",
                    "complexName": {
                        "middleName": "P",
                        "firstName": "Paul",
                        "lastName": "Lopez"
                    }
                },
                "merchantClassificationCode": "1",
                "name": "John"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "party": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "greenbank",
                },
                "personalInfo": {
                    "dateOfBirth": "1968-10-22",
                    "complexName": {
                        "middleName": "P",
                        "firstName": "Paul",
                        "lastName": "Lopez"
                    }
                },
                "merchantClassificationCode": "1",
                "name": "John"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });


    it("should give a bad request due to currency code not allowed calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const currency = "AED";
        const payload = {
            "party": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "greenbank",
                },
                "personalInfo": {
                    "dateOfBirth": "1968-10-22",
                    "complexName": {
                        "middleName": "P",
                        "firstName": "Paul",
                        "lastName": "Lopez"
                    }
                },
                "merchantClassificationCode": "1",
                "name": "John"
            }
        };

        // Act
        const res = await request(server)
        .get(`${pathWithSubType}?currency=${currency}`)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

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

    it("should throw an error on kafka producer calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "party": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "greenbank",
                },
                "personalInfo": {
                    "dateOfBirth": "1968-10-22",
                    "complexName": {
                        "middleName": "P",
                        "firstName": "Paul",
                        "lastName": "Lopez"
                    }
                },
                "merchantClassificationCode": "1",
                "name": "John"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling getPartyByTypeAndIdQueryReject endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "get party by id error description"
            }
        };

        // Act
        await partyRoutes.init();

        const res = await request(server)
        .put(pathWithoutSubType + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT, null,  ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling getPartyByTypeAndIdQueryReject endpoint", async () => {
        // Arrange
        const currency = "AED";
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "get party by id error description"
            }
        };

        // Act
        const res = await request(server)
        .put(`${pathWithoutSubType}"/error?currency=${currency}`)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT));

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

    it("should throw an error on kafka producer calling getPartyByTypeAndIdQueryReject endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "get party by id error description"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithoutSubType + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling getPartyByTypeAndIdAndSubIdQueryReject endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "get party by id and subId error description"
            }
        };

        // Act
        await partyRoutes.init();

        const res = await request(server)
        .put(pathWithSubType + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling getPartyByTypeAndIdAndSubIdQueryReject endpoint", async () => {
        // Arrange
        const currency = "AED";
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "get party by id error description"
            }
        };

        // Act
        const res = await request(server)
        .put(`${pathWithSubType}"/error?currency=${currency}`)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT));

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

    it("should throw an error on kafka producer calling getPartyByTypeAndIdQueryReject endpoint", async () => {
        // Arrange
        const payload = {
            "errorInformation": {
                "errorCode": "1234",
                "errorDescription": "get party by id error description"
            }
        };

        // Act
        const res = await request(server)
        .put(pathWithSubType + "/error")
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.PUT));

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
