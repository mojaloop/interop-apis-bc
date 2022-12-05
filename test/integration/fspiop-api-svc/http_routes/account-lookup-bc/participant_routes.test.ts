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

 
import request from "supertest";
import { start, stop } from "../../../../../packages/fspiop-api-svc/src/service";
import { getCurrentKafkaOffset } from "../../helpers/kafkaproducer";
import { AccountLookupBCTopics, ParticipantQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";

const topic = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainRequests;

const server = "http://localhost:4000";
const workingHeaders = { 
    "accept": "application/vnd.interoperability.parties+json;version=1.0",
    "content-type": "application/vnd.interoperability.parties+json;version=1.0",
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

const badStatusResponse = {
    "status": "not ok"
} 

jest.setTimeout(20000);

describe("FSPIOP API Service Participant Routes", () => {
    beforeAll(async () => {
        await start();
    });
    
    afterAll(async () => {
        await stop();
    });

    it("should successfully call getParticipantsByTypeAndID endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/participants/MSISDN/123456789")
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
        expect(expectedOffsetMessage.msgName).toBe(ParticipantQueryReceivedEvt.name);
    })
 
//     it("should successfully call getParticipantsByTypeAndIDAndSubId endpoint", async () => {
//         // Act
//         const expectedOffset = await getCurrentKafkaOffset(topic);

//         const res = await request(server)
//         .get("/participants/MSISDN/123456789/randomsubtype")
//         .set(workingHeaders)

//         let sentMessagesCount = 0;
//         let expectedOffsetMessage;
//         const currentOffset = await getCurrentKafkaOffset(topic);
        
//         if (currentOffset.offset && expectedOffset.offset) {
//             sentMessagesCount = currentOffset.offset - expectedOffset.offset;
//             expectedOffsetMessage = JSON.parse(currentOffset.value as string);
//         }
        
//         // Assert
//         expect(res.statusCode).toEqual(202)
//         expect(res.body).toStrictEqual(goodStatusResponse)
//         expect(sentMessagesCount).toBe(1);
//         expect(expectedOffsetMessage.msgName).toBe(ParticipantQueryReceivedEvt.name);
//     })
 

//    it("should give a bad request calling getParticipantsByTypeAndID endpoint", async () => {
//         // Act
//         const expectedOffset = await getCurrentKafkaOffset(topic);

//         const res = await request(server)
//         .get("/participants/MSISDN/123456789")
//         .set(missingHeaders)

//         let sentMessagesCount = 0;
//         const currentOffset = await getCurrentKafkaOffset(topic);
        
//         if (currentOffset.offset && expectedOffset.offset) {
//             sentMessagesCount = currentOffset.offset - expectedOffset.offset;
//         }
        
//         // Assert
//         expect(res.statusCode).toEqual(400)
//         expect(res.body).toStrictEqual(badStatusResponse)
//         expect(sentMessagesCount).toBe(0);
//    })
 
//    it("should give a bad request calling getParticipantsByTypeAndIDAndSubId endpoint", async () => {
//         // Act
//         const expectedOffset = await getCurrentKafkaOffset(topic);

//      const res = await request(server)
//      .get("/participants/MSISDN/123456789/randomsubtype")
//      .set(missingHeaders)

//         let sentMessagesCount = 0;
//         const currentOffset = await getCurrentKafkaOffset(topic);
        
//         if (currentOffset.offset && expectedOffset.offset) {
//             sentMessagesCount = currentOffset.offset - expectedOffset.offset;
//         }
        
//         // Assert
//         expect(res.statusCode).toEqual(400)
//         expect(res.body).toStrictEqual(badStatusResponse)
//         expect(sentMessagesCount).toBe(0);
 
//    })
 });