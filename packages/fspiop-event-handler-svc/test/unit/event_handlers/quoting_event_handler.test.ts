/**
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

 --------------
**/

"use strict";

import {MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
    BulkQuoteAcceptedEvt,
    BulkQuoteQueryResponseEvt,
    BulkQuoteReceivedEvt,
    QuoteBCBulkQuoteExpiredErrorEvent,
    QuoteBCBulkQuoteNotFoundErrorEvent,
    QuoteBCDestinationParticipantNotFoundErrorEvent,
    QuoteBCDuplicateQuoteErrorEvent,
    QuoteBCInvalidBulkQuoteLengthErrorEvent,
    QuoteBCInvalidDestinationFspIdErrorEvent,
    QuoteBCInvalidMessagePayloadErrorEvent,
    QuoteBCInvalidMessageTypeErrorEvent,
    QuoteBCInvalidRequesterFspIdErrorEvent,
    QuoteBCQuoteExpiredErrorEvent,
    QuoteBCQuoteNotFoundErrorEvent,
    QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent,
    QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent,
    QuoteBCRequesterParticipantNotFoundErrorEvent,
    QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent,
    QuoteBCUnableToAddQuoteToDatabaseErrorEvent,
    QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent,
    QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent,
    QuoteBCUnknownErrorEvent,
    QuoteQueryResponseEvt,
    QuoteRequestAcceptedEvt,
    QuoteResponseAcceptedEvt,
    QuotingBCTopics
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { ConsoleLogger, ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import { MemoryMetric, MemoryParticipantService, MemorySpan, createMessage, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Constants, Enums, FspiopJwsSignature, Request, FspiopTransformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { QuotingEventHandler } from "../../../src/event_handlers/quoting_evt_handler";
import { FSPIOP_PARTY_ACCOUNT_TYPES } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { IParticipant, IParticipantEndpoint, ParticipantEndpointProtocols, ParticipantEndpointTypes, ParticipantTypes } from "@mojaloop/participant-bc-public-types-lib";
import waitForExpect from "../../../../../test/integration/fspiop-api-svc/helpers/utils";
import { QuotingErrorCodeNames } from "@mojaloop/quoting-bc-public-types-lib";
import { IMetrics } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { IParticipantServiceAdapter } from "../../../../fspiop-api-svc/src/interfaces/infrastructure";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";

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
                setCallbackFn: jest.fn(),
                setBatchCallbackFn: jest.fn(),
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

jest.mock("@mojaloop/platform-shared-lib-observability-client-lib", () => {
    const originalModule = jest.requireActual("@mojaloop/platform-shared-lib-observability-client-lib");
    const getTracerMock = jest.fn();

    return {
        ...originalModule,
        OpenTelemetryClient: {
            getInstance: jest.fn(() => {
                return {
                    trace: {
                        getTracer: getTracerMock,
                    },
                getTracer: jest.fn(() => ({

                })),
                startSpanWithPropagationInput: jest.fn((tracer, spanName, input) => {
                    return {
                        setAttributes: jest.fn((tracer, spanName, input) => {
                        }),
                        setStatus: jest.fn(() => {
                            return {
                                end: jest.fn()
                            }
                        }),
                        setAttribute: jest.fn(),
                        updateName: jest.fn(),
                        end: jest.fn()
                    }
                }),
                startChildSpan: jest.fn(() => {
                    return {
                        setAttribute: jest.fn(),
                        setAttributes: jest.fn(),
                        end: jest.fn(),
                        setStatus: jest.fn(),
                    }
                }),
                startSpan: jest.fn(() => {
                    return {
                        setAttribute: jest.fn(),
                        end: jest.fn()
                    }
                }),
                propagationInject: jest.fn(),
                propagationInjectFromSpan: jest.fn()
            }}),
        },
        PrometheusMetrics: {
            Setup: jest.fn(() => ({

            })),
        },
    };
});

jest.mock("@opentelemetry/api", () => {
    const originalModule = jest.requireActual("@opentelemetry/api");
    const getTracerMock = jest.fn();
    const getSpanMock = jest.fn(() => {
        const span = new MemorySpan();

        return span;
    })

    return {
        ...originalModule,
        trace: {
            getTracer: getTracerMock,
            getActiveSpan: getSpanMock
        },
        propagation: {
            getBaggage: jest.fn(() => ({
                getEntry: jest.fn()
            })),
        }
    };
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
let metricsMock:IMetrics = new MemoryMetric(logger);
const producerMock: IMessageProducer = new MLKafkaJsonProducer(kafkaJsonProducerOptions);

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
            producerMock,
            [QuotingBCTopics.DomainEvents],
            mockedParticipantService,
            jwsHelperMock,
            metricsMock
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
                supportedCurrencies: ["USD"]
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
                supportedCurrencies: ["USD"]
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
            fees: null,
            geoCode: null,
            note: null,
            expiration: null,
            converter: null,
            currencyConversion: null,
            extensions: [],
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
                supportedCurrencies: ["USD"]
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
                supportedCurrencies: ["USD"]
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
            fees: null,
            geoCode: null,
            note: null,
            expiration: null,
            converter: null,
            currencyConversion: null,
            extensions: [],
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
                payload: FspiopTransformer.transformPayloadQuotingRequestPost(message.payload, message.inboundProtocolOpaqueState.fspiopOpaqueState)
            }));
        });

    });
    // #endregion


    //#region QuoteResponseAcceptedEvt
    it("should throw when processing QuoteResponseAcceptedEvt", async () => {
        // Arrange
        const msg = new QuoteResponseAcceptedEvt({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transferAmount: {
                currency: "USD",
                amount: "10"
            },
            expiration: "2022-01-22T08:38:08.699-04:00",
            note: null,
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));
        });
    });

    it("should successfully call QuoteResponseAcceptedEvt", async () => {
        // Arrange
        const msg = new QuoteResponseAcceptedEvt({
            quoteId: "cf0fd8e6-383e-4499-b913-9032cdcb0bee",
            transferAmount: {
                currency: "USD",
                amount: "10"
            },
            expiration: "2022-01-22T08:38:08.699-04:00",
            note: null,
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: FspiopTransformer.transformPayloadQuotingResponsePut(message.payload, message.inboundProtocolOpaqueState.fspiopOpaqueState)
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
            note: null,
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
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
            note: null,
            payeeReceiveAmount: null,
            payeeFspFee: null,
            payeeFspCommission: null,
            geoCode: null,
            extensions: [],
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
                //source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                //destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: FspiopTransformer.transformPayloadQuotingResponsePut(message.payload, message.inboundProtocolOpaqueState.fspiopOpaqueState)
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
                supportedCurrencies: ["USD"]
            },
            geoCode: null,
            expiration: null,
            individualQuotes: [],
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
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
                supportedCurrencies: ["USD"]
            },
            geoCode: null,
            expiration: null,
            individualQuotes: [],
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: FspiopTransformer.transformPayloadBulkQuotingResponsePost(message.payload, message.inboundProtocolOpaqueState.fspiopOpaqueState)
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
                        kycInformation: null
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: ["USD"]
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
                extensions: [],
                errorInformation: null,
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
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
                        kycInformation: null
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: ["USD"]
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
                extensions: [],
                errorInformation: null,
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: FspiopTransformer.transformPayloadBulkQuotingResponsePut(message.payload, message.inboundProtocolOpaqueState.fspiopOpaqueState)
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
                        kycInformation: null
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: ["USD"]
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
                extensions: [],
                errorInformation: null,
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
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
                        kycInformation: null
                    },
                    merchantClassificationCode: "78",
                    supportedCurrencies: ["USD"]
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
                extensions: [],
                errorInformation: null,
            }],
            expiration: "2099-01-04T22:49:25.375Z",
            extensions: [],
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
                source: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.inboundProtocolOpaqueState.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: FspiopTransformer.transformPayloadBulkQuotingResponsePut(message.payload, message.inboundProtocolOpaqueState.fspiopOpaqueState)
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
            errorCode: QuotingErrorCodeNames.COMMAND_TYPE_UNKNOWN
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
            errorCode: QuotingErrorCodeNames.INVALID_MESSAGE_PAYLOAD
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
            }));
        });
    });

    it("should return QuoteBCInvalidMessageTypeErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidMessageTypeErrorEvent({
            errorCode: QuotingErrorCodeNames.INVALID_MESSAGE_TYPE
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
            }));
        });
    });

    it("should return QuoteBCInvalidBulkQuoteLengthErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new QuoteBCInvalidBulkQuoteLengthErrorEvent({
            bulkQuoteId: "123",
            errorCode: QuotingErrorCodeNames.INVALID_BULK_QUOTE_LENGTH
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
            errorCode: QuotingErrorCodeNames.RULE_SCHEME_VIOLATED_RESPONSE
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
            errorCode: QuotingErrorCodeNames.RULE_SCHEME_VIOLATED_REQUEST
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
            errorCode: QuotingErrorCodeNames.QUOTE_NOT_FOUND
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
            errorCode: QuotingErrorCodeNames.BULK_QUOTE_NOT_FOUND
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
            errorCode: QuotingErrorCodeNames.INVALID_DESTINATION_PARTICIPANT
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
            errorCode: QuotingErrorCodeNames.DUPLICATE_QUOTE
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
            errorCode: QuotingErrorCodeNames.UNABLE_TO_ADD_QUOTE
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
            errorCode: QuotingErrorCodeNames.UNABLE_TO_ADD_BULK_QUOTE
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
            errorCode: QuotingErrorCodeNames.UNABLE_TO_UPDATE_QUOTE
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
            errorCode: QuotingErrorCodeNames.UNABLE_TO_UPDATE_BULK_QUOTE
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
            errorCode: QuotingErrorCodeNames.INVALID_SOURCE_PARTICIPANT
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
            errorCode: QuotingErrorCodeNames.SOURCE_PARTICIPANT_NOT_FOUND
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
            errorCode: QuotingErrorCodeNames.DESTINATION_PARTICIPANT_NOT_FOUND
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
            errorCode: QuotingErrorCodeNames.QUOTE_EXPIRED
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
            errorCode: QuotingErrorCodeNames.BULK_QUOTE_EXPIRED
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
