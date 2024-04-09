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
import { Constants, Enums, PostParticipant, Request } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {
    AccountLookupBCTopics,
    ParticipantAssociationRequestReceivedEvt,
    ParticipantQueryReceivedEvt,
    ParticipantQueryResponseEvt,
    PartyQueryReceivedEvt,
    PartyInfoRequestedEvt,
    PartyInfoAvailableEvt,
    PartyQueryResponseEvt,
    ParticipantAssociationCreatedEvt,
    ParticipantDisassociateRequestReceivedEvt,
    ParticipantAssociationRemovedEvt,
    GetPartyQueryRejectedResponseEvt,
    AccountLookUpUnknownErrorEvent,
    AccountLookupBCInvalidMessagePayloadErrorEvent,
    AccountLookupBCInvalidMessageTypeErrorEvent,
    AccountLookupBCUnableToAssociateParticipantErrorEvent,
    AccountLookupBCUnableToDisassociateParticipantErrorEvent,
    AccountLookupBCUnableToGetOracleAdapterErrorEvent,
    AccountLookUpUnableToGetParticipantFromOracleErrorEvent,
    AccountLookupBCDestinationParticipantNotFoundErrorEvent,
    AccountLookupBCInvalidDestinationParticipantErrorEvent,
    AccountLookupBCRequesterParticipantNotFoundErrorEvent,
    AccountLookupBCInvalidRequesterParticipantErrorEvent
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "../../../../packages/fspiop-api-svc/src/service";
import request from "supertest";
import { createMessage, getHeaders, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import KafkaConsumer from "../helpers/kafkaproducer";
import { MongoClient } from "mongodb";
import { removeEmpty } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/transformer";
import { FSPIOP_PARTY_ACCOUNT_TYPES } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { ClientErrors } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/enums";
import waitForExpect from "../helpers/utils";
import { AccountLookupErrorCodeNames } from "@mojaloop/account-lookup-bc-public-types-lib";

const server = process.env["SVC_DEFAULT_URL"] || "http://localhost:4000/";


// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/api-specs/api_spec.yaml"));

jest.setTimeout(60000);

const partiesEntity = "parties";
const participantsEntity = "participants";

// Participants
let validParticipantPostPayload:PostParticipant;

const consumer = new KafkaConsumer([AccountLookupBCTopics.DomainRequests, AccountLookupBCTopics.DomainEvents])
const DB_NAME = process.env.QUOTING_DB_TEST_NAME ?? "account-lookup";
const CONNECTION_STRING = process.env["MONGO_URL"] || "mongodb://root:mongoDbPas42@localhost:27017";
const COLLECTION_PARTICIPANT = "participants";
const COLLECTION_PARTY = "parties";

// Mongo instances
let mongoClient: MongoClient;

let sendRequestSpy = jest.spyOn(Request, "sendRequest");

const res = async () => {
    return await sendRequestSpy.mock.results[sendRequestSpy.mock.results.length-1].value;
};

const jwsHelper = getJwsConfig();

describe("FSPIOP API Service Account Lookup Handler", () => {

    beforeAll(async () => {
        await Service.start();
        await consumer.init();
    });

    beforeEach(async () => {
        await new Promise((r) => setTimeout(r, 3000));

        await consumer.clearEvents();

        sendRequestSpy.mockClear();

        validParticipantPostPayload = {
            "fspId": "bluebank"
        }
    });

    afterAll(async () => {
        await Service.stop();
        await consumer.destroy();

        // Start mongo client and service before conducting all tests
        // mongoClient = new MongoClient(CONNECTION_STRING);
        // await mongoClient.connect();

        // mongoClient.connect();
        // const participantRepo = mongoClient
        //     .db(DB_NAME)
        //     .collection(COLLECTION_PARTICIPANT);

        // participantRepo.deleteMany({})

        // const partyRepo = mongoClient
        // .db(DB_NAME)
        // .collection(COLLECTION_PARTY);

        // partyRepo.deleteMany({})
    });

    
    // #region POST Participant By Type and Id
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 
        validParticipantPostPayload.fspId = "nonexistingfsp";
        
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);

        // Act
        const test = await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "123")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

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
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
        
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

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
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
        
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationCreatedEvt.name);
        });
    });

