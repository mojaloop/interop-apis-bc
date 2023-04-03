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

import { BulkQuoteRequestedEvt, BulkQuotePendingReceivedEvt, QuoteResponseReceivedEvt, QuotingBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
 
import request from "supertest";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import { getCurrentKafkaOffset } from "../helpers/kafkaproducer";

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
    "bulkQuoteId": "9999fdbe-5dea-3abd-a210-3780e7f2f1f4",
    "payer": {
        "partyIdInfo": {
            "partyIdType": "MSISDN",
            "partyIdentifier": "1"
        }
    },
    "geoCode": {
        "latitude": "8.0",
        "longitude": "48.5378"
    },
    "expiration": "2023-01-04T22:49:25.375Z",
    "individualQuotes": [
        {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
            "payee": {
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
    ]
}

const validPutPayload = {
    "expiration": "2023-01-04T22:49:25.375Z",
    "individualQuoteResults": [
        {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
            "payee": {
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
    ]
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

const badStatusResponseMissingBodyBulkQuoteId = {
    "errorInformation":  {
        "errorCode": "3100",
        "errorDescription": "must have required property 'bulkQuoteId'",
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
                "value": "bulkQuoteId",
            },
        ],
    }
}

jest.setTimeout(20000);

const topic = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainRequests;

describe("FSPIOP API Service Bulk Quotes Routes", () => {

    beforeAll(async () => {
        await Service.start();
    });
    
    afterAll(async () => {
        await Service.stop();
    });
    
    it("should successfully call bulkQuoteRequest endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/bulkQuotes")
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
        expect(expectedOffsetMessage.msgName).toBe(BulkQuoteRequestedEvt.name);
    })

    it("should successfully call bulkQuotePending endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/bulkQuotes/123456789")
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
        expect(expectedOffsetMessage.msgName).toBe(BulkQuotePendingReceivedEvt.name);
    })

    it("should throw with an unprocessable entity error code calling bulkQuoteRequest endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/bulkQuotes")
        .set(missingHeaders)

        let sentMessagesCount = 0;
        const currentOffset = await getCurrentKafkaOffset(topic);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }
        
        // Assert
        expect(res.statusCode).toEqual(400)
        expect(res.body).toStrictEqual(badStatusResponseMissingBodyBulkQuoteId)
        expect(sentMessagesCount).toBe(0);
    })

    // it("should throw with an unprocessable entity error code calling bulkQuotePending endpoint", async () => {
    //     // Act
    //     const expectedOffset = await getCurrentKafkaOffset(topic);

    //     const res = await request(server)
    //     .put("/bulkQuotes/123456789")
    //     .set(missingHeaders)

    //     let sentMessagesCount = 0;
    //     const currentOffset = await getCurrentKafkaOffset(topic);
        
    //     if (currentOffset.offset && expectedOffset.offset) {
    //         sentMessagesCount = currentOffset.offset - expectedOffset.offset;
    //     }
        
    //     // Assert
    //     expect(res.statusCode).toEqual(422)
    //     expect(sentMessagesCount).toBe(0);
    // })

    it("should give a bad request calling bulkQuoteRequest endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .post("/bulkQuotes")
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


    it("should give a bad request calling bulkQuotePending endpoint", async () => {
        // Act
        const expectedOffset = await getCurrentKafkaOffset(topic);

        const res = await request(server)
        .put("/bulkQuotes/123456789")
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