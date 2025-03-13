/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License")

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
*****/

"use strict";

 
import request from "supertest";
import { Service } from "../../../../packages/fspiop-api-svc/src";
import KafkaConsumer from "../helpers/kafkaproducer";
import { AccountLookupBCTopics, ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, ParticipantQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { getHeaders, defaultEntryValidRequest, missingPropertyResponse, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Constants, Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import waitForExpect from "../helpers/utils";

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const consumer = new KafkaConsumer([AccountLookupBCTopics.DomainRequests])

jest.setTimeout(60000);

const topic = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainRequests;

const pathWithoutSubType = `/${Enums.EntityTypeEnum.PARTICIPANTS}/MSISDN/123456789`;
const pathWithSubType = `/${Enums.EntityTypeEnum.PARTICIPANTS}/MSISDN/123456789/123`;

const jwsHelper = getJwsConfig();

describe("FSPIOP API Service Participant Routes", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init()
    });

    afterAll(async () => {
        await Service.stop();
        // await consumer.destroy()
    });

    beforeEach(async () => {
        await consumer.clearEvents() 
    });

    it("should successfully call getParticipantsByTypeAndID endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(ParticipantQueryReceivedEvt.name);
        });
    });
 
    it("should successfully call getParticipantsByTypeAndIDAndSubId endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(ParticipantQueryReceivedEvt.name);
        });
    });
 

    it("should give a bad request calling getParticipantsByTypeAndID endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET, null, ["date"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual({
                "errorInformation": {
                    "errorCode": "3102",
                    "errorDescription": "Invalid date-type",
                }
            });
            expect(messages.length).toBe(0);
        });
    });
 
    it("should give a bad request calling getParticipantsByTypeAndIDAndSubId endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET, null, ["accept"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual({
                "errorInformation": {
                    "errorCode": "3102",
                    "errorDescription": "accept is required",
                }
            });
            expect(messages.length).toBe(0);
        });
    });

    it("should give a bad request calling associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };
        
        // Act
        const res = await request(server)
        .post(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET, null, ["accept"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("accept", "headers"));
            expect(messages.length).toBe(0);
        });
    });

    it("should give a bad request calling associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };
        
        // Act
        const res = await request(server)
        .post(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST, null, ["date"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("date", "headers"));
            expect(messages.length).toBe(0);
        });
    });

    it("should give a bad request calling disassociatePartyByTypeAndId endpoint", async () => {
        // Act
        const res = await request(server)
        .delete(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST, null, ["content-type"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual({
                "errorInformation": {
                    "errorCode": "3102",
                    "errorDescription": "Content-type is required"
                }
            });
            expect(messages.length).toBe(0);
        });
    });

    it("should give a bad request calling disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Act
        const res = await request(server)
        .delete(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST, null, ["content-type"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual({
                "errorInformation": {
                    "errorCode": "3102",
                    "errorDescription": "Content-type is required",
                }
            });
            expect(messages.length).toBe(0);
        });
    });

    it("should successfully call associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, payload);

        // Act
        const res = await request(server)
        .post(pathWithoutSubType)
        .send(payload)
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(defaultEntryValidRequest);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
        });
    });

    it("should successfully call associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, payload);

        // Act
        const res = await request(server)
        .post(pathWithSubType)
        .send(payload)
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(defaultEntryValidRequest);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
        });
    });

    it("should successfully call disassociatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };
        
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, payload);

        // Act
        const res = await request(server)
        .delete(pathWithoutSubType)
        .send(payload)
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(defaultEntryValidRequest);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
        });
    });

    it("should successfully call disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Act
        const res = await request(server)
        .delete(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(defaultEntryValidRequest);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
        });
    });
 });