it("should return error from trying to create an already existing association", async () => {
        // Arrange 
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
        
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

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

        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "123" + "/" + "456")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

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
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
                
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid" + "nonexistingpartysubid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

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
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
        
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068" + "/" + "111222333")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationCreatedEvt.name);
        });
    });

    it("should return error from trying to create an already existing association", async () => {
        // Arrange 
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
        
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068" + "111222333")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToAssociateParticipantErrorEvent.name);
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new ParticipantAssociationCreatedEvt({
            ownerFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
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
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.GET));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantQueryReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantQueryResponseEvt.name);
        });
    });

    it("should fail due to request failing on responsdsae", async () => {
        // Arrange
        const msg = new ParticipantQueryResponseEvt({
            requesterFspId: "nonexistingfsp",
            ownerFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: null
        })
        

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
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

    // #region GET Party
    it("should return error event due to non existing payer fsp", async () => {
        // Arrange 
        const headerOverride = { 
            "fspiop-source": "nonexistingfsp"
        };

        // Act
        await request(server)
        .get(Enums.EntityTypeEnum.PARTIES + "/" + "MSISDN" + "/" + "37713803068")
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET, null, [], headerOverride));

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
        .set(getHeaders(Enums.EntityTypeEnum.PARTIES, Enums.FspiopRequestMethodsEnum.GET));

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

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new PartyInfoRequestedEvt({
            requesterFspId: "nonexistingfsp",
            destinationFspId: null,
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: null
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });

    it("_handlePartyQueryResponseEvt - should fail due to request failing on response", async () => {
        // Arrange
        const msg = new PartyQueryResponseEvt({
            requesterFspId: "nonexistingfsp",
            ownerFspId: "nonexistingfsp",
            destinationFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: null,
            merchantClassificationCode: "1",
            name: "John",
            middleName: "P",
            firstName: "Paul",
            lastName: "Lopez",
            partyDoB: null,
            extensionList: null,
            kycInfo: null,
            supportedCurrencies: null
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
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
        // Arrange 
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);

        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

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
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, validParticipantPostPayload);
        
        // Act
        await request(server)
        .del(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068")
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationRemovedEvt.name);
        });
    });

    it("should fail due to request failing", async () => {
        // Arrange
        const msg = new ParticipantAssociationRemovedEvt({
            ownerFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
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
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE, null, [], headerOverride));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCRequesterParticipantNotFoundErrorEvent.name);
        });
    });

    it("should return error event due to non existing oracle", async () => {
        // Arrange 
        const headers = getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.POST);
        headers[Constants.FSPIOP_HEADERS_SIGNATURE] = jwsHelper.sign(headers, removeEmpty(validParticipantPostPayload));
        
        // Act
        await request(server)
        .post(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "nonexistingpartytype" + "/" + "nonexistingpartyid" + "nonexistingpartysubid")
        .send(removeEmpty(validParticipantPostPayload))
        .set(headers);

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantAssociationRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(AccountLookupBCUnableToGetOracleAdapterErrorEvent.name);
        });
    });

    it("should successfully disassociate a participant", async () => {
        // Act
        await request(server)
        .del(Enums.EntityTypeEnum.PARTICIPANTS + "/" + "MSISDN" + "/" + "37713803068" + "/" + "111222333")
        .set(getHeaders(Enums.EntityTypeEnum.PARTICIPANTS, Enums.FspiopRequestMethodsEnum.DELETE));

        const messages = consumer.getEvents();

        // Assert
        await waitForExpect(() => {
            expect(messages.length).toBe(2);
            expect(messages[0].msgName).toBe(ParticipantDisassociateRequestReceivedEvt.name);
            expect(messages[1].msgName).toBe(ParticipantAssociationRemovedEvt.name);
        });
    });
    // #region

    // #region Error events
    it("should return AccountLookUpUnknownErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new AccountLookUpUnknownErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            requesterFspId: "bluebank",
            currency: "USD",
            errorCode: AccountLookupErrorCodeNames.COMMAND_TYPE_UNKNOWN
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS);

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
                "url": expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookUpUnknownErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookUpUnknownErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            requesterFspId: "bluebank",
            currency: "USD",
            errorCode: AccountLookupErrorCodeNames.COMMAND_TYPE_UNKNOWN
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCInvalidMessagePayloadErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidMessagePayloadErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "bluebank",
            errorCode: AccountLookupErrorCodeNames.INVALID_MESSAGE_PAYLOAD
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCInvalidMessageTypeErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidMessageTypeErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "bluebank",
            errorCode: AccountLookupErrorCodeNames.INVALID_MESSAGE_TYPE
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCUnableToGetOracleAdapterErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCUnableToGetOracleAdapterErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            currency: "USD",
            errorCode: AccountLookupErrorCodeNames.UNABLE_TO_GET_ORACLE_ADAPTER
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return GetPartyQueryRejectedResponseEvt http call for party type", async () => {
        // Arrange
        const msg = new GetPartyQueryRejectedResponseEvt({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: "USD",
            errorInformation: { 
                "errorCode": ClientErrors.PARTY_NOT_FOUND.code,
                "errorDescription": ClientErrors.PARTY_NOT_FOUND.name
            }
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": ClientErrors.PARTY_NOT_FOUND.code,
                        "errorDescription": ClientErrors.PARTY_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookUpUnableToGetParticipantFromOracleErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookUpUnableToGetParticipantFromOracleErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: "USD",
            errorCode: AccountLookupErrorCodeNames.UNABLE_TO_GET_PARTICIPANT_FROM_ORACLE
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": ClientErrors.PARTY_NOT_FOUND.code,
                        "errorDescription": ClientErrors.PARTY_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCUnableToAssociateParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCUnableToAssociateParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            currency: "USD",
            fspIdToAssociate: "randomFspId",
            errorCode: AccountLookupErrorCodeNames.UNABLE_TO_ASSOCIATE_PARTICIPANT
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCUnableToDisassociateParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCUnableToDisassociateParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            currency: "USD",
            fspIdToDisassociate: "randomFspId",
            errorCode: AccountLookupErrorCodeNames.UNABLE_TO_DISASSOCIATE_PARTICIPANT
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCDestinationParticipantNotFoundErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCDestinationParticipantNotFoundErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            destinationFspId: "randomFspId",
            errorCode: AccountLookupErrorCodeNames.DESTINATION_PARTICIPANT_NOT_FOUND
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCRequesterParticipantNotFoundErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCRequesterParticipantNotFoundErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "randomFspId",
            errorCode: AccountLookupErrorCodeNames.SOURCE_PARTICIPANT_NOT_FOUND
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCInvalidDestinationParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidDestinationParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            destinationFspId: "randomFspId",
            errorCode: AccountLookupErrorCodeNames.INVALID_DESTINATION_PARTICIPANT
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should return AccountLookupBCInvalidRequesterParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidRequesterParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "randomFspId",
            errorCode: AccountLookupErrorCodeNames.INVALID_SOURCE_PARTICIPANT
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

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
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
            expect(await res()).toSatisfyApiSpec();
        });
    });

    it("should use default case when AccountLookUpUnknownErrorEvent has no correct name", async () => {
        // Arrange
        const msg = new AccountLookUpUnknownErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            requesterFspId: "bluebank",
            currency: "USD",
            errorCode: AccountLookupErrorCodeNames.COMMAND_TYPE_UNKNOWN
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS);

        msg.msgName = "non-existing-message-name";

        // Act
        await consumer.sendMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #region
});
