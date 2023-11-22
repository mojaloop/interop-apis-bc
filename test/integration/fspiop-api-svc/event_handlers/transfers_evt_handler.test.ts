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
import jestOpenAPI from "jest-openapi";
import { Constants, Enums, Request } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    QuoteRequestAcceptedEvt,
    QuoteRequestReceivedEvt,
    QuoteResponseReceivedEvt,
    QuoteResponseAccepted,
    QuotingBCTopics,
    TransfersBCTopics,
    TransferPrepareRequestedEvt,
    TransferPreparedEvt,
    TransferFulfilRequestedEvt,
    TransferFulfiledEvt,
    TransferQueryReceivedEvt,
    TransferQueryResponseEvt,
    TransferInvalidMessagePayloadEvt,
    TransferInvalidMessageTypeEvt,
    TransfersBCUnknownErrorEvent,
    TransferUnableToAddEvt,
    TransferUnableToUpdateEvt, 
    TransferUnableToDeleteTransferReminderEvt,
    TransferHubNotFoundFailedEvt,
    TransferHubAccountNotFoundFailedEvt,
    TransferPayerNotFoundFailedEvt,
    TransferPayeePositionAccountNotFoundFailedEvt,
    TransferPayeeLiquidityAccountNotFoundFailedEvt,
    TransferQueryInvalidPayerCheckFailedEvt,
    TransferQueryPayerNotFoundFailedEvt,
    TransferPayerPositionAccountNotFoundFailedEvt,
    TransferPayerLiquidityAccountNotFoundFailedEvt,
    TransferPayeeNotFoundFailedEvt,
    TransferQueryInvalidPayeeCheckFailedEvt,
    TransferQueryPayeeNotFoundFailedEvt,
    TransferNotFoundEvt,
    TransferUnableToGetTransferByIdEvt,
    TransferDuplicateCheckFailedEvt,
    TransferPrepareRequestTimedoutEvt,
    TransferFulfilCommittedRequestedTimedoutEvt,
    TransferFulfilPostCommittedRequestedTimedoutEvt,
    TransferCancelReservationFailedEvt,
    TransferCancelReservationAndCommitFailedEvt,
    TransferPrepareLiquidityCheckFailedEvt,
    TransferRejectRequestProcessedEvt,
    TransferPayerNotActiveEvt,
    TransferPayerNotApprovedEvt,
    TransferPrepareInvalidPayerCheckFailedEvt,
    TransferQueryInvalidPayerParticipantIdEvt,
    TransferPayeeNotActiveEvt,
    TransferPayeeNotApprovedEvt,
    TransferPrepareInvalidPayeeCheckFailedEvt,
    TransferQueryInvalidPayeeParticipantIdEvt,
    BulkTransferPrepareRequestedEvt,
    BulkTransferPreparedEvt,
    BulkTransferFulfilRequestedEvt,
    BulkTransferFulfiledEvt,
    BulkTransferQueryReceivedEvt,
    BulkTransferQueryResponseEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src/service";
