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

const request = require('supertest');
import { start, stop } from "../../src/service";
import KafkaProducer, { getCurrentKafkaOffset } from "./helpers/kafkaproducer";

const server = "http://localhost:4000";

const workingHeaders = { 
    'accept': 'application/vnd.interoperability.parties+json;version=1.0',
    'content-type': 'application/vnd.interoperability.parties+json;version=1.0',
    'date': 'randomdate',
    'fspiop-source': 'test-fspiop-source',
}

const missingHeaders = { 
    'accept': 'application/vnd.interoperability.parties+json;version=1.0',
    'content-type': 'application/vnd.interoperability.parties+json;version=1.0',
}

const goodStatusResponse = {
    "status": "ok"
}

const badStatusResponse = {
    "status": "not ok"
}

const kafkaProducer = new KafkaProducer()

const topic = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainRequests;

jest.setTimeout(20000);


describe("FSPIOP API Service Participant Routes", () => {

    beforeAll(async () => {
        await start();
        await kafkaProducer.init();
    });
    
    afterAll(async () => {
        await stop();
        kafkaProducer.destroy();
    });
    
    it('should successfully call getPartyQueryReceivedByTypeAndId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get('/parties/MSISDN/123456789')
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

    it('should successfully call getPartyQueryReceivedByTypeAndIdSubId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get('/parties/MSISDN/123456789/randomsubtype')
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

    it('should successfully call getPartyInfoAvailableByTypeAndId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put('/parties/MSISDN/123456789')
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

    it('should successfully call getPartyInfoAvailableByTypeAndIdAndSubId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put('/parties/MSISDN/123456789/randomsubtype')
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

    it('should successfully call associatePartyByTypeAndId endpoint', async () => {
       // Act
       const expectedOffset = await getCurrentKafkaOffset(topic);

       const res = await request(server)
       .post('/parties/MSISDN/123456789')
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

    it('should successfully call associatePartyByTypeAndIdAndSubId endpoint', async () => {
       // Act
       const expectedOffset = await getCurrentKafkaOffset(topic);

       const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
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

    it('should successfully call disassociatePartyByTypeAndId endpoint', async () => {
       // Act
       const expectedOffset = await getCurrentKafkaOffset(topic);

       const res = await request(server)
       .delete('/parties/MSISDN/123456789')
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

    it('should successfully call disassociatePartyByTypeAndIdAndSubId endpoint', async () => {
       // Act
       const expectedOffset = await getCurrentKafkaOffset(topic);

       const res = await request(server)
       .delete('/parties/MSISDN/123456789/randomsubtype')
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

    it('should give a bad request calling getPartyQueryReceivedByTypeAndId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get('/parties/MSISDN/123456789')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling getPartyQueryReceivedByTypeAndIdSubId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get('/parties/MSISDN/123456789')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling getPartyInfoAvailableByTypeAndId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put('/parties/MSISDN/123456789')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put('/parties/MSISDN/123456789/randomsubtype')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling associatePartyByTypeAndId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post('/parties/MSISDN/123456789')
        .set(missingHeaders)
        
        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling associatePartyByTypeAndIdAndSubId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post('/parties/MSISDN/123456789/randomsubtype')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling disassociatePartyByTypeAndId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .delete('/parties/MSISDN/123456789')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })

    it('should give a bad request calling disassociatePartyByTypeAndIdAndSubId endpoint', async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .delete('/parties/MSISDN/123456789/randomsubtype')
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponse)
        expect(sentMessagesCount).toBe(0);
    })
});