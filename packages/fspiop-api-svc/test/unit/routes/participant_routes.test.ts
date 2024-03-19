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


import { ParticipantRoutes } from "../../../src/http_routes/account-lookup-bc/participant_routes";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import request from "supertest";
import { MemoryConfigClientMock, getHeaders, getJwsConfig, getRouteValidator } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums, FspiopJwsSignature, FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import fastify, { FastifyInstance } from "fastify";
import fastifyUrlData from "@fastify/url-data";
const packageJSON = require("../../../package.json");

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const PARTICIPANTS_URL_RESOURCE_NAME = "participants";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const pathWithoutSubType = `/${Enums.EntityTypeEnum.PARTICIPANTS}/MSISDN/123456789`;
const pathWithSubType = `/${Enums.EntityTypeEnum.PARTICIPANTS}/MSISDN/123456789/123`;

let configClientMock: IConfigurationClient;
let jwsHelperMock: FspiopJwsSignature;
let routeValidatorMock: FspiopValidator;

jest.setTimeout(10000);

describe("FSPIOP Routes - Participant", () => {
    let app: FastifyInstance;
    let fastifyServer: FastifyInstance;
    let participantRoutes: ParticipantRoutes;
    let logger: ILogger;
    let authTokenUrl: string;
    let producer:IMessageProducer;

    beforeAll(async () => {
        app = fastify();
        app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
            // Custom logic to handle the request body
            const contentLength = req.headers['content-length'];
            if (contentLength) {
                // Convert content-length to a number
                req.headers['content-length'] = parseInt(contentLength) as unknown as string;
            }
        
            // Check for valid content-type
            if (
                req.headers['content-type'] &&
                (req.headers['content-type'].toUpperCase() === 'APPLICATION/JSON' ||
                    req.headers['content-type'].toUpperCase().startsWith('APPLICATION/VND.INTEROPERABILITY.'))
            ) {
                // Parse the JSON body
                try {
                    const parsedBody = JSON.parse(body as unknown as string);
                    done(null, parsedBody);
                } catch (err) {
                    done(new Error('Invalid JSON'), undefined);
                }
            } else {
                done(new Error('Invalid Content-Type'), undefined);
            }
        }); // for parsing application/json
        app.register(fastifyUrlData) // for parsing application/x-www-form-urlencoded

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

        participantRoutes = new ParticipantRoutes(producer, routeValidatorMock, jwsHelperMock, logger);
        app.register(participantRoutes.bindRoutes(), { prefix: `/${PARTICIPANTS_URL_RESOURCE_NAME}` }); 

        let portNum = SVC_DEFAULT_HTTP_PORT;
        app.listen(portNum, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });

        fastifyServer = app;
        
        jest.spyOn(participantRoutes, "init").mockImplementation(jest.fn());
        jest.spyOn(logger, "debug").mockImplementation(jest.fn());

        await participantRoutes.init();
    });


    afterAll(async () => {
        jest.clearAllMocks();
        await producer.destroy();
        await participantRoutes.destroy();

        await fastifyServer.close()
    });


    it("should give a bad request calling getParticipantsByTypeAndID endpoint", async () => {
        
        // Act
        await participantRoutes.init();

        const res = await request(server)
        .get(pathWithoutSubType)
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

    it("should give a bad request due to currency code not allowed calling getParticipantsByTypeAndID endpoint", async () => {
        // Arrange
        const currency = "AED";

        // Act
        await participantRoutes.init();

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

    it("should throw an error on kafka producer calling getParticipantsByTypeAndID endpoint", async () => {

        // Act
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

    it("should give a bad request calling getParticipantsByTypeAndIDAndSubId endpoint", async () => {
        
        // Act
        await participantRoutes.init();

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

    it("should give a bad request due to currency code not allowed calling getParticipantsByTypeAndIDAndSubId endpoint", async () => {
        // Arrange
        const currency = "AED";

        // Act
        await participantRoutes.init();

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

    it("should throw an error on kafka producer calling getParticipantsByTypeAndIDAndSubId endpoint", async () => {

        // Act
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

    it("should give a bad request calling associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        await participantRoutes.init();

        const res = await request(server)
        .post(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });


    it("should give a bad request due to currency code not allowed calling associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const currency = "AED";
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        await participantRoutes.init();

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


    it("should throw an error on kafka producer calling associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        const res = await request(server)
        .post(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        await participantRoutes.init();

        const res = await request(server)
        .post(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS,  Enums.FspiopRequestMethodsEnum.POST, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const currency = "AED";
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        await participantRoutes.init();

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

    it("should throw an error on kafka producer calling associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        const res = await request(server)
        .post(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling disassociatePartyByTypeAndId endpoint", async () => {
        // Arrange & Act
        await participantRoutes.init();

        const res = await request(server)
        .del(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling disassociatePartyByTypeAndId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .del(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE));

        // Assert
        expect(res.statusCode).toEqual(500);
        expect(res.body).toStrictEqual({
            "errorInformation": {
                "errorCode": "2001",
                "errorDescription": "Producer not connected"
            }
        });
    });

    it("should give a bad request calling disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange & Act
        await participantRoutes.init();

        const res = await request(server)
        .del(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE, null, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation":
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should give a bad request due to currency code not allowed calling disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const currency = "AED";

        // Act
        await participantRoutes.init();

        const res = await request(server)
        .del(`${pathWithSubType}?currency=${currency}`)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.DELETE));

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

    it("should throw an error on kafka producer calling disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .del(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE));

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
