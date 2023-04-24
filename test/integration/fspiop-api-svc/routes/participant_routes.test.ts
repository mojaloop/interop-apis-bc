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

 "use strict";

 
import request from "supertest";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import { getCurrentKafkaOffset } from "../helpers/kafkaproducer";
import { AccountLookupBCTopics, ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, ParticipantQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { getHeaders, defaultEntryValidRequest, missingPropertyResponse } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const topic = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainRequests;

const pathWithoutSubType = `/${Enums.EntityTypeEnum.PARTICIPANTS}/MSISDN/123456789`;
const pathWithSubType = `/${Enums.EntityTypeEnum.PARTICIPANTS}/MSISDN/123456789/123`;

describe("FSPIOP API Service Participant Routes", () => {
    beforeAll(async () => {
        await Service.start();
    });
    
    afterAll(async () => {
        await Service.stop();
    });

    it("should successfully call getParticipantsByTypeAndID endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202);
        expect(res.body).toStrictEqual(null);
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantQueryReceivedEvt.name);
    });
 
    it("should successfully call getParticipantsByTypeAndIDAndSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202);
        expect(res.body).toStrictEqual(null);
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantQueryReceivedEvt.name);
    });
 

    it("should give a bad request calling getParticipantsByTypeAndID endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, ["date"]));


        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual(missingPropertyResponse("date", "headers"));
        expect(sentMessagesCount).toBe(0);
    });
 
    it("should give a bad request calling getParticipantsByTypeAndIDAndSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, ["accept"]));


        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual(missingPropertyResponse("accept", "headers"));
        expect(sentMessagesCount).toBe(0);

    });

    it("should give a bad request calling associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, ["accept"]));

        
        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual(missingPropertyResponse("accept", "headers"));
        expect(sentMessagesCount).toBe(0);
    });

    it("should give a bad request calling associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, ["date"]));


        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual(missingPropertyResponse("date", "headers"));
        expect(sentMessagesCount).toBe(0);
    });

    it("should give a bad request calling disassociatePartyByTypeAndId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .delete(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, ["content-type"]));


        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual(missingPropertyResponse("content-type", "headers"));
        expect(sentMessagesCount).toBe(0);
    });

    it("should give a bad request calling disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .delete(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, ["content-type"]));


        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400);
        expect(res.body).toStrictEqual(missingPropertyResponse("content-type", "headers"));
        expect(sentMessagesCount).toBe(0);
    });

    it("should successfully call associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202);
        expect(res.body).toStrictEqual(defaultEntryValidRequest);
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
    });

    it("should successfully call associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };

        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202);
        expect(res.body).toStrictEqual(defaultEntryValidRequest);
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
    });

    it("should successfully call disassociatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        };
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .delete(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202);
        expect(res.body).toStrictEqual(defaultEntryValidRequest);
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
    });

    it("should successfully call disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
       // Act
       const expectedOffset = await getCurrentKafkaOffset(topic);

       const res = await request(server)
       .delete(pathWithSubType)
       .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

       let sentMessagesCount = 0;
       let expectedOffsetMessage;
       const currentOffset = await getCurrentKafkaOffset(topic);
       
       if (currentOffset.offset && expectedOffset.offset) {
           sentMessagesCount = currentOffset.offset - expectedOffset.offset;
           expectedOffsetMessage = JSON.parse(currentOffset.value as string);
       }
       
       // Assert
       expect(res.statusCode).toEqual(202);
       expect(res.body).toStrictEqual(defaultEntryValidRequest);
       expect(sentMessagesCount).toBe(1);
       expect(expectedOffsetMessage.msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
    });
 });