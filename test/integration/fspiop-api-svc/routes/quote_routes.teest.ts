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

import { QuoteQueryReceivedEvt, QuoteRequestReceivedEvt, QuoteResponseReceivedEvt, QuotingBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
 
import request from "supertest";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import KafkaProducer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";

const server = "http://localhost:4000";

const workingHeaders = { 
    "accept": "application/vnd.interoperability.quotes+json;version=1.0",
    "content-type": "application/vnd.interoperability.quotes+json;version=1.0",
    "date": "randomdate",
    "fspiop-source": "test-fspiop-source",
}

const missingHeaders = { 
    "accept": "application/vnd.interoperability.quotes+json;version=1.0",
    "content-type": "application/vnd.interoperability.quotes+json;version=1.0",
}

const validPostPayload = {
    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
    "payee": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "1"
      }
    },
    "payer": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "1"
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
    }
}

const validPutPayload = {
    "transferAmount": {
        "currency": "EUR",
        "amount": "1"
    },
    "expiration": "2022-12-06T09:47:12.783Z",
    "ilpPacket": "AYICFwAAAAAAAABkFGcudW5kZWZpbmVkLm1zaXNkbi4xggH2ZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTjJZMVpEazNPRFF0TTJFMU55MDFPRFkxTFRsaFlUQXROMlJrWlRjM09URTFORGhoSWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMll5WmpGbU5DSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNKOWZTd2ljR0Y1WlhJaU9uc2ljR0Z5ZEhsSlpFbHVabThpT25zaWNHRnlkSGxKWkZSNWNHVWlPaUpOVTBsVFJFNGlMQ0p3WVhKMGVVbGtaVzUwYVdacFpYSWlPaUl4SW4xOUxDSmhiVzkxYm5RaU9uc2lZM1Z5Y21WdVkza2lPaUpGVlZJaUxDSmhiVzkxYm5RaU9pSXhJbjBzSW5SeVlXNXpZV04wYVc5dVZIbHdaU0k2ZXlKelkyVnVZWEpwYnlJNklrUkZVRTlUU1ZRaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkNWVk5KVGtWVFV5SjlmUQA",
    "condition": "xmHnYE0iQnMvi1CshISk9iYCf7MG3_ZsMNN9I4HKnAo",
    "payeeFspCommission": {
        "currency": "EUR",
        "amount": "0.3"
    },
    "geoCode": {
        "latitude": "+90.000000",
        "longitude": "-7.882352"
    },
    "payeeReceiveAmount": {
        "currency": "EUR",
        "amount": "1"
    },
    "payeeFspFee": {
        "currency": "EUR",
        "amount": "0.2"
    }
}

const goodStatusResponse = {
    "status": "ok"
}

const badStatusResponse = {
    "status": "not ok"
}

const badStatusResponseMissingDateHeader = {
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

const badStatusResponseMissingBodyQuoteId = {
    "errorInformation":  {
        "errorCode": "3100",
        "errorDescription": "must have required property 'quoteId'",
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
                "value": "quoteId",
            },
        ],
    }
}

const badStatusResponseMissingBodyTransferAmount = {
    "errorInformation":  {
        "errorCode": "3100",
        "errorDescription": "must have required property 'transferAmount'",
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
                "value": "transferAmount",
            },
        ],
    }
}

jest.setTimeout(20000);

const topic = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainRequests;

describe("FSPIOP API Service Quote Routes", () => {

    beforeAll(async () => {
        await Service.start();
    });
    
    afterAll(async () => {
        await Service.stop();
    });
    
    it("should successfully call quoteQueryReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/quotes/123456789")
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
        expect(expectedOffsetMessage.msgName).toBe(QuoteQueryReceivedEvt.name);
    })

    it("should successfully call quoteRequestReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/quotes")
        .send(validPostPayload)
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
        expect(expectedOffsetMessage.msgName).toBe(QuoteRequestReceivedEvt.name);
    })

    it("should successfully call quoteResponseReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/quotes/123456789")
        .send(validPutPayload)
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
        expect(expectedOffsetMessage.msgName).toBe(QuoteResponseReceivedEvt.name);
    })

    it("should throw with an unprocessable entity error code calling quoteRequestReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/quotes")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingBodyQuoteId)
        expect(sentMessagesCount).toBe(0);
    })

    it("should throw with an unprocessable entity error code calling quoteResponseReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/quotes/123456789")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingBodyTransferAmount)
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling quoteQueryReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .get("/quotes/123456789")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingDateHeader)
        expect(sentMessagesCount).toBe(0);
    })


    it("should give a bad request calling quoteRequestReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/quotes")
        .send(validPostPayload)
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingDateHeader)
        expect(sentMessagesCount).toBe(0);
    })

    it("should give a bad request calling quoteResponseReceived endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/quotes/123456789")
        .send(validPutPayload)
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingDateHeader)
        expect(sentMessagesCount).toBe(0);
    })
});