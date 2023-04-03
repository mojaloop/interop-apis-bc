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

import { AccountLookupBCTopics, ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, ParticipantQueryReceivedEvt, PartyInfoAvailableEvt, PartyQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";

import request from "supertest";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import KafkaProducer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";
import path from "path";
import jestOpenAPI from 'jest-openapi';

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, '../../../../packages/fspiop-api-svc/api-specs/account-lookup-service/api-swagger.yaml'));

const server = "http://localhost:4000";

const workingHeaders = { 
    "accept": "application/json",
    "content-type": "application/vnd.interoperability.parties+json;version=1.1",
    "date": "randomdate",
    "fspiop-source": "test-fspiop-source",
}

const missingHeaders = { 
    "accept": "application/vnd.interoperability.parties+json;version=1.0",
    "content-type": "application/vnd.interoperability.parties+json;version=1.0",
}

const goodStatusResponse = {
    "status": "ok"
}

const badStatusResponseMissingBodyParty = {
    "errorInformation":  {
        "errorCode": "3100",
        "errorDescription": "must have required property 'party'",
        "extensionList": [
            {
                "key": "keyword",
                "value": "required",
            },
            {
                "key": "instancePath",
                "value": "/body",
            },
            {
                "key": "missingProperty",
                "value": "party",
            },
        ],
    }
}

const badStatusResponseMissingHeaderDate = {
    "errorInformation":  {
        "errorCode": "3100",
        "errorDescription": "must have required property 'date'",
        "extensionList": [
        {
            "key": "keyword",
            "value": "required",
        },
        {
            "key": "instancePath",
            "value": "/headers",
        },
        {
            "key": "missingProperty",
            "value": "date",
        },
    ],
    }
}

const topic = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainRequests;

jest.setTimeout(20000);

describe("FSPIOP API Service Participant Routes", () => {

    beforeAll(async () => {
        await Service.start();
    });
    
    afterAll(async () => {
        await Service.stop();
    });
    
    it("should successfully call getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/parties/MSISDN/123456789")
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(PartyQueryReceivedEvt.name);
    })

    it("should successfully call getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/parties/MSISDN/123456789/randomsubtype")
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(PartyQueryReceivedEvt.name);
    })

    it("should successfully call getPartyInfoAvailableByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "party": {
              "partyIdInfo": {
                "partyIdType": "MSISDN",
                "partyIdentifier": "123",
                "fspId": "Bluebank"
              }
            },
            "name": "Maria Brown",
            "personalInfo": {
              "complexName": {
                "firstName": "Maria Brown",
                "middleName": "Maria Brown",
                "lastName": "Maria Brown"
              },
              "dateOfBirth": "1954-04-21"
            }
          }

        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);
        
        const res = await request(server)
        .put("/parties/MSISDN/111")
        .send(payload)
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(PartyInfoAvailableEvt.name);
    })

    it("should successfully call getPartyInfoAvailableByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "party": {
              "partyIdInfo": {
                "partyIdType": "MSISDN",
                "partyIdentifier": "123",
                "fspId": "Bluebank"
              }
            },
            "name": "Maria Brown",
            "personalInfo": {
              "complexName": {
                "firstName": "Maria Brown",
                "middleName": "Maria Brown",
                "lastName": "Maria Brown"
              },
              "dateOfBirth": "1954-04-21"
            }
          }

        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/parties/MSISDN/123456789/randomsubtype")
        .send(payload)
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(PartyInfoAvailableEvt.name);
    })

    it("should successfully call associatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        }

        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/participants/MSISDN/123456789")
        .send(payload)
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
    })

    it("should successfully call associatePartyByTypeAndIdAndSubId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        }

        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/participants/MSISDN/123456789/randomsubtype")
        .send(payload)
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
    })

    it("should successfully call disassociatePartyByTypeAndId endpoint", async () => {
        // Arrange
        const payload = {
            "fspId": "test-fsp-id"
        }
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .delete("/participants/MSISDN/123456789")
        .send(payload)
        .set(workingHeaders)

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(goodStatusResponse)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
    })

    it("should successfully call disassociatePartyByTypeAndIdAndSubId endpoint", async () => {
       // Act
       const expectedOffset = await getCurrentKafkaOffset(topic);

       const res = await request(server)
       .delete("/participants/MSISDN/123456789/randomsubtype")
       .set(workingHeaders)

       let sentMessagesCount = 0;
       let expectedOffsetMessage;
       const currentOffset = await getCurrentKafkaOffset(topic);
       
       if (currentOffset.offset && expectedOffset.offset) {
           sentMessagesCount = currentOffset.offset - expectedOffset.offset;
           expectedOffsetMessage = JSON.parse(currentOffset.value as string);
       }
       
       // Assert
       expect(res.statusCode).toEqual(202)
       expect(res.body).toStrictEqual(goodStatusResponse)
       expect(sentMessagesCount).toBe(1);
       expect(expectedOffsetMessage.msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
    })

    it("should give a bad request calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/parties/MSISDN/123456789")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingHeaderDate)
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/parties/MSISDN/123456789")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingHeaderDate)
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling getPartyInfoAvailableByTypeAndId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/parties/MSISDN/123456789")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingBodyParty)
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/parties/MSISDN/123456789/randomsubtype")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingBodyParty)
        expect(sentMessagesCount).toBe(0);
    })

    //TTK Negative Paths

    // //#region Party info of unprovisioned party
    // it("Party info with missing fspiop source header", async () => {
    //     // Arrange
    //     const headers = {
    //         "Accept": "{$inputs.accept}",
    //         "Content-Type": "{$inputs.contentType}",
    //         "FSPIOP-Source": "{$inputs.fromFspId}"
    //     }

    //     // Act
    //     const res = await request(server)
    //     .get("/parties/inputs.toIdType/123")
    //     .set(headers)
        
    //     // Assert
    //     expect(res.statusCode).toEqual(400)
    //     // expect(res.statusText).toStrictEqual(goodStatusResponse)
    //     expect(res.body).toStrictEqual(badStatusResponseMissingHeaderDate)
    //     // expect(res).toSatisfyApiSpec();

    //     // Response should contain error information
    //     // Response should contain error code
    //     // Response should contain fspiop
    //     // Response should contain '3102'
    // })
    //#region

    // it("Party info of unprovisioned party", async () => {
    //     // Arrange
    //     const headers = {
    //         "Accept": "{$inputs.accept}",
    //         "Content-Type": "{$inputs.contentType}",
    //         "Date": "{$function.generic.curDate}",
    //         "FSPIOP-Source": "{$inputs.fromFspId}"
    //     }

    //     // Act
    //     const res = await request(server)
    //     .get("/parties/inputs.toIdType/123")
    //     .set(headers)
        
    //     // Assert
    //     expect(res.statusCode).toEqual(202)
    //     expect(res.body).toStrictEqual(goodStatusResponse)
    //     delete res.body 
    //     expect(res).toSatisfyApiSpec();
    // })
    //#region

    //End TTK Negative Paths

});