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

import { Request } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { AccountLookupBCTopics, AccountLookUpErrorEvt, AccountLookUpErrorEvtPayload, ParticipantAssociationCreatedEvt, ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvt, ParticipantAssociationRemovedEvtPayload, ParticipantAssociationRequestReceivedEvt, ParticipantQueryResponseEvt, ParticipantQueryResponseEvtPayload, PartyInfoRequestedEvt, PartyInfoRequestedEvtPayload, PartyQueryReceivedEvt, PartyQueryResponseEvt, PartyQueryResponseEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import waitForExpect from "wait-for-expect";
import jestOpenAPI from 'jest-openapi';
import path from "path";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import { IParticipant } from "@mojaloop/participant-bc-public-types-lib";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, '../../../../packages/fspiop-api-svc/api-specs/account-lookup-service/api-swagger.yaml'));
 
import KafkaProducer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";

const kafkaProducer = new KafkaProducer()

const localhostUrl = 'http://127.0.0.1:4040';
const KAFKA_ACCOUNTS_LOOKUP_TOPIC = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainEvents;
const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || 'OperatorBcErrors';

const partyEntity = "parties";
const participantsEntity = "participants";

jest.setTimeout(40000);

describe("FSPIOP API Service AccountLookup Handler", () => {
    let participantClientSpy: jest.SpyInstance;


    beforeAll(async () => {
        await Service.start();
        await kafkaProducer.init();
    });


    beforeEach(async () => {
        participantClientSpy = jest.spyOn(Service.participantService, "getParticipantInfo");

        participantClientSpy.mockResolvedValue({
                id: 1,
                participantEndpoints: [{
                    id: 1,
                    protocol: "HTTPs/REST",
                    type: "FSPIOP",
                    value: "http://127.0.0.1:4040",
                }]
        } as unknown as IParticipant);
    })

    afterAll(async () => {
        await Service.stop();
        await kafkaProducer.destroy();
    });

    //#region AccountLookUpErrorEvt
    it("should successful treat AccountLookUpErrorEvt for Party type event", async () => {
        // Arrange
        const payload : AccountLookUpErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorMsg: "test error message",
            sourceEvent: PartyQueryReceivedEvt.name,
        };

        const event = new AccountLookUpErrorEvt(payload);

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
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });


        expect(await res()).toSatisfyApiSpec();
    })

    it("should successful treat AccountLookUpErrorEvt for IParticipant type event", async () => {
        // Arrange
        const payload : AccountLookUpErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorMsg: "test error message",
            sourceEvent: ParticipantAssociationRequestReceivedEvt.name,
        };

        const event = new AccountLookUpErrorEvt(payload);

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
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${participantsEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });


        expect(await res()).toSatisfyApiSpec();
    })


    it("should log error when AccountLookUpErrorEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : AccountLookUpErrorEvtPayload = {
            requesterFspId: "non-existing-requester-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorMsg: "test error message",
            sourceEvent: "non-existing-source-event",
        };

        const event = new AccountLookUpErrorEvt(payload);

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
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

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
            expect(expectedOffsetMessage.msgName).toBe(AccountLookUpErrorEvt.name);
        });
    })

    it("should log when AccountLookUpErrorEvt throws an error", async () => {
        // Arrange
        const payload : AccountLookUpErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorMsg: "test error message",
            sourceEvent: "non-existing-source-event",
        };

        const event = new AccountLookUpErrorEvt(payload);

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
            

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");
            
        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0)
        });
    })

    it("should use default case when AccountLookUpErrorEvt has no correct name", async () => {
        // Arrange
        const payload : AccountLookUpErrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            errorMsg: "test error message",
            sourceEvent: "non-existing-source-event",
        };

        const event = new AccountLookUpErrorEvt(payload);

        event.msgName = "non-existing-message-name";

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");
            
        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0)
        });
    })
    //#endregion

    //#region ParticipantAssociationCreatedEvt
    it("should log error when ParticipantAssociationCreatedEvt finds no participant endpoint", async () => {
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
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

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
            expect(expectedOffsetMessage.msgName).toBe(ParticipantAssociationCreatedEvt.name);
        });
    })

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
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion

    //#region ParticipantAssociationRemovedEvt
    it("should successful treat ParticipantAssociationRemovedEvt", async () => {
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
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/123456789`
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    })

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
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

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
            expect(expectedOffsetMessage.msgName).toBe(ParticipantAssociationRemovedEvt.name);
        });
    })

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
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion

    //#region PartyInfoRequestedEvt
    it("should successful treat PartyInfoRequestedEvt", async () => {
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
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/123456789`
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    })

    it("should log error when PartyInfoRequestedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload : PartyInfoRequestedEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "non-existing-requester-id",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        const event = new PartyInfoRequestedEvt(payload);

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
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

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
            expect(expectedOffsetMessage.msgName).toBe(PartyInfoRequestedEvt.name);
        });
    })

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

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion

    //#region PartyQueryResponseEvt
    it("should successful treat PartyQueryResponseEvt", async () => {
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
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/123456789`
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    })

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
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 4000));

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
            expect(expectedOffsetMessage.msgName).toBe(PartyQueryResponseEvt.name);
        });
    })

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

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });
        
        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${partyEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion

    //#region ParticipantQueryResponseEvt
    it("should successful treat ParticipantQueryResponseEvt", async () => {
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
                "accept":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${partyEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };
            
        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
                    
        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${participantsEntity}/${payload.partyType}/123456789`
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    })

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
            
        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);
        
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

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
            expect(expectedOffsetMessage.msgName).toBe(ParticipantQueryResponseEvt.name);
        });
    })

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
        kafkaProducer.sendMessage(KAFKA_ACCOUNTS_LOOKUP_TOPIC, event);

        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        }

        // Assert        
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: `${localhostUrl}/${participantsEntity}/${payload.partyType}/${payload.partyId}/error`
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    })
    //#endregion
});