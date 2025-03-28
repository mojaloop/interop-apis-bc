/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

import path from "path";
import jestOpenAPI from "jest-openapi";
import { Constants, Enums, Request, PostBulkQuote, PostQuote, PutBulkQuote, PutQuote, FspiopTransformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    QuoteQueryResponseEvt,
    QuoteRequestAcceptedEvt,
    QuoteRequestReceivedEvt,
    QuoteResponseReceivedEvt,
    QuoteResponseAcceptedEvt,
    BulkQuoteRequestedEvt,
    BulkQuotePendingReceivedEvt,
    BulkQuoteQueryReceivedEvt,
    BulkQuoteQueryResponseEvt,
    BulkQuoteReceivedEvt,
    BulkQuoteAcceptedEvt,
    QuotingBCTopics,
    QuoteQueryReceivedEvt,
    QuoteBCUnknownErrorEvent,
    QuoteBCInvalidMessagePayloadErrorEvent,
    QuoteBCInvalidMessageTypeErrorEvent,
    QuoteBCInvalidBulkQuoteLengthErrorEvent,
    QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent,
    QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent,
    QuoteBCQuoteNotFoundErrorEvent,
    QuoteBCBulkQuoteNotFoundErrorEvent,
    QuoteBCInvalidDestinationFspIdErrorEvent,
    QuoteBCDuplicateQuoteErrorEvent,
    QuoteBCUnableToAddQuoteToDatabaseErrorEvent,
    QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent,
    QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent,
    QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent,
    QuoteBCInvalidRequesterFspIdErrorEvent,
    QuoteBCRequesterParticipantNotFoundErrorEvent,
    QuoteBCDestinationParticipantNotFoundErrorEvent,
    QuoteBCQuoteExpiredErrorEvent,
    QuoteBCBulkQuoteExpiredErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src/service";
import request from "supertest";
import { createMessage, getHeaders, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import KafkaConsumer from "../helpers/kafkaproducer";
import { MongoClient } from "mongodb";
import waitForExpect from "../helpers/utils";
import { QuotingErrorCodeNames } from "@mojaloop/quoting-bc-public-types-lib";

const server = process.env["SVC_DEFAULT_URL"] || "http://localhost:4000/";


// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/api-specs/api_spec.yaml"));


jest.setTimeout(60000);

// Quotes
let validPostPayload:PostQuote;
let validPutPayload:PutQuote

// Bulk Quotes
let validBulkPostPayload:PostBulkQuote;
let validBulkPutPayload:PutBulkQuote;

const consumer = new KafkaConsumer([QuotingBCTopics.DomainRequests, QuotingBCTopics.DomainEvents])
const DB_NAME = process.env.QUOTING_DB_TEST_NAME ?? "quoting";
const CONNECTION_STRING = process.env["MONGO_URL"] || "mongodb://root:mongoDbPas42@localhost:27017";
const COLLECTION_QUOTE = "quotes";
const COLLECTION_BULK_QUOTE = "bulk_quotes";

const quotesEntity = "quotes";
const bulkQuotesEntity = "bulkQuotes";

// Mongo instances
let mongoClient: MongoClient;

let sendRequestSpy = jest.spyOn(Request, "sendRequest");

const res = async () => {
    return await sendRequestSpy.mock.results[sendRequestSpy.mock.results.length-1].value;
};

const jwsHelper = getJwsConfig();

describe("FSPIOP API Service Quoting Handler", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init();
    });

    beforeEach(async () => {
        await new Promise((r) => setTimeout(r, 3000));

        await consumer.clearEvents();

        sendRequestSpy.mockClear();

        validPostPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "partySubIdOrType": null,
                    "fspId": "greenbank"
                },
                "merchantClassificationCode": null,
                "name": null,
                "personalInfo": null
            },
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "partySubIdOrType": null,
                    "fspId": "bluebank"
                },
                "merchantClassificationCode": null,
                "name": null,
                "personalInfo": null
            },
            "amountType": "SEND",
            "amount": {
                "currency": "EUR",
                "amount": "1"
            },
            "transactionType": {
                "scenario": "DEPOSIT",
                "initiator": "PAYER",
                "initiatorType": "BUSINESS",
                "subScenario": null,
                "refundInfo": null,
                "balanceOfPayments": null
            },
            "expiration": null,
            "note": null,
            "extensionList": null
          };

          validPutPayload = {
            "transferAmount": {
                "currency": "EUR",
                "amount": "1"
              },
              "expiration": "2099-12-06T09:47:12.783Z",
              "note": null,
              "ilpPacket": "AYICFwAAAAAAAABkFGcudW5kZWZpbmVkLm1zaXNkbi4xggH2ZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTjJZMVpEazNPRFF0TTJFMU55MDFPRFkxTFRsaFlUQXROMlJrWlRjM09URTFORGhoSWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMll5WmpGbU5DSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNKOWZTd2ljR0Y1WlhJaU9uc2ljR0Z5ZEhsSlpFbHVabThpT25zaWNHRnlkSGxKWkZSNWNHVWlPaUpOVTBsVFJFNGlMQ0p3WVhKMGVVbGtaVzUwYVdacFpYSWlPaUl4SW4xOUxDSmhiVzkxYm5RaU9uc2lZM1Z5Y21WdVkza2lPaUpGVlZJaUxDSmhiVzkxYm5RaU9pSXhJbjBzSW5SeVlXNXpZV04wYVc5dVZIbHdaU0k2ZXlKelkyVnVZWEpwYnlJNklrUkZVRTlUU1ZRaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkNWVk5KVGtWVFV5SjlmUQA",
              "condition": "ytl5JHBqkN1GGczeIqjN6mAgVEcilC8JVyWHDVOXoAA",
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
              },
              "extensionList": null,
        };

        validBulkPostPayload = {
            "bulkQuoteId": "2244fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "payer": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1",
                    "partySubIdOrType": null,
                    "fspId": "bluebank"
                },
                "merchantClassificationCode": null,
                "name": null,
                "personalInfo": null
            },
            "geoCode": {
                "latitude": "8.0",
                "longitude": "48.5378"
            },
            "expiration": "2099-01-04T22:49:25.375Z",
            "individualQuotes": [
                {
                    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f9",
                    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791648a",
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "1",
                            "partySubIdOrType": null,
                            "fspId": "greenbank"
                        },
                        "merchantClassificationCode": null,
                        "name": null,
                        "personalInfo": null
                    },
                    "amountType": "SEND",
                    "amount": {
                        "currency": "EUR",
                        "amount": "1"
                    },
                    "transactionType": {
                        "scenario": "DEPOSIT",
                        "initiator": "PAYER",
                        "initiatorType": "BUSINESS",
                        "subScenario": null,
                        "refundInfo": null,
                        "balanceOfPayments": null
                    },
                    "fees": null,
                    "note": null,
                    "extensionList": null
                }
            ],
            "extensionList": null
        }

        validBulkPutPayload = {
            "bulkQuoteId": "2244fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "expiration": "6908-02-29T07:27:32.463Z",
            "individualQuoteResults": [
                {
                    "quoteId": "c6607203-1a28-2101-820b-22ceb061146d",
                    "payeeFspFee": {
                        "currency": "EUR",
                        "amount": "1.23"
                    },
                    "payee": {
                        "partyIdInfo": {
                            "partyIdType": "MSISDN",
                            "partyIdentifier": "123",
                            "fspId": "greenbank",
                            "partySubIdOrType": null
                        },
                        "name": "John",
                        "personalInfo": {
                            "complexName": {
                                "firstName": "John",
                                "lastName": "P",
                                "middleName": "Martin"
                            },
                            "dateOfBirth": "9200-02-29"
                        },
                        "merchantClassificationCode": "78"
                    },
                    "payeeFspCommission": {
                        "currency": "USD",
                        "amount": "11"
                    },
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "22"
                    },
                    "payeeReceiveAmount": {
                        "currency": "USD",
                        "amount": "33"
                    },
                    "condition": "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                    "ilpPacket": "r18Ukv==",
                    "errorInformation": null,
                    "extensionList": null
                },
            ],
            "extensionList": null
        }
    });

    afterAll(async () => {
        await Service.stop();
        await consumer.destroy();

        // Start mongo client and service before conducting all tests
        mongoClient = new MongoClient(CONNECTION_STRING);
        await mongoClient.connect();

        mongoClient.connect();
        const quoteRepo = mongoClient
            .db(DB_NAME)
            .collection(COLLECTION_QUOTE);

        quoteRepo.deleteMany({})

        const bulkQuoteRepo = mongoClient
        .db(DB_NAME)
        .collection(COLLECTION_BULK_QUOTE);

        bulkQuoteRepo.deleteMany({})
    });


    // #region POST Quotes
    it("should return error event QuoteBCRequesterParticipantNotFoundErrorEvent due to non existing payer fsp", async () => {
        // Arrange
        validPostPayload.payer.partyIdInfo.fspId = "nonexistingfsp";

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(FspiopTransformer.removeEmpty(validPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event QuoteBCDestinationParticipantNotFoundErrorEvent due to non existing payee fsp", async () => {
        // Arrange
        validPostPayload.payee.partyIdInfo.fspId = "nonexistingfsp";

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(FspiopTransformer.removeEmpty(validPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCDestinationParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to currency not existing in schema rules", async () => {
        // Arrange
        validPostPayload.amount.currency = "AUD";

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(FspiopTransformer.removeEmpty(validPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent.name);
        });
    });

    it("should return error event due to quote being expired", async () => {
        // Arrange
        validPostPayload.expiration = "2022-05-24T08:38:08.699-04:00";

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(FspiopTransformer.removeEmpty(validPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCQuoteExpiredErrorEvent.name);
        });
    });

    it("should successful add a quote", async () => {
        // Arrange
        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(FspiopTransformer.removeEmpty(validPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(4);
            expect(messages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteRequestAcceptedEvt.name);
            expect(messages[2].msgName).toBe(QuoteResponseReceivedEvt.name);
            expect(messages[3].msgName).toBe(QuoteResponseAcceptedEvt.name);

            // save this quoteId to be used afterwards
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new QuoteRequestAcceptedEvt({
            ownerFspId: "nonexistingfsp",
            bulkQuoteId: "123",
        } as any)


        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #endregion

    // #region Quotes PUT
    it("should return error event due to quote response currency not existing in schema rules", async () => {
        // Arrange
        validPutPayload.transferAmount.currency = "AUD";

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPutPayload);

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.QUOTES + "/" + validPostPayload.quoteId)
        .send(FspiopTransformer.removeEmpty(validPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteResponseReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent.name);
        });
    });

    it("should return error event due to quote response having a non existing payer fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "bluebank"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPutPayload);

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.QUOTES + "/" + validPostPayload.quoteId)
        .send(FspiopTransformer.removeEmpty(validPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteResponseReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to quote response having a non existing payee fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "nonexistingfsp"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPutPayload);

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.QUOTES + "/" + validPostPayload.quoteId)
        .send(FspiopTransformer.removeEmpty(validPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteResponseReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCDestinationParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to quote response not being previously created", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validPutPayload);

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.QUOTES + "/" + "nonexistingid")
        .send(FspiopTransformer.removeEmpty(validPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteResponseReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent.name);
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new QuoteResponseAcceptedEvt({
            ownerFspId: "nonexistingfsp",
            bulkQuoteId: "123",
        } as any)


        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #endregion

    // #region GET Quote
    it("should return error event due to quote query having a non existing payer fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "greenbank"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.QUOTES + "/" + validPostPayload.quoteId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to quote not being previously created", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.QUOTES + "/" + "nonexistingid")
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCQuoteNotFoundErrorEvent.name);
        });
    });

    it("should successfully return the previously created quote", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.QUOTES + "/" + validPostPayload.quoteId)
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(QuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteQueryResponseEvt.name);
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new QuoteQueryResponseEvt({
            ownerFspId: "nonexistingfsp",
            bulkQuoteId: "123",
        } as any)


        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #endregion


    // #region POST BulkQuotes
    it("should return error event QuoteBCRequesterParticipantNotFoundErrorEvent due to non existing bulkQuote payer fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "greenbank"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.POST, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validBulkPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_QUOTES)
        .send(FspiopTransformer.removeEmpty(validBulkPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteRequestedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event QuoteBCRequesterParticipantNotFoundErrorEvent due to non existing bulkQuote payee fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "bluebank",
            "fspiop-destination": "nonexistingfsp"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.POST, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validBulkPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_QUOTES)
        .send(FspiopTransformer.removeEmpty(validBulkPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteRequestedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCDestinationParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to bulk quote being expired", async () => {
        // Arrange
        validBulkPostPayload.expiration = "2022-05-24T08:38:08.699-04:00";

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validBulkPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_QUOTES)
        .send(FspiopTransformer.removeEmpty(validBulkPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteRequestedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCBulkQuoteExpiredErrorEvent.name);
        });
    });

    it("should successful add a bulk quote", async () => {
        // Arrange
        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validBulkPostPayload);

        //Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_QUOTES)
        .send(FspiopTransformer.removeEmpty(validBulkPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(4);
            expect(messages[0].msgName).toBe(BulkQuoteRequestedEvt.name);
            expect(messages[1].msgName).toBe(BulkQuoteReceivedEvt.name);
            expect(messages[2].msgName).toBe(BulkQuotePendingReceivedEvt.name);
            expect(messages[3].msgName).toBe(BulkQuoteAcceptedEvt.name);

            // save this quoteId to be used afterwards
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new BulkQuoteReceivedEvt({
            ownerFspId: "nonexistingfsp",
            bulkQuoteId: "123",
        } as any)


        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #endregion

    // #region PUT BulkQuotes
    it("should return error event due to non existing bulkQuote response payer fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "bluebank"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, FspiopTransformer.removeEmpty(validBulkPutPayload));

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.BULK_QUOTES + "/" + validBulkPostPayload.bulkQuoteId)
        .send(FspiopTransformer.removeEmpty(validBulkPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuotePendingReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to non existing bulkQuote response payee fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "nonexistingfsp"
        };

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, FspiopTransformer.removeEmpty(validBulkPutPayload));

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.BULK_QUOTES + "/" + validBulkPostPayload.bulkQuoteId)
        .send(FspiopTransformer.removeEmpty(validBulkPutPayload))
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuotePendingReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCDestinationParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to bulkQuote response being expired", async () => {
        // Arrange
        validBulkPutPayload.expiration = "2022-05-24T08:38:08.699-04:00";

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.PUT);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, FspiopTransformer.removeEmpty(validBulkPutPayload));

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.BULK_QUOTES + "/" + validBulkPostPayload.bulkQuoteId)
        .send(FspiopTransformer.removeEmpty(validBulkPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuotePendingReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCBulkQuoteExpiredErrorEvent.name);
        });
    });

    it("should return error event due to bulkQuote response not being previously created", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank"
        };

        validBulkPutPayload.bulkQuoteId = "nonexistingid";

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.PUT, null, [], headerOverride);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, FspiopTransformer.removeEmpty(validBulkPutPayload));

        // Act
        await request(server)
        .put(Enums.EntityTypeEnum.BULK_QUOTES + "/" + "nonexistingid")
        .send(FspiopTransformer.removeEmpty(validBulkPutPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuotePendingReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent.name);
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new BulkQuoteAcceptedEvt({
            ownerFspId: "nonexistingfsp",
            bulkQuoteId: "123",
        } as any)


        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #region

    // #region GET BulkQuote
    it("should return error event due to bulk quote query having a non existing payer fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "greenbank"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.BULK_QUOTES + "/" + validPostPayload.quoteId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to bulk quote query having a non existing payee fsp", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "bluebank",
            "fspiop-destination": "nonexistingfsp"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.BULK_QUOTES + "/" + validPostPayload.quoteId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCDestinationParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to bulk quote not being previously created", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.BULK_QUOTES + "/" + "nonexistingid")
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(QuoteBCBulkQuoteNotFoundErrorEvent.name);
        });
    });

    it("should successfully return the previously created bulk quote", async () => {
        // Arrange
        const headerOverride = {
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.BULK_QUOTES + "/" + validBulkPostPayload.bulkQuoteId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_QUOTES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(BulkQuoteQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(BulkQuoteQueryResponseEvt.name);
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new BulkQuoteQueryResponseEvt({
            ownerFspId: "nonexistingfsp",
            bulkQuoteId: "123",
        } as any)


        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #endregion

    // #region Error events
    // Act
    it("should return QuoteBCUnknownErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnknownErrorEvent({
            quoteId: "123",
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorCode: QuotingErrorCodeNames.COMMAND_TYPE_UNKNOWN
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCInvalidMessagePayloadErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidMessagePayloadErrorEvent({
            errorCode: QuotingErrorCodeNames.INVALID_MESSAGE_PAYLOAD
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCInvalidMessageTypeErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidMessageTypeErrorEvent({
            errorCode: QuotingErrorCodeNames.INVALID_MESSAGE_TYPE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCInvalidBulkQuoteLengthErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidBulkQuoteLengthErrorEvent({
            bulkQuoteId: "123",
            errorCode: QuotingErrorCodeNames.INVALID_BULK_QUOTE_LENGTH
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent({
            quoteId: "123",
            errorCode: QuotingErrorCodeNames.RULE_SCHEME_VIOLATED_RESPONSE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent({
            quoteId: "123",
            errorCode: QuotingErrorCodeNames.RULE_SCHEME_VIOLATED_REQUEST
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCQuoteNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteNotFoundErrorEvent({
            quoteId: "123",
            errorCode: QuotingErrorCodeNames.QUOTE_NOT_FOUND
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.QUOTE_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.QUOTE_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCBulkQuoteNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCBulkQuoteNotFoundErrorEvent({
            bulkQuoteId: "123",
            errorCode: QuotingErrorCodeNames.BULK_QUOTE_NOT_FOUND
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCInvalidDestinationFspIdErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidDestinationFspIdErrorEvent({
            quoteId: "123",
            bulkQuoteId: null,
            destinationFspId: "greenbank",
            errorCode: QuotingErrorCodeNames.INVALID_DESTINATION_PARTICIPANT
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
                        "errorDescription": Enums.ClientErrors.DESTINATION_FSP_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCDuplicateQuoteErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCDuplicateQuoteErrorEvent({
            quoteId: "123",
            errorCode: QuotingErrorCodeNames.DUPLICATE_QUOTE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCUnableToAddQuoteToDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToAddQuoteToDatabaseErrorEvent({
            quoteId: "123",
            errorCode: QuotingErrorCodeNames.UNABLE_TO_ADD_QUOTE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent({
            bulkQuoteId: "456",
            errorCode: QuotingErrorCodeNames.UNABLE_TO_ADD_BULK_QUOTE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent({
            quoteId: "123",
            errorCode: QuotingErrorCodeNames.UNABLE_TO_UPDATE_QUOTE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent({
            bulkQuoteId: "456",
            errorCode: QuotingErrorCodeNames.UNABLE_TO_UPDATE_BULK_QUOTE
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });


    it("should return QuoteBCInvalidRequesterFspIdErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidRequesterFspIdErrorEvent({
            quoteId: "123",
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorCode: QuotingErrorCodeNames.INVALID_SOURCE_PARTICIPANT
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCRequesterParticipantNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCRequesterParticipantNotFoundErrorEvent({
            quoteId: "123",
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorCode: QuotingErrorCodeNames.SOURCE_PARTICIPANT_NOT_FOUND
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCDestinationParticipantNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCDestinationParticipantNotFoundErrorEvent({
            quoteId: "123",
            bulkQuoteId: null,
            destinationFspId: "greenbank",
            errorCode: QuotingErrorCodeNames.DESTINATION_PARTICIPANT_NOT_FOUND
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCQuoteExpiredErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteExpiredErrorEvent({
            quoteId: "123",
            expirationDate: "2022-01-22T08:38:08.699-04:00",
            errorCode: QuotingErrorCodeNames.QUOTE_EXPIRED
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.QUOTE_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.QUOTE_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return QuoteBCBulkQuoteExpiredErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCBulkQuoteExpiredErrorEvent({
            bulkQuoteId: "123",
            expirationDate: "2022-01-22T08:38:08.699-04:00",
            errorCode: QuotingErrorCodeNames.BULK_QUOTE_EXPIRED
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": {
                        "errorCode": Enums.ClientErrors.QUOTE_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.QUOTE_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
    // #region
});

