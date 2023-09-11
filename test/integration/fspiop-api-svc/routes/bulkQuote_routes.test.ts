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
import { 
    BulkQuoteRequestedEvt, 
    BulkQuotePendingReceivedEvt, 
    QuotingBCTopics 
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import KafkaConsumer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";
import { getHeaders, missingPropertyResponse } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import waitForExpect from "wait-for-expect";
import { Service } from "../../../../packages/fspiop-api-svc/src";

const server = "http://localhost:4000";

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
};

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
};

const goodStatusResponse = {
    "status": "ok"
};


const consumer = new KafkaConsumer([QuotingBCTopics.DomainRequests])

jest.setTimeout(60000);

const topic = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainRequests;

const pathWithoutBulkQuoteId = `/${Enums.EntityTypeEnum.BULK_QUOTES}`;
const pathWithBulkQuoteId = `/${Enums.EntityTypeEnum.BULK_QUOTES}/123456789`;

describe("FSPIOP API Service Bulk Quotes Routes", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init()
    });

    afterAll(async () => {
        await Service.stop();
        await consumer.destroy()
    });

    beforeEach(async () => {
        await consumer.clearEvents()
    });

    it("should successfully call bulkQuoteRequest endpoint", async () => {
        // Act
        const res = await request(server)
        .post(pathWithoutBulkQuoteId)
        .send(validPostPayload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(BulkQuoteRequestedEvt.name);
        });
    });

    it("should successfully call bulkQuotePending endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithBulkQuoteId)
        .send(validPutPayload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(BulkQuotePendingReceivedEvt.name);
        });
    });

    it("should throw with an unprocessable entity error code calling bulkQuoteRequest endpoint", async () => {
        // Act
        const res = await request(server)
        .post(pathWithoutBulkQuoteId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("bulkQuoteId", "body"));
            expect(messages.length).toBe(0);
        });
    });

    it("should give a bad request calling bulkQuoteRequest endpoint", async () => {
        // Act
        const res = await request(server)
        .post(pathWithoutBulkQuoteId)
        .send(validPostPayload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, ["date"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("date", "headers"));
            expect(messages.length).toBe(0);
        });
    });


    it("should give a bad request calling bulkQuotePending endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithBulkQuoteId)
        .send(validPutPayload)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, ["date"]));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("date", "headers"));
            expect(messages.length).toBe(0);
        });
    });


});