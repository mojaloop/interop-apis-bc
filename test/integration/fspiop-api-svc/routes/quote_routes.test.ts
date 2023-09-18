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

import path from "path";
import request from "supertest";
import jestOpenAPI from "jest-openapi";
import { QuoteQueryReceivedEvt, QuoteRequestReceivedEvt, QuoteResponseReceivedEvt, QuotingBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src";
import KafkaConsumer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";
import { getHeaders, missingPropertyResponse } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import waitForExpect from "wait-for-expect";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/dist/api_spec.yaml"));

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

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
      "currency": "USD",
      "amount": "1"
    },
    "transactionType": {
      "scenario": "DEPOSIT",
      "initiator": "PAYER",
      "initiatorType": "BUSINESS"
    }
};

const validPutPayload = {
    "transferAmount": {
        "currency": "USD",
        "amount": "1"
    },
    "expiration": "2022-12-06T09:47:12.783Z",
    "ilpPacket": "AYICFwAAAAAAAABkFGcudW5kZWZpbmVkLm1zaXNkbi4xggH2ZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTjJZMVpEazNPRFF0TTJFMU55MDFPRFkxTFRsaFlUQXROMlJrWlRjM09URTFORGhoSWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMll5WmpGbU5DSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNKOWZTd2ljR0Y1WlhJaU9uc2ljR0Z5ZEhsSlpFbHVabThpT25zaWNHRnlkSGxKWkZSNWNHVWlPaUpOVTBsVFJFNGlMQ0p3WVhKMGVVbGtaVzUwYVdacFpYSWlPaUl4SW4xOUxDSmhiVzkxYm5RaU9uc2lZM1Z5Y21WdVkza2lPaUpGVlZJaUxDSmhiVzkxYm5RaU9pSXhJbjBzSW5SeVlXNXpZV04wYVc5dVZIbHdaU0k2ZXlKelkyVnVZWEpwYnlJNklrUkZVRTlUU1ZRaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkNWVk5KVGtWVFV5SjlmUQA",
    "condition": "xmHnYE0iQnMvi1CshISk9iYCf7MG3_ZsMNN9I4HKnAo",
    "payeeFspCommission": {
        "currency": "USD",
        "amount": "0.3"
    },
    "geoCode": {
        "latitude": "+90.000000",
        "longitude": "-7.882352"
    },
    "payeeReceiveAmount": {
        "currency": "USD",
        "amount": "1"
    },
    "payeeFspFee": {
        "currency": "USD",
        "amount": "0.2"
    }
};

jest.setTimeout(60000);

const topic = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainRequests;

const pathWithoutQuoteId = `/${Enums.EntityTypeEnum.QUOTES}`;
const pathWithQuoteId = `/${Enums.EntityTypeEnum.QUOTES}/123456789`;

const consumer = new KafkaConsumer([QuotingBCTopics.DomainRequests])

describe("FSPIOP API Service Quote Routes", () => {

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

    it("should successfully call quoteQueryReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithQuoteId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(QuoteQueryReceivedEvt.name);
            expect(res).toSatisfyApiSpec();
        });
    });

    it("should successfully call quoteRequestReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .post(pathWithoutQuoteId)
        .send(validPostPayload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
            expect(res).toSatisfyApiSpec();
        });
    });

    it("should successfully call quoteResponseReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithQuoteId)
        .send(validPutPayload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(1);
            expect(messages[0].msgName).toBe(QuoteResponseReceivedEvt.name);
            expect(res).toSatisfyApiSpec();
        });
    });

    it("should throw with an unprocessable entity error code calling quoteRequestReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .post(pathWithoutQuoteId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("quoteId", "body"));
            expect(messages.length).toBe(0);
        });
    });

    it("should throw with an unprocessable entity error code calling quoteResponseReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithQuoteId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(400);
            expect(res.body).toStrictEqual(missingPropertyResponse("transferAmount", "body"));
            expect(messages.length).toBe(0);
        });
    });

    it("should give a bad request calling quoteQueryReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithQuoteId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, ["date"]));

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


    it("should give a bad request calling quoteRequestReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithQuoteId)
        .send(validPutPayload)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, ["date"]));

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
});
