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

import { Request } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { 
    AccountLookupBCTopics,
    AccountLookUpBCOperatorErrorEvent,
    AccountLookUpUnknownErrorEvent,
    AccountLookUpUnknownErrorPayload,
    ParticipantAssociationCreatedEvt,
    ParticipantAssociationCreatedEvtPayload,
    ParticipantAssociationRemovedEvt,
    ParticipantAssociationRemovedEvtPayload,
    ParticipantQueryResponseEvt,
    ParticipantQueryResponseEvtPayload,
    PartyInfoRequestedEvt,
    PartyInfoRequestedEvtPayload,
    PartyQueryResponseEvt,
    PartyQueryResponseEvtPayload 
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import waitForExpect from "wait-for-expect";
import jestOpenAPI from 'jest-openapi';
import path from "path";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, '../../../../packages/fspiop-api-svc/api-specs/account-lookup-service/api-swagger.yaml'));
 
import KafkaProducer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";

const kafkaProducer = new KafkaProducer();

const KAFKA_ACCOUNTS_LOOKUP_TOPIC = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainEvents;
const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || AccountLookupBCTopics.DomainErrors;

const partyEntity = "parties";
const participantsEntity = "participants";

jest.setTimeout(40000);

describe("FSPIOP API Service AccountLookup Handler", () => {


    beforeAll(async () => {
        await Service.start();
        await kafkaProducer.init();
    });

    afterEach(() => {    
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await Service.stop();
        await kafkaProducer.destroy();
    });

    //#region AccountLookUpUnknownErrorEvent
    it("should successful treat AccountLookUpUnknownErrorEvent for Party type event", async () => {
        // Arrange
        const payload : AccountLookUpUnknownErrorPayload = {
            fspId: "Greenbank",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorDescription: "test error message"
        };

        const event = new AccountLookUpUnknownErrorEvent(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[0].value;
        };
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partyEntity}/${payload.partyType}/${payload.partyId}/error`)
            }));
        });


        expect(await res()).toSatisfyApiSpec();
    });

    it("should successful treat AccountLookUpUnknownErrorEvent for IParticipant type event", async () => {
        // Arrange
        const payload : AccountLookUpUnknownErrorPayload = {
            fspId: "Greenbank",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorDescription: "test error message"
        };

        const event = new AccountLookUpUnknownErrorEvent(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[0].value;
        };
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${payload.partyType}/${payload.partyId}/error`)
            }));
        });


        expect(await res()).toSatisfyApiSpec();
    });


    it("should log error when AccountLookUpBCOperatorErrorEvent finds no participant endpoint1", async () => {
        // Arrange
        const payload : AccountLookUpUnknownErrorPayload = {
            fspId: "non-existing-requester-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorDescription: "test error message"
        };

        const event = new AccountLookUpUnknownErrorEvent(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });
    });

    it("should send an error request when AccountLookUpUnknownErrorEvent is handled successfully", async () => {
        // Arrange
        const payload : AccountLookUpUnknownErrorPayload = {
            fspId: "Greenbank",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorDescription: "test error message"
        };

        const event = new AccountLookUpUnknownErrorEvent(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };
            

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");
            
        await new Promise((r) => setTimeout(r, 5000));

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalled();
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partyEntity}/${payload.partyType}/${payload.partyId}/error`)
            }));
        });
    });

    it("should use default case when AccountLookUpUnknownErrorEvent has no correct name", async () => {
        // Arrange
        const payload : AccountLookUpUnknownErrorPayload = {
            fspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorDescription: "test error message"
        };

        const event = new AccountLookUpUnknownErrorEvent(payload);

        event.msgName = "non-existing-message-name";

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");
            
        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    // #endregion

    // #region ParticipantAssociationCreatedEvt
    it("should log error when AccountLookUpBCOperatorErrorEvent finds no participant endpoint", async () => {
        // Arrange
        const payload : ParticipantAssociationCreatedEvtPayload = {
            ownerFspId: "non-existing-owner-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null
        };

        const event = new ParticipantAssociationCreatedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-owner-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });
    });

    it("should throw error ParticipantAssociationCreatedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : ParticipantAssociationCreatedEvtPayload = {
            ownerFspId:"test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null
        };

        const event = new ParticipantAssociationCreatedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });

    });
    //#endregion

    //#region ParticipantAssociationRemovedEvt
    it("should successful treat ParticipantAssociationRemovedEvt", async () => {
        // Arrange
            const payload : ParticipantAssociationRemovedEvtPayload = {
                ownerFspId:"Greenbank",
                partyId: "123456789",
                partyType: "MSISDN",
                partySubType: null
            };

            const event = new ParticipantAssociationRemovedEvt(payload);

            event.fspiopOpaqueState = { 
                "requesterFspId":"Greenbank",
                "destinationFspId": null,
                "headers":{
                    "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                    "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                    "date":"randomdate",
                    "fspiop-source":"Greenbank"
                }
            };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act

        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);


        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length-1].value;
        };
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partyEntity}/${payload.partyType}/123456789`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when ParticipantAssociationRemovedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : ParticipantAssociationRemovedEvtPayload = {
            ownerFspId: "non-existing-requester-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null
        };

        const event = new ParticipantAssociationRemovedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });
    });

    it("should throw error ParticipantAssociationRemovedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : ParticipantAssociationRemovedEvtPayload = {
            ownerFspId:"test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null
        };

        const event = new ParticipantAssociationRemovedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });

    });
    //#endregion

    //#region PartyInfoRequestedEvt
    it("should successful treat PartyInfoRequestedEvt", async () => {
        // Arrange
        const payload : PartyInfoRequestedEvtPayload = {
            requesterFspId: "Greenbank",
            destinationFspId: "Bluebank",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        const event = new PartyInfoRequestedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length-1].value;
        };
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partyEntity}/${payload.partyType}/123456789`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when PartyInfoRequestedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : PartyInfoRequestedEvtPayload = {
            requesterFspId: "non-existing-requester-id",
            destinationFspId: "non-existing-requester-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        const event = new PartyInfoRequestedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": "non-existing-destination-id",
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"non-existing-requester-id"
            }
        };
            
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });
    });

    it("should throw error PartyInfoRequestedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : PartyInfoRequestedEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };


        const event = new PartyInfoRequestedEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 10000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });

    });
    //#endregion

    //#region PartyQueryResponseEvt
    it("should successful treat PartyQueryResponseEvt", async () => {
        // Arrange
        const payload : PartyQueryResponseEvtPayload = {
            requesterFspId: "Greenbank",
            destinationFspId: "Bluebank",
            ownerFspId: "test-fspiop-owner",
            partyId: "123456789",
            partyType: "MSISDN",
            partyName: "test-party-name",
            partyDoB: new Date(),
            partySubType: null,
            currency: null
        };

        const event = new PartyQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[0].value;
        };
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partyEntity}/${payload.partyType}/123456789`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when PartyQueryResponseEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : PartyQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "non-existing-owner-id",
            ownerFspId: "non-existing-owner-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partyName: "test-party-name",
            partyDoB: new Date(),
            partySubType: null,
            currency: null
        };

        const event = new PartyQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": "non-existing-requester-id",
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });
    });

    it("should throw error PartyQueryResponseEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : PartyQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            ownerFspId: "test-fspiop-owner",
            partyId: "123456789",
            partyType: "MSISDN",
            partyName: "test-party-name",
            partyDoB: new Date(),
            partySubType: null,
            currency: null
        };

        const event = new PartyQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 10000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });

    });
    //#endregion

    //#region ParticipantQueryResponseEvt
    it("should successful treat ParticipantQueryResponseEvt", async () => {
        // Arrange
        const payload : ParticipantQueryResponseEvtPayload = {
            requesterFspId: "Greenbank",
            ownerFspId: "test-fspiop-owner",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        const event = new ParticipantQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[0].value;
        };
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${payload.partyType}/123456789`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when ParticipantQueryResponseEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : ParticipantQueryResponseEvtPayload = {
            requesterFspId: "non-existing-requester-id",
            ownerFspId:"test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        const event = new ParticipantQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });
    });

    it("should throw error ParticipantQueryResponseEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload : ParticipantQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            ownerFspId: "test-fspiop-owner",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        const event = new ParticipantQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${participantsEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage: any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }
        
        // Assert        
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpBCOperatorErrorEvent.name);
        });

    });
    //#endregion
});