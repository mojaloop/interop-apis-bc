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

import { AccountLookupBCTopics, ParticipantAssociationRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvt, PartyInfoAvailableEvt, PartyQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import request from "supertest";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import { getCurrentKafkaOffset } from "../helpers/kafkaproducer";
import path from "path";
import jestOpenAPI from 'jest-openapi';
import { getHeaders, defaultEntryValidRequest, badStatusResponse } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, '../../../../packages/fspiop-api-svc/api-specs/account-lookup-service/api-swagger.yaml'));

const server = process.env["SVC_DEFAULT_URL"] || "http://localhost:4000";

const pathWithoutSubType = `/${Enums.EntityTypeEnum.PARTIES}/MSISDN/123456789`;
const pathWithSubType = `/${Enums.EntityTypeEnum.PARTIES}/MSISDN/123456789/123`;

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
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES))

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(PartyQueryReceivedEvt.name);
    })

    it("should successfully call getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES))

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
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
        .put(pathWithoutSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES))

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
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
        .put(pathWithSubType)
        .send(payload)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES))

        let sentMessagesCount = 0;
        let expectedOffsetMessage;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
        expect(sentMessagesCount).toBe(1);
        expect(expectedOffsetMessage.msgName).toBe(PartyInfoAvailableEvt.name);
    })

    it("should give a bad request calling getPartyQueryReceivedByTypeAndId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["date"]))

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("date", "headers"))
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling getPartyQueryReceivedByTypeAndIdSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["date"]))

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("date", "headers"))
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling getPartyInfoAvailableByTypeAndId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put(pathWithoutSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["date"]))

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("party", "body"))
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put(pathWithSubType)
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, ["date"]))

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("party", "body"))
        expect(sentMessagesCount).toBe(0);
    })

    //TTK Negative Paths

    //#region Party info of unprovisioned party
    it("Party info with missing fspiop source header", async () => {
        // Arrange
        const headers = {
            "Accept": "{$inputs.accept}",
            "Content-Type": "{$inputs.contentType}",
            "Date": "{$function.generic.curDate}"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("fspiop-source", "headers"))

    })

    it("Party info with missing date header", async () => {
        // Arrange
        const headers = {
            "Accept": "{$inputs.accept}",
            "Content-Type": "{$inputs.contentType}",
            "FSPIOP-Source": "{$inputs.fromFspId}"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("date", "headers"))
        
    })
    
    it("Party info with missing content header", async () => {
        // Arrange
        const headers = {
            "Accept": "{$inputs.accept}",
            "Date": "{$function.generic.curDate}",
            "FSPIOP-Source": "{$inputs.fromFspId}"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("content-type", "headers"))
        
    })
        
    it("Party info with missing accept header", async () => {
        // Arrange
        const headers = {
            "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
            "Date": "Wed, 05 Apr 2023 04:24:47 GMT",
            "FSPIOP-Source": "testingtoolkitdfsp"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse("accept", "headers"))
        // expect(res.headers['content-type']).toEqual(headers['Content-Type'])
        
    })
    // #region

    //#region Party info of unprovisioned party
    it("Party info of unprovisioned party", async () => {
        // Arrange
        const headers = {
            "Accept": "{$inputs.accept}",
            "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
            "Date": "{$function.generic.curDate}",
            "FSPIOP-Source": "{$inputs.fromFspId}"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
        expect(res.header["Content-Type"]).toEqual("application/vnd.interoperability.parties+json;version=1.1")
    })
    
    // it("Party info of unused type", async () => {
    //     // Arrange
    //     const headers = {
    //         "Accept": "application/vnd.interoperability.parties+json;version=1.1",
    //         "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
    //         "Date": "Wed, 05 Apr 2023 04:24:47 GMT",
    //         "FSPIOP-Source": "testingtoolkitdfsp"
    //     }

    //     // Act
    //     const res = await request(server)
    //     .get(pathWithoutSubType)
    //     .set(headers)
        
    //     // Assert
    //     expect(res.statusCode).toEqual(202)
    //     expect(res.body).toStrictEqual(defaultEntryValidRequest)
    // })
    // #region

     //#region Party info with wrong header values
    //  it("Party info with wrong date header (BUG)", async () => {
    //     // Arrange
    //     const headers = {
    //         "Accept": "{$inputs.accept}",
    //         "Content-Type": "{$inputs.contentType}",
    //         "Date": "{$function.generic.curDate}",
    //         "FSPIOP-Source": "{$inputs.fromFspId}"
    //     }

    //     // Act
    //     const res = await request(server)
    //     .get(pathWithoutSubType)
    //     .set(headers)
        
    //     // Assert
    //     expect(res.statusCode).toEqual(202)
    //     expect(res.body).toStrictEqual(defaultEntryValidRequest)
    // })
    
    // it("Party info with wrong content header(BUG)", async () => {
    //     // Arrange
    //     const headers = {
    //         "Accept": "{$inputs.accept}",
    //         "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
    //         "Date": "{$function.generic.curDate}",
    //         "FSPIOP-Source": "{$inputs.fromFspId}"
    //     }

    //     // Act
    //     const res = await request(server)
    //     .get(pathWithoutSubType)
    //     .set(headers)
        
    //     // Assert
    //     expect(res.statusCode).toEqual(202)
    //     expect(res.body).toStrictEqual(defaultEntryValidRequest)
    // })

    it("Party info with wrong accept header(BUG)", async () => {
        // Arrange
        const headers = {
            "Accept": "application/vnd.interoperability.parties+json;version=1.0",
            "Content-Type": "application/vnd.interoperability.parties+xml;version=15.5",
            "Date": "Wed, 05 Apr 2023 09:26:43 GMT",
            "FSPIOP-Source": "testingtoolkitdfsp"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
    })
    //#region
    
    //#region Get Party with wrong optional headers
    it("Get party information", async () => {
        // Arrange
        const headers = {
            "Accept": "{$inputs.accept}",
            "Content-Type": "{$inputs.contentType}",
            "Date": "{$function.generic.curDate}",
            "FSPIOP-Source": "{$inputs.fromFspId}"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
    })
    
    it("GET /parties/{Type}/{ID}", async () => {
        // Arrange
        const headers = {
            "Accept": "{$inputs.accept}",
            "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
            "Date": "{$function.generic.curDate}",
            "FSPIOP-Source": "{$inputs.fromFspId}"
        }

        // Act
        const res = await request(server)
        .get(pathWithoutSubType)
        .set(headers)
        
        // Assert
        expect(res.statusCode).toEqual(202)
        expect(res.body).toStrictEqual(defaultEntryValidRequest)
    })

    //#region
    //End TTK Negative Paths

});