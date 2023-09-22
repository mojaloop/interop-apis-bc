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
import { PartyRoutes } from "../../src/http_routes/account-lookup-bc/party_routes";
import { MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AccountLookupBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import request from "supertest";
import { getHeaders } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { Server } from "http";
const packageJSON = require("../../package.json");

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

// Account Lookup
const PARTIES_URL_RESOURCE_NAME = "parties";

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const pathWithoutSubType = `/${Enums.EntityTypeEnum.PARTIES}/MSISDN/123456789`;
const pathWithSubType = `/${Enums.EntityTypeEnum.PARTIES}/MSISDN/123456789/123`;

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Party", () => {
    let app: Express;
    let expressServer: Server;
    let partyRoutes: PartyRoutes;
    let logger: ILogger;
    
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
        await (logger as KafkaLogger).init();
        partyRoutes = new PartyRoutes(kafkaJsonProducerOptions, AccountLookupBCTopics.DomainEvents, logger);
        app.use(`/${PARTIES_URL_RESOURCE_NAME}`, partyRoutes.router);

        let portNum = SVC_DEFAULT_HTTP_PORT;
        expressServer = app.listen(portNum, () => {
            console.log(`🚀 Server ready at: http://localhost:${portNum}`);
            console.log(`FSPIOP-API-SVC Service started, version: ${APP_VERSION}`);
        });

        jest.spyOn(partyRoutes, "init").mockImplementation(jest.fn());

        await partyRoutes.init();
    });


    afterAll(async () => {
        jest.clearAllMocks();

        await partyRoutes.destroy();
        await expressServer.close()
    });

    
    it("should give a bad request calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation": 
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation": 
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
            }
        });
    });

    it("should throw an error on kafka producer calling getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Arrange & Act
        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation": 
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation": 
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation": 
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["fspiop-source"]));

        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual({"errorInformation": 
            {
                "errorCode": "3101",
                "errorDescription": "Malformed syntax"
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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

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