import request from "supertest";
import { createMessage, getHeaders, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import KafkaConsumer from "../helpers/kafkaproducer";
import { MongoClient } from "mongodb";
import { PostBulkTransfer, PostQuote, PutBulkTransfer, removeEmpty } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";
import waitForExpect from "../helpers/utils";

const server = process.env["SVC_DEFAULT_URL"] || "http://localhost:4000/";

const jwsHelper = getJwsConfig();

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/api-specs/api_spec.yaml"));

jest.setTimeout(60000);

// Quotes
let validQuotePostPayload:PostQuote = {
    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f4f1f5",
    "transactionId": "0fbaf1a5-d82b-5bbf-9ffe-9d85fed9cfd8",
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
        "currency": "USD",
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
    "expiration": null
};

// Transfers
let validTransferPostPayload:any;

// Bulk Quotes
let validBulkTransferPostPayload:any;
let validBulkPutPayload:PutBulkTransfer;

const consumer = new KafkaConsumer([QuotingBCTopics.DomainRequests, QuotingBCTopics.DomainEvents, TransfersBCTopics.DomainRequests, TransfersBCTopics.DomainEvents])
const DB_NAME_QUOTES = process.env.QUOTING_DB_TEST_NAME ?? "quoting";
const DB_NAME_TRANSFERS = process.env.QUOTING_DB_TEST_NAME ?? "transfers";
const CONNECTION_STRING = process.env["MONGO_URL"] || "mongodb://root:mongoDbPas42@localhost:27017";
const COLLECTION_QUOTE = "quotes";
const COLLECTION_TRANSFER = "transfers";
const COLLECTION_BULK_TRANSFER = "bulk_transfers";

const transfersEntity = "transfers";

// Mongo instances
let mongoClient: MongoClient;

let sendRequestSpy = jest.spyOn(Request, "sendRequest");

const res = async () => {
    return await sendRequestSpy.mock.results[sendRequestSpy.mock.results.length-1].value;
};

describe("FSPIOP API Service Transfers Handler", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init();
    });

    beforeEach(async () => {
        await new Promise((r) => setTimeout(r, 3000));

        await consumer.clearEvents();

        validTransferPostPayload = {
            "transferId": "0fbaf1a5-d82b-5bbf-9ffe-9d85fed9cfd8",
            "payerFsp": "bluebank",
            "payeeFsp": "greenbank",
            "amount": {
                "currency": "USD",
                "amount": "1"
            },
            "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            "expiration": "2023-07-22T05:05:11.304Z"
        };

        validBulkTransferPostPayload = {
            "bulkTransferId": "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            "bulkQuoteId": "0fbee1f3-c58e-5afe-8cdd-6e65eea2fca9",
            "payeeFsp": "greenbank",
            "payerFsp": "bluebank",
            "individualTransfers": [
                {
                    "transferId": "0fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                },
                {
                    "transferId": "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                },
                {
                    "transferId": "2fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                },
                {
                    "transferId": "3fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                    "transferAmount": {
                        "currency": "USD",
                        "amount": "10"
                    },
                    "ilpPacket": "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                    "condition": "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg"
                }
            ],
            "expiration": "2024-02-28T13:27:53.536Z"
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
            .db(DB_NAME_QUOTES)
            .collection(COLLECTION_QUOTE);

        quoteRepo.deleteMany({})

        const transferRepo = mongoClient
        .db(DB_NAME_TRANSFERS)
        .collection(COLLECTION_TRANSFER);

        transferRepo.deleteMany({})

        const bulkTransferRepo = mongoClient
        .db(DB_NAME_TRANSFERS)
        .collection(COLLECTION_BULK_TRANSFER);

        bulkTransferRepo.deleteMany({})
    });

    
    // #region POST Transfer
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange
        validTransferPostPayload.payerFsp = "nonexistingpayerfsp";

        const headers = getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validTransferPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.TRANSFERS)
        .send(removeEmpty(validTransferPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(TransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareTransferCmd");
            expect(messages[2].msgName).toBe(TransferPayerNotFoundFailedEvt.name);
        });
    });

    it("should return error event due to non existing payee fsp", async () => {
        // Arrange
        validTransferPostPayload.payeeFsp = "nonexistingpayeefsp";

        const headers = getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validTransferPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.TRANSFERS)
        .send(removeEmpty(validTransferPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(TransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareTransferCmd");
            expect(messages[2].msgName).toBe(TransferPayeeNotFoundFailedEvt.name);
        });
    });
    
    it("should successfully create a transfer", async () => {
        // Arrange 
        const headersQuotes = getHeaders(Enums.EntityTypeEnum.QUOTES, Enums.FspiopRequestMethodsEnum.POST);
        headersQuotes[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headersQuotes, validQuotePostPayload);

        const headersTransfers = getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.POST);
        headersTransfers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headersTransfers, removeEmpty(validTransferPostPayload));

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(removeEmpty(validQuotePostPayload))
        .set(headersQuotes);

        await new Promise((r) => setTimeout(r, 10000));

        const quoteMessages = consumer.getEvents();

        expect(quoteMessages.length).toBe(4);
        expect(quoteMessages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
        expect(quoteMessages[1].msgName).toBe(QuoteRequestAcceptedEvt.name);
        expect(quoteMessages[2].msgName).toBe(QuoteResponseReceivedEvt.name);
        expect(quoteMessages[3].msgName).toBe(QuoteResponseAccepted.name);

        validTransferPostPayload.ilpPacket = quoteMessages[quoteMessages.length-1].payload.ilpPacket;
        validTransferPostPayload.condition = quoteMessages[quoteMessages.length-1].payload.condition;
        validTransferPostPayload.expiration = quoteMessages[quoteMessages.length-1].payload.expiration;
        
        await consumer.clearEvents();

        await request(server)
        .post(Enums.EntityTypeEnum.TRANSFERS)
        .send(removeEmpty(validTransferPostPayload))
        .set(headersTransfers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(6);
            expect(messages[0].msgName).toBe(TransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareTransferCmd"); // TODO: make a special topic for transfers CMDs
            expect(messages[2].msgName).toBe(TransferPreparedEvt.name);
            expect(messages[3].msgName).toBe(TransferFulfilRequestedEvt.name);
            expect(messages[4].msgName).toBe("CommitTransferFulfilCmd"); // TODO: make a special topic for transfers CMDs
            expect(messages[5].msgName).toBe(TransferFulfiledEvt.name);
        });
    });
   
    it("POST Transfer - should fail due to request failing", async () => {
        // Arrange
        const msg = new TransferPreparedEvt({
            ownerFspId: "nonexistingfsp",
            bulkTransferId: "123",
        } as any)
        

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
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

    // #region PUT Transfer
    it("PUT Transfer - should fail due to request failing", async () => {
        // Arrange
        const msg = new TransferFulfiledEvt({
            ownerFspId: "nonexistingfsp",
            bulkTransferId: "123",
        } as any)
        

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
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

    // #region GET Transfer
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange
        const headerOverride = { 
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "bluebank" 
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.TRANSFERS + "/" + validTransferPostPayload.transferId)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(TransferQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe("QueryTransferCmd"); 
            expect(messages[2].msgName).toBe(TransferPayerNotFoundFailedEvt.name); 
        });
    });

    it("should return error event due to transfer not being found", async () => {
        await request(server)
        .get(Enums.EntityTypeEnum.TRANSFERS + "/" + "nonexistingtransferid")
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.GET));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(TransferQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe("QueryTransferCmd"); 
            expect(messages[2].msgName).toBe(TransferNotFoundEvt.name); 
        });
    });

    it("should successfully return an existing transfer", async () => {
        await request(server)
        .get(Enums.EntityTypeEnum.TRANSFERS + "/" + validTransferPostPayload.transferId)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, Enums.FspiopRequestMethodsEnum.GET));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(TransferQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe("QueryTransferCmd"); 
            expect(messages[2].msgName).toBe(TransferQueryResponseEvt.name); 
        });
    });
    
    it("GET Transfer - should fail due to request failing", async () => {
        // Arrange
        const msg = new TransferQueryResponseEvt({
            ownerFspId: "nonexistingfsp",
            bulkTransferId: "123",
        } as any)
        

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
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

    // #region POST BulkTransfer
    it("POST BulkTransfer - should return error event due to non existing payer fsp", async () => {
        // Arrange
        validBulkTransferPostPayload.bulkTransferId = "2fbee1f5-c58e-5afe-8cdd-7e65eea2fca9";
        validBulkTransferPostPayload.payerFsp = "nonexistingpayerfsp";

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, removeEmpty(validBulkTransferPostPayload));

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_TRANSFERS)
        .send(removeEmpty(validBulkTransferPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(6);
            expect(messages[0].msgName).toBe(BulkTransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareBulkTransferCmd");
            expect(messages[2].msgName).toBe(TransferPayerNotFoundFailedEvt.name);
            expect(messages[3].msgName).toBe(TransferPayerNotFoundFailedEvt.name);
            expect(messages[4].msgName).toBe(TransferPayerNotFoundFailedEvt.name);
            expect(messages[5].msgName).toBe(TransferPayerNotFoundFailedEvt.name);
        });
    });

    it("POST BulkTransfer - should return error event due to non existing payee fsp", async () => {
        // Arrange
        validBulkTransferPostPayload.bulkTransferId = "1fbee1f4-c58e-5afe-8cdd-7e65eea2fca9";
        validBulkTransferPostPayload.payeeFsp = "nonexistingpayeefsp";

        const headers = getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, removeEmpty(validBulkTransferPostPayload));

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_TRANSFERS)
        .send(removeEmpty(validBulkTransferPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(6);
            expect(messages[0].msgName).toBe(BulkTransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareBulkTransferCmd");
            expect(messages[2].msgName).toBe(TransferPayeeNotFoundFailedEvt.name);
            expect(messages[3].msgName).toBe(TransferPayeeNotFoundFailedEvt.name);
            expect(messages[4].msgName).toBe(TransferPayeeNotFoundFailedEvt.name);
            expect(messages[5].msgName).toBe(TransferPayeeNotFoundFailedEvt.name);
        });
    });
    
    it("POST BulkTransfer - should successfully create a bulk transfer", async () => {
        // Act & Arrange
        // await request(server)
        // .post(Enums.EntityTypeEnum.QUOTES)
        // .send(removeEmpty(validQuotePostPayload))
        // .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

        // await new Promise((r) => setTimeout(r, 10000));

        // const quoteMessages = consumer.getEvents();

        // expect(quoteMessages.length).toBe(4);
        // expect(quoteMessages[0].msgName).toBe(QuoteRequestReceivedEvt.name);
        // expect(quoteMessages[1].msgName).toBe(QuoteRequestAcceptedEvt.name);
        // expect(quoteMessages[2].msgName).toBe(QuoteResponseReceivedEvt.name);
        // expect(quoteMessages[3].msgName).toBe(QuoteResponseAccepted.name);

        // validTransferPostPayload.ilpPacket = quoteMessages[quoteMessages.length-1].payload.ilpPacket;
        // validTransferPostPayload.condition = quoteMessages[quoteMessages.length-1].payload.condition;
        // validTransferPostPayload.expiration = quoteMessages[quoteMessages.length-1].payload.expiration;
        
        // await consumer.clearEvents();

        // Arrange
        const headers = getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, removeEmpty(validBulkTransferPostPayload));

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.BULK_TRANSFERS)
        .send(removeEmpty(validBulkTransferPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(6);
            expect(messages[0].msgName).toBe(BulkTransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareBulkTransferCmd"); // TODO: make a special topic for transfers CMDs
            expect(messages[2].msgName).toBe(BulkTransferPreparedEvt.name);
            expect(messages[3].msgName).toBe(BulkTransferFulfilRequestedEvt.name);
            expect(messages[4].msgName).toBe("CommitBulkTransferFulfilCmd"); // TODO: make a special topic for transfers CMDs
            expect(messages[5].msgName).toBe(BulkTransferFulfiledEvt.name);
        });
    });

    it("POST BulkTransfer - should fail due to request failing", async () => {
        // Arrange
        const msg = new BulkTransferPreparedEvt({
            ownerFspId: "nonexistingfsp",
            bulkTransferId: "123",
        } as any)
        

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
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

    // #region PUT BulkTransfer
    it("PUT BulkTransfer - should fail due to request failing", async () => {
        // Arrange
        const msg = new BulkTransferFulfiledEvt({
            ownerFspId: "nonexistingfsp",
            bulkTransferId: "123",
        } as any)
        

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
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

    // #region GET BulkTransfer
    it("GET BulkTransfer - should successfully return the previously created bulk transfer", async () => {
        // Arrange
        const headerOverride = { 
            "fspiop-source": "greenbank",
            "fspiop-destination": "bluebank" 
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.BULK_TRANSFERS + "/" + validBulkTransferPostPayload.bulkTransferId)
        .set(getHeaders(Enums.EntityTypeEnum.BULK_TRANSFERS, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(BulkTransferQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe("QueryBulkTransferCmd");
            expect(messages[2].msgName).toBe(BulkTransferQueryResponseEvt.name);
        });
    });

    it("GET BulkTransfer - should fail due to request failing", async () => {
        // Arrange
        const msg = new BulkTransferQueryResponseEvt({
            ownerFspId: "nonexistingfsp",
            bulkTransferId: "123",
        } as any)
        

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
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
    it("should return TransfersBCUnknownErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new TransfersBCUnknownErrorEvent({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransfersBCUnknownErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
            await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return TransferInvalidMessagePayloadEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferInvalidMessagePayloadEvt({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransferInvalidMessagePayloadEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return TransferInvalidMessageTypeEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferInvalidMessageTypeEvt({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransferInvalidMessageTypeEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
    
    it("should return TransferUnableToAddEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferUnableToAddEvt({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransferUnableToAddEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
    
    it("should return TransferUnableToUpdateEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferUnableToUpdateEvt({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransferUnableToUpdateEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
    
    it("should return TransferUnableToDeleteTransferReminderEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferUnableToDeleteTransferReminderEvt({
            transferId: "123", 
            errorDescription: "TransferUnableToDeleteTransferReminderEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
        
    it("should return TransferHubNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferHubNotFoundFailedEvt({
            transferId: "123", 
            errorDescription: "TransferHubNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
        
    it("should return TransferHubAccountNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferHubAccountNotFoundFailedEvt({
            transferId: "123", 
            errorDescription: "TransferHubAccountNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
            
    it("should return TransferPayerNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayerNotFoundFailedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPayerNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
            
    it("should return TransferPayeePositionAccountNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayeePositionAccountNotFoundFailedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferPayeePositionAccountNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
            
    it("should return TransferPayeeLiquidityAccountNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayeeLiquidityAccountNotFoundFailedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferPayeeLiquidityAccountNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
            
    it("should return TransferQueryInvalidPayerCheckFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferQueryInvalidPayerCheckFailedEvt({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransferQueryInvalidPayerCheckFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
            
    it("should return TransferQueryPayerNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferQueryPayerNotFoundFailedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferQueryPayerNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                
    it("should return TransferPayerPositionAccountNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayerPositionAccountNotFoundFailedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPayerPositionAccountNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                    
    it("should return TransferPayerLiquidityAccountNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayerLiquidityAccountNotFoundFailedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPayerLiquidityAccountNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                    
    it("should return TransferPayeeNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayeeNotFoundFailedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferPayeeNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                    
    it("should return TransferQueryInvalidPayeeCheckFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferQueryInvalidPayeeCheckFailedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferQueryInvalidPayeeCheckFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                    
    it("should return TransferQueryPayeeNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferQueryPayeeNotFoundFailedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferQueryPayeeNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

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
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                        
    it("should return TransferNotFoundEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferNotFoundEvt({
            transferId: "123",
            errorDescription: "TransferNotFoundEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                        
    it("should return TransferUnableToGetTransferByIdEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferUnableToGetTransferByIdEvt({
            transferId: "123",
            errorDescription: "TransferUnableToGetTransferByIdEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                            
    it("should return TransferDuplicateCheckFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferDuplicateCheckFailedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferDuplicateCheckFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.INVALID_SIGNATURE.code,
                        "errorDescription": Enums.ClientErrors.INVALID_SIGNATURE.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                
    it("should return TransferPrepareRequestTimedoutEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPrepareRequestTimedoutEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPrepareRequestTimedoutEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                
    it("should return TransferFulfilCommittedRequestedTimedoutEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferFulfilCommittedRequestedTimedoutEvt({
            transferId: "123",
            payerFspId: "bluebank",
            payeeFspId: "greenbankbank",
            errorDescription: "TransferFulfilCommittedRequestedTimedoutEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                
    it("should return TransferFulfilPostCommittedRequestedTimedoutEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferFulfilPostCommittedRequestedTimedoutEvt({
            transferId: "123",
            payerFspId: "bluebank",
            payeeFspId: "greenbankbank",
            errorDescription: "TransferFulfilPostCommittedRequestedTimedoutEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                    
    it("should return TransferCancelReservationFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferCancelReservationFailedEvt({
            transferId: "123",
            errorDescription: "TransferCancelReservationFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                    
    it("should return TransferCancelReservationAndCommitFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferCancelReservationAndCommitFailedEvt({
            transferId: "123",
            errorDescription: "TransferCancelReservationAndCommitFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                        
    it("should return TransferPrepareLiquidityCheckFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPrepareLiquidityCheckFailedEvt({
            transferId: "123",
            payerFspId: "bluebank", 
            amount: "10", 
            currency: "USD",
            errorDescription: "TransferPrepareLiquidityCheckFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.code,
                        "errorDescription": Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                            
    it("should return TransferRejectRequestProcessedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferRejectRequestProcessedEvt({
            transferId: "123",
            "errorInformation": { 
                "errorCode": "transfer id error code",
                "errorDescription": "error transfer description"
            }
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.PAYEE_FSP_REJECTED_TRANSACTION.code,
                        "errorDescription": Enums.PayeeErrors.PAYEE_FSP_REJECTED_TRANSACTION.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                
    it("should return TransferPayerNotActiveEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayerNotActiveEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPayerNotActiveEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                    
    it("should return TransferPayerNotApprovedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayerNotApprovedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPayerNotApprovedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                    
    it("should return TransferPrepareInvalidPayerCheckFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPrepareInvalidPayerCheckFailedEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferPrepareInvalidPayerCheckFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                    
    it("should return TransferQueryInvalidPayerParticipantIdEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferQueryInvalidPayerParticipantIdEvt({
            transferId: "123",
            payerFspId: "bluebank",
            errorDescription: "TransferQueryInvalidPayerParticipantIdEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                        
    it("should return TransferPayeeNotActiveEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayeeNotActiveEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferPayeeNotActiveEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
                        "errorDescription": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                        
    it("should return TransferPayeeNotApprovedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPayeeNotApprovedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferPayeeNotApprovedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
                        "errorDescription": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                        
    it("should return TransferPrepareInvalidPayeeCheckFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferPrepareInvalidPayeeCheckFailedEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferPrepareInvalidPayeeCheckFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
                        "errorDescription": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
                                                        
    it("should return TransferQueryInvalidPayeeParticipantIdEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferQueryInvalidPayeeParticipantIdEvt({
            transferId: "123",
            payeeFspId: "greenbank",
            errorDescription: "TransferQueryInvalidPayeeParticipantIdEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
                        "errorDescription": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });
    // #region
});
