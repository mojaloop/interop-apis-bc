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
import waitForExpect from "wait-for-expect";
import { Enums } from "../../../../packages/fspiop-utils-lib/dist";
import {
    QuoteRequestAcceptedEvt,
    QuoteRequestReceivedEvt,
    QuoteResponseReceivedEvt,
    QuoteResponseAccepted,
    QuotingBCTopics,
    TransfersBCTopics,
    TransferPrepareRequestedEvt,
    TransferPreparedEvt,
    TransferFulfilCommittedRequestedEvt,
    TransferCommittedFulfiledEvt,
    TransferQueryReceivedEvt,
    TransferQueryResponseEvt,
    TransferPayerNotFoundFailedEvt,
    TransferPayeeNotFoundFailedEvt,
    TransferNotFoundEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src/service";
import request from "supertest";
import { getHeaders } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import KafkaConsumer from "../helpers/kafkaproducer";
import { MongoClient } from "mongodb";
import { PostQuote, removeEmpty } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";

const server = process.env["SVC_DEFAULT_URL"] || "http://localhost:4000/";


// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/api-specs/api_spec.yaml"));

jest.setTimeout(40000);

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

const consumer = new KafkaConsumer([QuotingBCTopics.DomainRequests, QuotingBCTopics.DomainEvents, TransfersBCTopics.DomainRequests, TransfersBCTopics.DomainEvents])
const DB_NAME_QUOTES = process.env.QUOTING_DB_TEST_NAME ?? "quoting";
const DB_NAME_TRANSFERS = process.env.QUOTING_DB_TEST_NAME ?? "quoting";
const CONNECTION_STRING = process.env["MONGO_URL"] || "mongodb://root:mongoDbPas42@localhost:27017";
const COLLECTION_QUOTE = "quotes";
const COLLECTION_TRANSFER = "transfers";

// Mongo instances
let mongoClient: MongoClient;

describe("FSPIOP API Service Transfers Handler", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init();
    });

    beforeEach(async () => {
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
    });

    
    // #region POST Transfer
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange
        validTransferPostPayload.payerFsp = "nonexistingpayerfsp";

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.TRANSFERS)
        .send(removeEmpty(validTransferPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

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

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.TRANSFERS)
        .send(removeEmpty(validTransferPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

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
        // Act & Arrange
        await request(server)
        .post(Enums.EntityTypeEnum.QUOTES)
        .send(removeEmpty(validQuotePostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.QUOTES));

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
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(6);
            expect(messages[0].msgName).toBe(TransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareTransferCmd"); // TODO: make a special topic for transfers CMDs
            expect(messages[2].msgName).toBe(TransferPreparedEvt.name);
            expect(messages[3].msgName).toBe(TransferFulfilCommittedRequestedEvt.name);
            expect(messages[4].msgName).toBe("CommitTransferFulfilCmd"); // TODO: make a special topic for transfers CMDs
            expect(messages[5].msgName).toBe(TransferCommittedFulfiledEvt.name);
        });
    });
    // #region

    // #region GET Transfer
    it("should return error event due to non existing payer fsp", async () => {
        const headerOverride = { 
            "fspiop-source": "nonexistingfsp",
            "fspiop-destination": "bluebank" 
        };
        await request(server)
        .get(Enums.EntityTypeEnum.TRANSFERS + "/" + validTransferPostPayload.transferId)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS, [], headerOverride));

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
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

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
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(3);
            expect(messages[0].msgName).toBe(TransferQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe("QueryTransferCmd"); 
            expect(messages[2].msgName).toBe(TransferQueryResponseEvt.name); 
        });
    });
    // #region
});
