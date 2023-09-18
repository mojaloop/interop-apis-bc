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
    AccountLookupBCTopics,
    ParticipantAssociationRequestReceivedEvt,
    ParticipantQueryReceivedEvt,
    ParticipantQueryResponseEvt,
    PartyQueryReceivedEvt,
    PartyInfoRequestedEvt,
    PartyInfoAvailableEvt,
    PartyQueryResponseEvt,
    AccountLookUpUnableToGetParticipantFromOracleErrorEvent,
    AccountLookupBCRequesterParticipantNotFoundErrorEvent,
    AccountLookupBCUnableToGetOracleAdapterErrorEvent,
    ParticipantAssociationCreatedEvt,
    AccountLookupBCUnableToAssociateParticipantErrorEvent,
    ParticipantDisassociateRequestReceivedEvt,
    ParticipantAssociationRemovedEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src/service";
import request from "supertest";
import { getHeaders } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import KafkaConsumer from "../helpers/kafkaproducer";
import { MongoClient } from "mongodb";
import { PostParticipant, removeEmpty } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";

const server = process.env["SVC_DEFAULT_URL"] || "http://localhost:4000/";


// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/api-specs/api_spec.yaml"));

jest.setTimeout(40000);

// Participants
let validParticipantPostPayload:PostParticipant;

const consumer = new KafkaConsumer([AccountLookupBCTopics.DomainRequests, AccountLookupBCTopics.DomainEvents])
const DB_NAME = process.env.QUOTING_DB_TEST_NAME ?? "quoting";
const CONNECTION_STRING = process.env["MONGO_URL"] || "mongodb://root:mongoDbPas42@localhost:27017";
const COLLECTION_PARTICIPANT = "participants";
const COLLECTION_PARTY = "bulk_quotes";

// Mongo instances
let mongoClient: MongoClient;

describe("FSPIOP API Service Account Lookup Handler", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init();
    });

    beforeEach(async () => {
        await consumer.clearEvents();

        validParticipantPostPayload = {
            "fspId": "bluebank"
        }
    });

    afterAll(async () => {
        await Service.stop();
        await consumer.destroy();

        // Start mongo client and service before conducting all tests
        mongoClient = new MongoClient(CONNECTION_STRING);
        await mongoClient.connect();

        mongoClient.connect();
        const participantRepo = mongoClient
            .db(DB_NAME)
            .collection(COLLECTION_PARTICIPANT);

        participantRepo.deleteMany({})

        const partyRepo = mongoClient
        .db(DB_NAME)
        .collection(COLLECTION_PARTY);

        partyRepo.deleteMany({})
    });

    
    // #region POST Participant By Type and Id
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 

         validParticipantPostPayload.fspId = "nonexistingfsp";

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "123")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to non existing oracle", async () => {
        // Arrange 

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToGetOracleAdapterErrorEvent.name);
        });
    });

    it("should successfully associate a participant", async () => {
        // Arrange 

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationCreatedEvt.name);
        });
    });

    it("should return error from trying to create an already existing association", async () => {
        // Arrange & Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToAssociateParticipantErrorEvent.name);
        });
    });
    // #region

    // #region POST Participant By Type and Id and SubId
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 
        validParticipantPostPayload.fspId = "nonexistingfsp";

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "123" + "/" + "456")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to non existing oracle", async () => {
        // Arrange 

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid" + "nonexistingpartysubid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToGetOracleAdapterErrorEvent.name);
        });
    });

    it("should successfully associate a participant", async () => {
        // Arrange & Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068" + "/" + "111222333")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationCreatedEvt.name);
        });
    });

    it("should return error from trying to create an already existing association", async () => {
        // Arrange & Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068" + "111222333")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToAssociateParticipantErrorEvent.name);
        });
    });
    // #region

    // #region GET Participant
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 
        const headerOverride = { 
            "fspiop-source": "nonexistingfsp"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to non existing oracle", async () => {
        // Arrange & Act
        await request(server)
        .get(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookUpUnableToGetParticipantFromOracleErrorEvent.name);
        });
    });

    it("should successfully return the participant", async () => {
        // Arrange & Act
        await request(server)
        .get(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantQueryResponseEvt.name);
        });
    });
    // #region

    // #region GET Party
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 
        const headerOverride = { 
            "fspiop-source": "nonexistingfsp"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.PARTIES + "/" + "MSISDN" + "/" + "37713803068")
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(PartyQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should successfully return the party", async () => {
        // Arrange & Act
        await request(server)
        .get(Enums.EntityTypeEnum.PARTIES + "/" + "MSISDN" + "/" + "37713803068")
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(4);
            expect(messages[0].msgName).toBe(PartyQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(PartyInfoRequestedEvt.name);
            expect(messages[2].msgName).toBe(PartyInfoAvailableEvt.name);
            expect(messages[3].msgName).toBe(PartyQueryResponseEvt.name);
        });
    });
    // #region

    // #region DEL Participant By Type and Id
    // it("should return error event due to non existing payer fsp", async () => {
    //     // Arrange 
    //     const headerOverride = { 
    //         "fspiop-source": "nonexistingfsp"
    //     };

    //     // Act
    //     await request(server)
    //     .del(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "123")
    //     .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, [], headerOverride));

    //     const messages = consumer.getEvents();

    //     // Assert
    //     await waitForExpect(() => {
    //         expect(messages.length).toBe(4);
    //         expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
    //         expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
    //         expect(messages[2].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
    //         expect(messages[3].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
    //     });
    // });

    it("should return error event due to non existing oracle", async () => {
        // Arrange & Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToGetOracleAdapterErrorEvent.name);
        });
    });

    it("should successfully disassociate a participant", async () => {
        // Arrange 

        // Act
        await request(server)
        .del(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationRemovedEvt.name);
        });
    });
    // #region

    // #region DEL Participant by Type and Id and SubId
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 
        const headerOverride = { 
            "fspiop-source": "nonexistingfsp"
        };

        // Act
        await request(server)
        .del(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "123" + "/" + "456")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to non existing oracle", async () => {
        // Arrange & Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid" + "nonexistingpartysubid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToGetOracleAdapterErrorEvent.name);
        });
    });

    it("should successfully disassociate a participant", async () => {
        // Arrange 

        // Act
        await request(server)
        .del(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068" + "/" + "111222333")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationRemovedEvt.name);
        });
    });
    // #region
});
