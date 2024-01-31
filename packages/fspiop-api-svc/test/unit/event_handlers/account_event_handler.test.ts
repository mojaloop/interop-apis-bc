/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
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
**/

"use strict";


import {MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AccountLookUpUnableToGetParticipantFromOracleErrorEvent, AccountLookUpUnknownErrorEvent, AccountLookupBCDestinationParticipantNotFoundErrorEvent, AccountLookupBCInvalidDestinationParticipantErrorEvent, AccountLookupBCInvalidMessagePayloadErrorEvent, AccountLookupBCInvalidMessageTypeErrorEvent, AccountLookupBCInvalidRequesterParticipantErrorEvent, AccountLookupBCRequesterParticipantNotFoundErrorEvent, AccountLookupBCTopics, AccountLookupBCUnableToAssociateParticipantErrorEvent, AccountLookupBCUnableToDisassociateParticipantErrorEvent, AccountLookupBCUnableToGetOracleAdapterErrorEvent, GetPartyQueryRejectedResponseEvt, ParticipantAssociationCreatedEvt, ParticipantAssociationRemovedEvt, ParticipantQueryResponseEvt, PartyInfoRequestedEvt, PartyQueryResponseEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { ConsoleLogger, ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import { MemoryParticipantService, createMessage, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Constants, Enums, FspiopJwsSignature, Request, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { AccountLookupEventHandler } from "../../../src/event_handlers/account_lookup_evt_handler";
import { IParticipantServiceAdapter } from "../../../src/interfaces/infrastructure";
import { FSPIOP_PARTY_ACCOUNT_TYPES } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { IParticipant, IParticipantEndpoint, ParticipantEndpointProtocols, ParticipantEndpointTypes, ParticipantTypes } from "@mojaloop/participant-bc-public-types-lib";
import waitForExpect from "../../../../../test/integration/fspiop-api-svc/helpers/utils";
import { ClientErrors } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/enums";
const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";


var getParticipantsByIdsSpy = jest.fn();

jest.mock("@mojaloop/interop-apis-bc-fspiop-utils-lib", () => {
    const original = jest.requireActual("@mojaloop/interop-apis-bc-fspiop-utils-lib");
    return {
        ...original,
        Request: {
            ...original.Request,
            sendRequest: () => {
                return getParticipantsByIdsSpy()
            }
        }
    };
});

jest.mock("@mojaloop/platform-shared-lib-nodejs-kafka-client-lib", () => {
    const original = jest.requireActual("@mojaloop/platform-shared-lib-nodejs-kafka-client-lib");
    return {
        ...original,
        MLKafkaJsonConsumer: jest.fn().mockImplementation(() => {
            return {
                setTopics: jest.fn(),
                setCallbackFn : jest.fn(),
                connect: jest.fn(),
                startAndWaitForRebalance: jest.fn(),
                destroy: jest.fn()
            }
        }),
        MLKafkaJsonProducer: jest.fn().mockImplementation(() => {
            return {
                connect: jest.fn(),
                destroy: jest.fn()
            }
        })
    }
});

const accountEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
    kafkaBrokerList: KAFKA_URL,
    kafkaGroupId: `${BC_NAME}_${APP_NAME}_AccountLookupEventHandler`,
};

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    kafkaBrokerList: KAFKA_URL,
    producerClientId: `${BC_NAME}_${APP_NAME}`,
    skipAcknowledgements: false
};

const logger: ILogger = new ConsoleLogger();
logger.setLogLevel(LogLevel.FATAL);

const mockedParticipantService: IParticipantServiceAdapter = new MemoryParticipantService(logger);


let jwsHelperMock: FspiopJwsSignature;
let accountEvtHandler:AccountLookupEventHandler;

jwsHelperMock = getJwsConfig();


const partiesEntity = "parties";
const participantsEntity = "participants";

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Account Lookup Event Handler", () => {

    const mockedParticipantEndpoint: IParticipantEndpoint = {
        id: "",
        type: ParticipantEndpointTypes.FSPIOP,
        protocol: ParticipantEndpointProtocols["HTTPs/REST"],
        value: "http://test.com"
    }
    const mockedParticipant:IParticipant = {
        id: "",
        name: "",
        type: ParticipantTypes.DFSP,
        isActive: false,
        description: "",
        createdBy: "",
        createdDate: 0,
        approved: false,
        approvedBy: null,
        approvedDate: null,
        lastUpdated: 0,
        participantAllowedSourceIps: [],
        participantSourceIpChangeRequests: [],
        participantEndpoints: [mockedParticipantEndpoint],
        participantAccounts: [],
        participantAccountsChangeRequest: [],
        fundsMovements: [],
        changeLog: [],
        netDebitCaps: [],
        netDebitCapChangeRequests: [],
        participantContacts: [],
        participantContactInfoChangeRequests: [],
        participantStatusChangeRequests: []
    }

    const invalidParticipantEndpointError = {
        errorInformation: {
          errorCode: "2000",
          errorDescription: "Generic server error",
        }
    }

    
    beforeAll(async () => {
        accountEvtHandler = new AccountLookupEventHandler(
            logger,
            accountEvtHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [AccountLookupBCTopics.DomainEvents],
            mockedParticipantService,
            jwsHelperMock
        );

        await accountEvtHandler.init();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    afterAll(async () => {
        jest.clearAllMocks();

        await accountEvtHandler.destroy();
    });

    //#region ParticipantAssociationCreatedEvt
    it("should throw when processing ParticipantAssociationCreatedEvt", async () => {
        // Arrange
        const msg = new ParticipantAssociationCreatedEvt({
            ownerFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456"
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`),
                source: msg.payload.ownerFspId,
                destination: msg.payload.ownerFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call ParticipantAssociationCreatedEvt", async () => {
        // Arrange
        const msg = new ParticipantAssociationCreatedEvt({
            ownerFspId: "test-fspiop-source",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456"
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}`),
                source: msg.payload.ownerFspId,
                destination: msg.payload.ownerFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyAssociationPut(message.payload)
            }));
        });

    });
    //#endregion

    //#region ParticipantAssociationRemovedEvt
    it("should throw when processing ParticipantAssociationRemovedEvt", async () => {
        // Arrange
        const msg = new ParticipantAssociationRemovedEvt({
            ownerFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456"
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`),
                source: msg.payload.ownerFspId,
                destination: msg.payload.ownerFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call ParticipantAssociationRemovedEvt", async () => {
        // Arrange
        const msg = new ParticipantAssociationRemovedEvt({
            ownerFspId: "test-fspiop-source",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456"
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}`),
                source: msg.payload.ownerFspId,
                destination: msg.payload.ownerFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyDisassociationPut(message.payload)
            }));
        });

    });
    //#endregion

    //#region PartyInfoRequestedEvt
    it("should throw when processing PartyInfoRequestedEvt", async () => {
        // Arrange
        const msg = new PartyInfoRequestedEvt({
            requesterFspId: "test-fspiop-source",
            destinationFspId: "nonexistingfsp",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: null
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`),
                source: msg.payload.requesterFspId,
                destination: msg.payload.destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });
    
    it("should successfully call PartyInfoRequestedEvt", async () => {
        // Arrange
        const msg = new PartyInfoRequestedEvt({
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: null
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}`),
                source: msg.payload.requesterFspId,
                destination: msg.payload.destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.GET,
                payload: Transformer.transformPayloadPartyInfoRequestedPut(message.payload)
            }));
        });

    });
    //#endregion

    //#region PartyQueryResponseEvt
    it("should throw when processing PartyQueryResponseEvt", async () => {
        // Arrange
        const msg = new PartyQueryResponseEvt({
            requesterFspId: "test-fspiop-source",
            destinationFspId: "nonexistingfsp",
            ownerFspId: "test-fspiop-owner",
            partyId: "123",
            partyType: "MSISDN",
            merchantClassificationCode: "18",
            name: "test-party-name",
            firstName: "test-first-name",
            middleName: "test-middle-name",
            lastName: "test-last-name",
            partyDoB: new Date(),
            partySubType: "456",
            currency: null,
            extensionList: null,
            supportedCurrencies: null,
            kycInfo: null,
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "nonexistingfsp"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`),
                source: msg.payload.requesterFspId,
                destination: msg.payload.destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });
    
    it("should successfully call PartyQueryResponseEvt", async () => {
        // Arrange
        const msg = new PartyQueryResponseEvt({
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            ownerFspId: "test-fspiop-owner",
            partyId: "123",
            partyType: "MSISDN",
            merchantClassificationCode: "18",
            name: "test-party-name",
            firstName: "test-first-name",
            middleName: "test-middle-name",
            lastName: "test-last-name",
            partyDoB: new Date(),
            partySubType: "456",
            currency: null,
            extensionList: null,
            supportedCurrencies: null,
            kycInfo: null,
        })

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}`),
                source: msg.payload.requesterFspId,
                destination: msg.payload.destinationFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadPartyInfoReceivedPut(message.payload)
            }));
        });

    });
    //#endregion

    //#region ParticipantQueryResponseEvt
    it("should throw when processing ParticipantQueryResponseEvt", async () => {
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`),
                source: Constants.FSPIOP_HEADERS_SWITCH,
                destination: msg.payload.requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });
    
    it("should successfully call ParticipantQueryResponseEvt", async () => {
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}`),
                source: Constants.FSPIOP_HEADERS_SWITCH,
                destination: msg.payload.requesterFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadParticipantPut(message.payload)
            }));
        });

    });
    //#endregion

    // #region Error events
    it("should return AccountLookUpUnknownErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new AccountLookUpUnknownErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            requesterFspId: "bluebank",
            currency: "USD",
            errorDescription: "AccountLookUpUnknownErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${participantsEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
        });
    });

    it("should return AccountLookUpUnknownErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookUpUnknownErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            requesterFspId: "bluebank",
            currency: "USD",
            errorDescription: "AccountLookUpUnknownErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
        });
    });

    it("should return AccountLookupBCInvalidMessagePayloadErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidMessagePayloadErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "bluebank",
            errorDescription: "AccountLookupBCInvalidMessagePayloadErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookupBCInvalidMessageTypeErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidMessageTypeErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "bluebank",
            errorDescription: "AccountLookupBCInvalidMessageTypeErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookupBCUnableToGetOracleAdapterErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCUnableToGetOracleAdapterErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            currency: "USD",
            errorDescription: "AccountLookupBCUnableToGetOracleAdapterErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": ClientErrors.PARTY_NOT_FOUND.code,
                        "errorDescription": ClientErrors.PARTY_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookUpUnableToGetParticipantFromOracleErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookUpUnableToGetParticipantFromOracleErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            currency: "USD",
            errorDescription: "AccountLookUpUnableToGetParticipantFromOracleErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": ClientErrors.PARTY_NOT_FOUND.code,
                        "errorDescription": ClientErrors.PARTY_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookupBCUnableToAssociateParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCUnableToAssociateParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            currency: "USD",
            fspIdToAssociate: "randomFspId",
            errorDescription: "AccountLookupBCUnableToAssociateParticipantErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
        });
    });

    it("should return AccountLookupBCUnableToDisassociateParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCUnableToDisassociateParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            currency: "USD",
            fspIdToDisassociate: "randomFspId",
            errorDescription: "AccountLookupBCUnableToDisassociateParticipantErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/error`)
            }));
        });
    });

    it("should return AccountLookupBCDestinationParticipantNotFoundErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCDestinationParticipantNotFoundErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            destinationFspId: "randomFspId",
            errorDescription: "AccountLookupBCDestinationParticipantNotFoundErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookupBCRequesterParticipantNotFoundErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCRequesterParticipantNotFoundErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "randomFspId",
            errorDescription: "AccountLookupBCRequesterParticipantNotFoundErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookupBCInvalidDestinationParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidDestinationParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            destinationFspId: "randomFspId",
            errorDescription: "AccountLookupBCInvalidDestinationParticipantErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should return AccountLookupBCInvalidRequesterParticipantErrorEvent http call for party type", async () => {
        // Arrange
        const msg = new AccountLookupBCInvalidRequesterParticipantErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            partySubType: "456",
            requesterFspId: "randomFspId",
            errorDescription: "AccountLookupBCInvalidRequesterParticipantErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTIES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
                        "errorDescription": Enums.ClientErrors.DESTINATION_FSP_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${partiesEntity}/${msg.payload.partyType}/${msg.payload.partyId}/${msg.payload.partySubType}/error`)
            }));
        });
    });

    it("should use default case when AccountLookUpUnknownErrorEvent has no correct name", async () => {
        // Arrange
        const msg = new AccountLookUpUnknownErrorEvent({
            partyId: "123",
            partyType: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
            requesterFspId: "bluebank",
            currency: "USD",
            errorDescription: "AccountLookUpUnknownErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS);

        msg.msgName = "non-existing-message-name";

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        await accountEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledTimes(0);
        });
    });
    //#endregion

});
