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
import { 
    QuotingBCTopics,
    TransferQueryReceivedEvt,
    TransferPrepareRequestedEvt,
    TransferFulfilRequestedEvt,
    TransferRejectRequestedEvt,
    TransfersBCTopics 
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src";
import KafkaConsumer from "../helpers/kafkaproducer";
import { getHeaders, missingPropertyResponse } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import waitForExpect from "wait-for-expect";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/dist/api_spec.yaml"));

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 4000;

const server = `http://localhost:${SVC_DEFAULT_HTTP_PORT}`;

const validPostPayload = {
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

const validPutPayload =  {
    "transferState": "COMMITTED",
    "completedTimestamp": "2099-09-18T10:57:25.163Z",
    "fulfilment": "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0"
};

const validErrorPayload = {
    "errorInformation": {
      "errorCode": "3208",
      "errorDescription": "Transfer ID not found"
    }
}

jest.setTimeout(60000);

const topic = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainRequests;

const pathWithoutTransferId = `/${Enums.EntityTypeEnum.TRANSFERS}`;
const pathWithTransferId = `/${Enums.EntityTypeEnum.TRANSFERS}/123456789`;

const consumer = new KafkaConsumer([TransfersBCTopics.DomainRequests])

describe("FSPIOP API Service Transfer Routes", () => {

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

    it("should successfully call transferQueryReceived endpoint", async () => {
        // Act
        const res = await request(server)
        .get(pathWithTransferId)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(TransferQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe("QueryTransferCmd");
            expect(res).toSatisfyApiSpec();
        });
    });

    it("should successfully call transferPrepareRequested endpoint", async () => {
        // Act
        const res = await request(server)
        .post(pathWithoutTransferId)
        .send(validPostPayload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(TransferPrepareRequestedEvt.name);
            expect(messages[1].msgName).toBe("PrepareTransferCmd");
            expect(res).toSatisfyApiSpec();
        });
    });

    it("should successfully call transferFulfilCommittedRequested endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithoutTransferId + "/" + validPostPayload.transferId)
        .send(validPutPayload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(200);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(TransferFulfilRequestedEvt.name);
            expect(messages[1].msgName).toBe("CommitTransferFulfilCmd");
            expect(res).toSatisfyApiSpec();
        });
    });

    it("should successfully call transferFulfilCommittedRequested endpoint", async () => {
        // Act
        const res = await request(server)
        .put(pathWithoutTransferId + "/" + validPostPayload.transferId + "/" + "error")
        .send(validErrorPayload)
        .set(getHeaders(Enums.EntityTypeEnum.TRANSFERS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(res.statusCode).toEqual(202);
            expect(res.body).toStrictEqual(null);
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(TransferRejectRequestedEvt.name);
            expect(messages[1].msgName).toBe("RejectTransferCmd");
            expect(res).toSatisfyApiSpec();
        });
    });
});
