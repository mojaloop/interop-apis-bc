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
import { AccountLookUpUnableToGetParticipantFromOracleErrorEvent, AccountLookUpUnknownErrorEvent, AccountLookupBCDestinationParticipantNotFoundErrorEvent, AccountLookupBCInvalidDestinationParticipantErrorEvent, AccountLookupBCInvalidMessagePayloadErrorEvent, AccountLookupBCInvalidMessageTypeErrorEvent, AccountLookupBCInvalidRequesterParticipantErrorEvent, AccountLookupBCRequesterParticipantNotFoundErrorEvent, AccountLookupBCTopics, AccountLookupBCUnableToAssociateParticipantErrorEvent, AccountLookupBCUnableToDisassociateParticipantErrorEvent, AccountLookupBCUnableToGetOracleAdapterErrorEvent, BulkQuoteAcceptedEvt, BulkQuoteQueryResponseEvt, BulkQuoteReceivedEvt, BulkQuoteReceivedEvtPayload, GetPartyQueryRejectedResponseEvt, ParticipantAssociationCreatedEvt, ParticipantAssociationRemovedEvt, ParticipantQueryResponseEvt, PartyInfoRequestedEvt, PartyQueryResponseEvt, QuoteBCBulkQuoteExpiredErrorEvent, QuoteBCBulkQuoteNotFoundErrorEvent, QuoteBCDestinationParticipantNotFoundErrorEvent, QuoteBCDuplicateQuoteErrorEvent, QuoteBCInvalidBulkQuoteLengthErrorEvent, QuoteBCInvalidDestinationFspIdErrorEvent, QuoteBCInvalidMessagePayloadErrorEvent, QuoteBCInvalidMessageTypeErrorEvent, QuoteBCInvalidRequesterFspIdErrorEvent, QuoteBCQuoteExpiredErrorEvent, QuoteBCQuoteNotFoundErrorEvent, QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent, QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent, QuoteBCRequesterParticipantNotFoundErrorEvent, QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent, QuoteBCUnableToAddQuoteToDatabaseErrorEvent, QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent, QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent, QuoteBCUnknownErrorEvent, QuoteQueryResponseEvt, QuoteRequestAcceptedEvt, QuoteResponseAccepted, QuotingBCTopics } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { ConsoleLogger, ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import { MemoryParticipantService, createMessage, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Constants, Enums, FspiopJwsSignature, Request, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { QuotingEventHandler } from "../../../src/event_handlers/quoting_evt_handler";
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

const quotingEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
    kafkaBrokerList: KAFKA_URL,
    kafkaGroupId: `${BC_NAME}_${APP_NAME}_QuotingEventHandler`,
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
let quotingEvtHandler:QuotingEventHandler;

jwsHelperMock = getJwsConfig();


const quotesEntity = "quotes";
const bulkQuotesEntity = "bulkQuotes";

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Quoting Event Handler", () => {

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
          errorDescription: "Generic server error to be used in order not to disclose information that may be considered private.",
        }
    }

    
    beforeAll(async () => {
        quotingEvtHandler = new QuotingEventHandler(
            logger,
            quotingEvtHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [QuotingBCTopics.DomainEvents],
            mockedParticipantService,
            jwsHelperMock
        );

        await quotingEvtHandler.init();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    afterAll(async () => {
        jest.clearAllMocks();

        await quotingEvtHandler.destroy();
    });

    //#region QuoteRequestAcceptedEvt
    it("should throw when processing QuoteRequestAcceptedEvt", async () => {
        // Arrange
        const msg = new QuoteRequestAcceptedEvt({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transactionId: "9f5d9784-3a57-5865-9aa0-7dde77915481",
            transactionRequestId: null,
            payer: {
                partyIdInfo: {
                    partyIdType: "1",
                    partyIdentifier: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
                    partySubIdOrType: "2",
                    fspId: "nonexistingfsp"
                },
                merchantClassificationCode: null,
                name: null,
                personalInfo: null,
                supportedCurrencies: null,
            },
            payee: {
                partyIdInfo: {
                    partyIdType: "123",
                    partyIdentifier: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
                    partySubIdOrType: "456",
                    fspId: "test-fspiop-destination"
                },
                merchantClassificationCode: null,
                name: null,
                personalInfo: null,
                supportedCurrencies: null,
            },
            amountType: "SEND",
            amount: {
                currency: "USD",
                amount: "10"
            },
            transactionType: {
                scenario: "DEPOSIT",
                subScenario: null,
                initiator: "PAYER",
                initiatorType: "BUSINESS",
                refundInfo: null,
                balanceOfPayments: null
            },
            converter: null,
            currencyConversion: null,
            fees: null,
            geoCode: null,
            note: null,
            expiration: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`),
                source: msg.payload.payer.partyIdInfo.fspId,
                destination: msg.payload.payee.partyIdInfo.fspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call QuoteRequestAcceptedEvt", async () => {
        // Arrange
        const msg = new QuoteRequestAcceptedEvt({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transactionId: "9f5d9784-3a57-5865-9aa0-7dde77915481",
            transactionRequestId: null,
            payer: {
                partyIdInfo: {
                    partyIdType: "1",
                    partyIdentifier: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
                    partySubIdOrType: "2",
                    fspId: "test-fspiop-source"
                },
                merchantClassificationCode: null,
                name: null,
                personalInfo: null,
                supportedCurrencies: null,
            },
            payee: {
                partyIdInfo: {
                    partyIdType: "123",
                    partyIdentifier: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
                    partySubIdOrType: "456",
                    fspId: "test-fspiop-destination"
                },
                merchantClassificationCode: null,
                name: null,
                personalInfo: null,
                supportedCurrencies: null,
            },
            amountType: "SEND",
            amount: {
                currency: "USD",
                amount: "10"
            },
            transactionType: {
                scenario: "DEPOSIT",
                subScenario: null,
                initiator: "PAYER",
                initiatorType: "BUSINESS",
                refundInfo: null,
                balanceOfPayments: null
            },
            converter: null,
            currencyConversion: null,
            fees: null,
            geoCode: null,
            note: null,
            expiration: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quotesEntity}`),
                source: msg.payload.payer.partyIdInfo.fspId,
                destination: msg.payload.payee.partyIdInfo.fspId,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadQuotingRequestPost(message.payload)
            }));
        });

    });
    // #endregion


    //#region QuoteResponseAccepted
    it("should throw when processing QuoteResponseAccepted", async () => {
        // Arrange
        const msg = new QuoteResponseAccepted({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transferAmount: {
                currency: "USD",
                amount: "10"
            },
            expiration: "2022-01-22T08:38:08.699-04:00",
            ilpPacket: "",
            condition: "",
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call QuoteResponseAccepted", async () => {
        // Arrange
        const msg = new QuoteResponseAccepted({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transferAmount: {
                currency: "USD",
                amount: "10"
            },
            expiration: "2022-01-22T08:38:08.699-04:00",
            ilpPacket: "r18Ukv==",
            condition: "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quotesEntity}/${message.payload.quoteId}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadQuotingResponsePut(message.payload)
            }));
        });

    });
    // #endregion

    //#region QuoteQueryResponseEvt
    it("should throw when processing QuoteQueryResponseEvt", async () => {
        // Arrange
        const msg = new QuoteQueryResponseEvt({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transferAmount: {
                currency: "USD",
                amount: "10"
            },
            expiration: "2022-01-22T08:38:08.699-04:00",
            ilpPacket: "",
            condition: "",
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call QuoteQueryResponseEvt", async () => {
        // Arrange
        const msg = new QuoteQueryResponseEvt({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transferAmount: {
                currency: "USD",
                amount: "10"
            },
            expiration: "2022-01-22T08:38:08.699-04:00",
            ilpPacket: "r18Ukv==",
            condition: "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.PARTICIPANTS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quotesEntity}/${message.payload.quoteId}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadQuotingResponsePut(message.payload)
            }));
        });

    });
    // #endregion

    //#region BulkQuoteReceivedEvt
    it("should throw when processing BulkQuoteReceivedEvt", async () => {
        // Arrange
        const msg = new BulkQuoteReceivedEvt({
            bulkQuoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            payer: {
                partyIdInfo: {
                    partyIdType: "1",
                    partyIdentifier: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
                    partySubIdOrType: "2",
                    fspId: "nonexistingfsp"
                },
                merchantClassificationCode: null,
                name: null,
                personalInfo: null,
                supportedCurrencies: null,
            },
            geoCode: null,
            expiration: null,
            individualQuotes: [],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkQuoteReceivedEvt", async () => {
        // Arrange
        const msg = new BulkQuoteReceivedEvt({
            bulkQuoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            payer: {
                partyIdInfo: {
                    partyIdType: "1",
                    partyIdentifier: FSPIOP_PARTY_ACCOUNT_TYPES.MSISDN,
                    partySubIdOrType: "2",
                    fspId: "test-fspiop-source"
                },
                merchantClassificationCode: null,
                name: null,
                personalInfo: null,
                supportedCurrencies: null,
            },
            geoCode: null,
            expiration: null,
            individualQuotes: [],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuotesEntity}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadBulkQuotingResponsePost(message.payload)
            }));
        });

    });
    // #endregion
    
    //#region BulkQuoteAcceptedEvt
    it("should throw when processing BulkQuoteAcceptedEvt", async () => {
        // Arrange
        const msg = new BulkQuoteAcceptedEvt({
            bulkQuoteId: "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            individualQuoteResults: [{
                quoteId: "c6607203-1a28-2101-820b-22ceb061146d",
                payeeFspFee: {
                    currency: "EUR",
                    amount: "1.23"
                },
                payee: {
                    partyIdInfo: {
                        partyIdType: "MSISDN",
                        partyIdentifier: "123",
                        fspId: "greenbank",
                        partySubIdOrType: null
                    },
                    name: "John",
                    personalInfo: {
                        complexName: {
                            firstName: "John",
                            lastName: "P",
                            middleName: "Martin"
                        },
                        dateOfBirth: "9200-02-29",
                        kycInformation: null,
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: null,
                },
                payeeFspCommission: {
                    currency: "USD",
                    amount: "11"
                },
                transferAmount: {
                    currency: "USD",
                    amount: "22"
                },
                payeeReceiveAmount: {
                    currency: "USD",
                    amount: "33"
                },
                condition: "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                ilpPacket: "r18Ukv==",
                errorInformation: null,
                extensionList: null
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkQuoteAcceptedEvt", async () => {
        // Arrange
        const msg = new BulkQuoteAcceptedEvt({
            bulkQuoteId: "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            individualQuoteResults: [{
                quoteId: "c6607203-1a28-2101-820b-22ceb061146d",
                payeeFspFee: {
                    currency: "EUR",
                    amount: "1.23"
                },
                payee: {
                    partyIdInfo: {
                        partyIdType: "MSISDN",
                        partyIdentifier: "123",
                        fspId: "greenbank",
                        partySubIdOrType: null
                    },
                    name: "John",
                    personalInfo: {
                        complexName: {
                            firstName: "John",
                            lastName: "P",
                            middleName: "Martin"
                        },
                        dateOfBirth: "9200-02-29",
                        kycInformation: null,
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: null,
                },
                payeeFspCommission: {
                    currency: "USD",
                    amount: "11"
                },
                transferAmount: {
                    currency: "USD",
                    amount: "22"
                },
                payeeReceiveAmount: {
                    currency: "USD",
                    amount: "33"
                },
                condition: "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                ilpPacket: "r18Ukv==",
                errorInformation: null,
                extensionList: null
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuotesEntity}/${message.payload.bulkQuoteId}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkQuotingResponsePut(message.payload)
            }));
        });

    });
    // #endregion

    //#region BulkQuoteQueryResponseEvt
    it("should throw when processing BulkQuoteQueryResponseEvt", async () => {
        // Arrange
        const msg = new BulkQuoteQueryResponseEvt({
            bulkQuoteId: "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            individualQuoteResults: [{
                quoteId: "c6607203-1a28-2101-820b-22ceb061146d",
                payeeFspFee: {
                    currency: "EUR",
                    amount: "1.23"
                },
                payee: {
                    partyIdInfo: {
                        partyIdType: "MSISDN",
                        partyIdentifier: "123",
                        fspId: "greenbank",
                        partySubIdOrType: null
                    },
                    name: "John",
                    personalInfo: {
                        complexName: {
                            firstName: "John",
                            lastName: "P",
                            middleName: "Martin"
                        },
                        dateOfBirth: "9200-02-29",
                        kycInformation: null,
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: null,
                },
                payeeFspCommission: {
                    currency: "USD",
                    amount: "11"
                },
                transferAmount: {
                    currency: "USD",
                    amount: "22"
                },
                payeeReceiveAmount: {
                    currency: "USD",
                    amount: "33"
                },
                condition: "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                ilpPacket: "r18Ukv==",
                errorInformation: null,
                extensionList: null
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkQuoteQueryResponseEvt", async () => {
        // Arrange
        const msg = new BulkQuoteQueryResponseEvt({
            bulkQuoteId: "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            individualQuoteResults: [{
                quoteId: "c6607203-1a28-2101-820b-22ceb061146d",
                payeeFspFee: {
                    currency: "EUR",
                    amount: "1.23"
                },
                payee: {
                    partyIdInfo: {
                        partyIdType: "MSISDN",
                        partyIdentifier: "123",
                        fspId: "greenbank",
                        partySubIdOrType: null
                    },
                    name: "John",
                    personalInfo: {
                        complexName: {
                            firstName: "John",
                            lastName: "P",
                            middleName: "Martin"
                        },
                        dateOfBirth: "9200-02-29",
                        kycInformation: null,
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: null,
                },
                payeeFspCommission: {
                    currency: "USD",
                    amount: "11"
                },
                transferAmount: {
                    currency: "USD",
                    amount: "22"
                },
                payeeReceiveAmount: {
                    currency: "USD",
                    amount: "33"
                },
                condition: "B5s00ur7cDXyzbcJhn6v3F0nl2DH3gNR5Dc0U4BRApa",
                ilpPacket: "r18Ukv==",
                errorInformation: null,
                extensionList: null
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuotesEntity}/${message.payload.bulkQuoteId}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkQuotingResponsePut(message.payload)
            }));
        });

    });
    // #endregion

    // #region Error events
    it("should return QuoteBCUnknownErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnknownErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorDescription: "QuoteBCUnknownErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
    
    it("should return QuoteBCInvalidMessagePayloadErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidMessagePayloadErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorDescription: "QuoteBCInvalidMessagePayloadErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
    
    it("should return QuoteBCInvalidMessageTypeErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidMessageTypeErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorDescription: "QuoteBCInvalidMessageTypeErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
    
    it("should return QuoteBCInvalidBulkQuoteLengthErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidBulkQuoteLengthErrorEvent({
            bulkQuoteId: "123", 
            errorDescription: "QuoteBCInvalidBulkQuoteLengthErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
        });
    });
    
    it("should return QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent({
            quoteId: "123", 
            errorDescription: "QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
    
    it("should return QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent({
            quoteId: "123", 
            errorDescription: "QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
        
    it("should return QuoteBCQuoteNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteNotFoundErrorEvent({
            quoteId: "123", 
            errorDescription: "QuoteBCQuoteNotFoundErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.QUOTE_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.QUOTE_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
        
    it("should return QuoteBCBulkQuoteNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCBulkQuoteNotFoundErrorEvent({
            bulkQuoteId: "123", 
            errorDescription: "QuoteBCBulkQuoteNotFoundErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
        });
    });
            
    it("should return QuoteBCInvalidDestinationFspIdErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidDestinationFspIdErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            destinationFspId: "greenbank",
            errorDescription: "QuoteBCInvalidDestinationFspIdErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
                        "errorDescription": Enums.ClientErrors.DESTINATION_FSP_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
  
    it("should return QuoteBCDuplicateQuoteErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCDuplicateQuoteErrorEvent({
            quoteId: "123", 
            errorDescription: "QuoteBCDuplicateQuoteErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
                
    it("should return QuoteBCUnableToAddQuoteToDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToAddQuoteToDatabaseErrorEvent({
            quoteId: "123", 
            errorDescription: "QuoteBCUnableToAddQuoteToDatabaseErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
                
    it("should return QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent({
            bulkQuoteId: "456",
            errorDescription: "QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
        });
    });
                
    it("should return QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent({
            quoteId: "123", 
            errorDescription: "QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
                
    it("should return QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent({
            bulkQuoteId: "456",
            errorDescription: "QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
        });
    });
               
                
    it("should return QuoteBCInvalidRequesterFspIdErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidRequesterFspIdErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorDescription: "QuoteBCInvalidRequesterFspIdErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });

    it("should return QuoteBCRequesterParticipantNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCRequesterParticipantNotFoundErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            requesterFspId: "bluebank",
            errorDescription: "QuoteBCRequesterParticipantNotFoundErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });

    it("should return QuoteBCDestinationParticipantNotFoundErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCDestinationParticipantNotFoundErrorEvent({
            quoteId: "123", 
            bulkQuoteId: null,
            destinationFspId: "greenbank",
            errorDescription: "QuoteBCDestinationParticipantNotFoundErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
    
    it("should return QuoteBCQuoteExpiredErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCQuoteExpiredErrorEvent({
            quoteId: "123",
            expirationDate: "2022-01-22T08:38:08.699-04:00",
            errorDescription: "QuoteBCQuoteExpiredErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.QUOTE_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.QUOTE_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${quotesEntity}/${msg.payload.quoteId}/error`)
            }));
        });
    });
        
    it("should return QuoteBCBulkQuoteExpiredErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCBulkQuoteExpiredErrorEvent({
            bulkQuoteId: "123",
            expirationDate: "2022-01-22T08:38:08.699-04:00",
            errorDescription: "QuoteBCBulkQuoteExpiredErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_QUOTES);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await quotingEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.QUOTE_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.QUOTE_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${bulkQuotesEntity}/${msg.payload.bulkQuoteId}/error`)
            }));
        });
    });
    // #region

});
