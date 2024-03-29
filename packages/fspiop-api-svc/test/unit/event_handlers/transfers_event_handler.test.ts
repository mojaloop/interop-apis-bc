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
import { AccountLookUpUnableToGetParticipantFromOracleErrorEvent, AccountLookUpUnknownErrorEvent, AccountLookupBCDestinationParticipantNotFoundErrorEvent, AccountLookupBCInvalidDestinationParticipantErrorEvent, AccountLookupBCInvalidMessagePayloadErrorEvent, AccountLookupBCInvalidMessageTypeErrorEvent, AccountLookupBCInvalidRequesterParticipantErrorEvent, AccountLookupBCRequesterParticipantNotFoundErrorEvent, AccountLookupBCTopics, AccountLookupBCUnableToAssociateParticipantErrorEvent, AccountLookupBCUnableToDisassociateParticipantErrorEvent, AccountLookupBCUnableToGetOracleAdapterErrorEvent, BulkQuoteAcceptedEvt, BulkQuoteQueryResponseEvt, BulkQuoteReceivedEvt, BulkQuoteReceivedEvtPayload, BulkTransferFulfiledEvt, BulkTransferPreparedEvt, BulkTransferQueryResponseEvt, BulkTransferRejectRequestProcessedEvt, GetPartyQueryRejectedResponseEvt, ParticipantAssociationCreatedEvt, ParticipantAssociationRemovedEvt, ParticipantQueryResponseEvt, PartyInfoRequestedEvt, PartyQueryResponseEvt, QuoteBCBulkQuoteExpiredErrorEvent, QuoteBCBulkQuoteNotFoundErrorEvent, QuoteBCDestinationParticipantNotFoundErrorEvent, QuoteBCDuplicateQuoteErrorEvent, QuoteBCInvalidBulkQuoteLengthErrorEvent, QuoteBCInvalidDestinationFspIdErrorEvent, QuoteBCInvalidMessagePayloadErrorEvent, QuoteBCInvalidMessageTypeErrorEvent, QuoteBCInvalidRequesterFspIdErrorEvent, QuoteBCQuoteExpiredErrorEvent, QuoteBCQuoteNotFoundErrorEvent, QuoteBCQuoteRuleSchemeViolatedRequestErrorEvent, QuoteBCQuoteRuleSchemeViolatedResponseErrorEvent, QuoteBCRequesterParticipantNotFoundErrorEvent, QuoteBCUnableToAddBulkQuoteToDatabaseErrorEvent, QuoteBCUnableToAddQuoteToDatabaseErrorEvent, QuoteBCUnableToUpdateBulkQuoteInDatabaseErrorEvent, QuoteBCUnableToUpdateQuoteInDatabaseErrorEvent, QuoteBCUnknownErrorEvent, QuoteQueryResponseEvt, QuoteRequestAcceptedEvt, QuoteResponseAccepted, QuotingBCTopics, TransferCancelReservationAndCommitFailedEvt, TransferCancelReservationFailedEvt, TransferDuplicateCheckFailedEvt, TransferFulfilCommittedRequestedTimedoutEvt, TransferFulfilPostCommittedRequestedTimedoutEvt, TransferFulfiledEvt, TransferFulfiledEvtPayload, TransferHubAccountNotFoundFailedEvt, TransferHubNotFoundFailedEvt, TransferInvalidMessagePayloadEvt, TransferInvalidMessageTypeEvt, TransferNotFoundEvt, TransferPayeeLiquidityAccountNotFoundFailedEvt, TransferPayeeNotActiveEvt, TransferPayeeNotApprovedEvt, TransferPayeeNotFoundFailedEvt, TransferPayeePositionAccountNotFoundFailedEvt, TransferPayerLiquidityAccountNotFoundFailedEvt, TransferPayerNotActiveEvt, TransferPayerNotApprovedEvt, TransferPayerNotFoundFailedEvt, TransferPayerPositionAccountNotFoundFailedEvt, TransferPrepareInvalidPayeeCheckFailedEvt, TransferPrepareInvalidPayerCheckFailedEvt, TransferPrepareLiquidityCheckFailedEvt, TransferPrepareRequestTimedoutEvt, TransferPreparedEvt, TransferPreparedEvtPayload, TransferQueryInvalidPayeeCheckFailedEvt, TransferQueryInvalidPayeeParticipantIdEvt, TransferQueryInvalidPayerCheckFailedEvt, TransferQueryInvalidPayerParticipantIdEvt, TransferQueryPayeeNotFoundFailedEvt, TransferQueryPayerNotFoundFailedEvt, TransferQueryResponseEvt, TransferRejectRequestProcessedEvt, TransferRejectRequestProcessedEvtPayload, TransferUnableToAddEvt, TransferUnableToDeleteTransferReminderEvt, TransferUnableToGetTransferByIdEvt, TransferUnableToUpdateEvt, TransfersBCTopics, TransfersBCUnknownErrorEvent } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { ConsoleLogger, ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import { MemoryParticipantService, createMessage, getJwsConfig } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import { Constants, Enums, FspiopJwsSignature, Request, Transformer } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { TransferEventHandler } from "../../../src/event_handlers/transfers_evt_handler";
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

const transfersEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
    kafkaBrokerList: KAFKA_URL,
    kafkaGroupId: `${BC_NAME}_${APP_NAME}_TransferEventHandler`,
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
let transfersEvtHandler:TransferEventHandler;

jwsHelperMock = getJwsConfig();


const transfersEntity = "transfers";
const bulkTransfersEntity = "bulkTransfers";

jest.setTimeout(10000);

describe("FSPIOP Routes - Unit Tests Transfers Event Handler", () => {

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
        transfersEvtHandler = new TransferEventHandler(
            logger,
            transfersEvtHandlerConsumerOptions,
            kafkaJsonProducerOptions,
            [TransfersBCTopics.DomainEvents],
            mockedParticipantService,
            jwsHelperMock
        );

        await transfersEvtHandler.init();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    afterAll(async () => {
        jest.clearAllMocks();

        await transfersEvtHandler.destroy();
    });

    //#region TransferPreparedEvt
    it("should throw when processing TransferPreparedEvt", async () => {
        // Arrange
        const msg = new TransferPreparedEvt({
            transferId: "1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9",
            payerFsp: "nonexistingfsp",
            payeeFsp: "test-fspiop-destination",
            amount: "USD",
            currencyCode: "10",
            ilpPacket: "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            condition: "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            expiration: 0,
            settlementModel: "DEFAULT",
            preparedAt: 0,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`),
                source: msg.payload.payerFsp,
                destination: msg.payload.payeeFsp,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call TransferPreparedEvt", async () => {
        // Arrange
        const msg = new TransferPreparedEvt({
            transferId: "1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9",
            payerFsp: "test-fspiop-source",
            payeeFsp: "test-fspiop-destination",
            amount: "USD",
            currencyCode: "10",
            ilpPacket: "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
            condition: "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
            expiration: 0,
            settlementModel: "DEFAULT",
            preparedAt: 0,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${transfersEntity}`),
                source: msg.payload.payerFsp,
                destination: msg.payload.payeeFsp,
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadTransferRequestPost(message.payload)
            }));
        });

    });
    // #endregion

    //#region TransferFulfiledEvt
    it("should throw when processing TransferFulfiledEvt", async () => {
        // Arrange
        const msg = new TransferFulfiledEvt({
            transferId: "1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9",
            fulfilment: null,
            completedTimestamp: 0,
            payerFspId: "nonexistingfsp",
            payeeFspId: "test-fspiop-destination",
            amount: "10",
            currencyCode: "USD",
            settlementModel: "DEFAULT",
            notifyPayee: false,
            fulfiledAt: 0,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`),
                source: msg.payload.payerFspId,
                destination: msg.payload.payeeFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call TransferFulfiledEvt", async () => {
        // Arrange
        const msg = new TransferFulfiledEvt({
            transferId: "1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9",
            fulfilment: null,
            completedTimestamp: 0,
            payerFspId: "test-fspiop-source",
            payeeFspId: "test-fspiop-destination",
            amount: "10",
            currencyCode: "USD",
            settlementModel: "DEFAULT",
            notifyPayee: false,
            fulfiledAt: 0,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${transfersEntity}`),
                source: msg.payload.payerFspId,
                destination: msg.payload.payeeFspId,
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadTransferRequestPut(message.payload)
            }));
        });

    });
    // #endregion

     //#region TransferQueryResponseEvt
     it("should throw when processing TransferQueryResponseEvt", async () => {
        // Arrange
        const msg = new TransferQueryResponseEvt({
            transferId: "1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9",
            transferState: "COMPLETED",
            fulfilment: null,
            completedTimestamp: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call TransferFulfiledEvt", async () => {
        // Arrange
        const msg = new TransferQueryResponseEvt({
            transferId: "1fbee0f3-c58e-5afe-8cdd-7e65eea2fca9",
            transferState: "COMMITTED",
            fulfilment: null,
            completedTimestamp: null,
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${transfersEntity}`),
                source: Constants.FSPIOP_HEADERS_SWITCH,
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadTransferRequestGet(message.payload)
            }));
        });

    });
    // #endregion

    
     // #region BulkTransferPreparedEvt
     it("should throw when processing BulkTransferPreparedEvt", async () => {
        // Arrange
        const msg = new BulkTransferPreparedEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            bulkQuoteId: "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            payerFsp: "nonexistingfsp",
            payeeFsp: "test-fspiop-destination",
            expiration: "2024-02-28T13:27:53.536Z",
            individualTransfers: [        {
                transferId: "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                currencyCode: "USD",
                amount: "10",
                ilpPacket: "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                condition: "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
                extensionList: null
            }],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${msg.payload.bulkTransferId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkTransferPreparedEvt", async () => {
        // Arrange
        const msg = new BulkTransferPreparedEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            bulkQuoteId: "3854fdbe-5dea-3abd-a210-8780e7f2f1f4",
            payerFsp: "test-fspiop-source",
            payeeFsp: "test-fspiop-destination",
            expiration: "2024-02-28T13:27:53.536Z",
            individualTransfers: [        {
                transferId: "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                currencyCode: "USD",
                amount: "10",
                ilpPacket: "AYICbQAAAAAAAAPoHGcuYmx1ZWJhbmsubXNpc2RuLmJsdWVfYWNjXzGCAkRleUowY21GdWMyRmpkR2x2Ymtsa0lqb2lPV1kxWkRrM09EUXRNMkUxTnkwMU9EWTFMVGxoWVRBdE4yUmtaVGMzT1RFMU5EZ3hJaXdpY1hWdmRHVkpaQ0k2SW1ZMU5UaGtORFE0TFRCbU1UQXROREF4TmkwNE9ESXpMVEU1TjJObU5qZ3haamhrWmlJc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lZbXgxWlY5aFkyTmZNU0lzSW1aemNFbGtJam9pWW14MVpXSmhibXNpZlgwc0luQmhlV1Z5SWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2laM0psWlc1ZllXTmpYekVpTENKbWMzQkpaQ0k2SW1keVpXVnVZbUZ1YXlKOWZTd2lZVzF2ZFc1MElqcDdJbU4xY25KbGJtTjVJam9pUlZWU0lpd2lZVzF2ZFc1MElqb2lNVEFpZlN3aWRISmhibk5oWTNScGIyNVVlWEJsSWpwN0luTmpaVzVoY21sdklqb2lSRVZRVDFOSlZDSXNJbWx1YVhScFlYUnZjaUk2SWxCQldVVlNJaXdpYVc1cGRHbGhkRzl5Vkhsd1pTSTZJa0pWVTBsT1JWTlRJbjE5AA",
                condition: "STksBXN1-J5HnG_4owlzKnbmzCfiOlrKDPgiR-QZ7Kg",
                extensionList: null
            }],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.POST,
                payload: Transformer.transformPayloadBulkTransferRequestPost(message.payload)
            }));
        });

    });
    // #endregion
    
    // #region BulkTransferFulfiledEvt
    it("should throw when processing BulkTransferFulfiledEvt", async () => {
        // Arrange
        const msg = new BulkTransferFulfiledEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            completedTimestamp: new Date("2099-09-18T10:57:25.163Z").valueOf(),
            bulkTransferState: "COMPLETED",
            individualTransferResults: [{
                transferId: "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                fulfilment: "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0",
                extensionList: null  
            } as any],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${msg.payload.bulkTransferId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkTransferFulfiledEvt", async () => {
        // Arrange
        const msg = new BulkTransferFulfiledEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            completedTimestamp: new Date("2099-09-18T10:57:25.163Z").valueOf(),
            bulkTransferState: "COMPLETED",
            individualTransferResults: [{
                transferId: "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                fulfilment: "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0",
                extensionList: null  
            } as any],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${message.payload.bulkTransferId}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkTransferRequestPut(message.payload)
            }));
        });

    });
    // #endregion
        
    // #region BulkTransferQueryResponseEvt
    it("should throw when processing BulkTransferQueryResponseEvt", async () => {
        // Arrange
        const msg = new BulkTransferQueryResponseEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            completedTimestamp: new Date("2099-09-18T10:57:25.163Z").valueOf(),
            bulkTransferState: "COMPLETED",
            individualTransferResults: [{
                transferId: "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                fulfilment: "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0",
                extensionList: null  
            } as any],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${msg.payload.bulkTransferId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkTransferQueryResponseEvt", async () => {
        // Arrange
        const msg = new BulkTransferQueryResponseEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            completedTimestamp: new Date("2099-09-18T10:57:25.163Z").valueOf(),
            bulkTransferState: "COMPLETED",
            individualTransferResults: [{
                transferId: "1fbee2f3-c58e-5afe-8cdd-6e65eea2fca9",
                fulfilment: "on1meDEOvLmjYTvujP438_lhaMCi8V0wx0uUvjp8vT0",
                extensionList: null  
            } as any],
            extensionList: null
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${message.payload.bulkTransferId}`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkTransferRequestPut(message.payload)
            }));
        });

    });
    // #endregion
    
    // #region BulkTransferRejectRequestProcessedEvt
    it("should throw when processing BulkTransferRejectRequestProcessedEvt", async () => {
        // Arrange
        const msg = new BulkTransferRejectRequestProcessedEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            errorInformation: { 
                errorCode: "transfer id error code",
                errorDescription: "error transfer description",
                extensionList: null
            }
        });


        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "nonexistingfsp",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo")
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${msg.payload.bulkTransferId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: invalidParticipantEndpointError
            }));    
        });
    });

    it("should successfully call BulkTransferRejectRequestProcessedEvt", async () => {
        // Arrange
        const msg = new BulkTransferRejectRequestProcessedEvt({
            bulkTransferId: "0fbee1f3-c58e-5afe-8cdd-7e65eea2fca9",
            errorInformation: { 
                errorCode: "transfer id error code",
                errorDescription: "error transfer description",
                extensionList: null
            }
        });

        const message = createMessage(msg, Enums.EntityTypeEnum.BULK_TRANSFERS, {
            [Constants.FSPIOP_HEADERS_SOURCE]: "test-fspiop-source",
            [Constants.FSPIOP_HEADERS_DESTINATION]: "test-fspiop-destination"
        });

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(() => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkTransfersEntity}/${message.payload.bulkTransferId}/error`),
                source: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_SOURCE],
                destination: message.fspiopOpaqueState.headers[Constants.FSPIOP_HEADERS_DESTINATION],
                method: Enums.FspiopRequestMethodsEnum.PUT,
                payload: Transformer.transformPayloadBulkTransferRequestPutError(message.payload)
            }));
        });

    });
    // #endregion

    // #region Error events
    it("should return TransfersBCUnknownErrorEvent http call for participant type", async () => {
        // Arrange
        const msg = new TransfersBCUnknownErrorEvent({
            transferId: "123", 
            payerFspId: "bluebank",
            errorDescription: "TransfersBCUnknownErrorEvent"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
            await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
    
    it("should return TransferUnableToDeleteTransferReminderEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferUnableToDeleteTransferReminderEvt({
            transferId: "123", 
            errorDescription: "TransferUnableToDeleteTransferReminderEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
        
    it("should return TransferHubNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferHubNotFoundFailedEvt({
            transferId: "123", 
            errorDescription: "TransferHubNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
        
    it("should return TransferHubAccountNotFoundFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferHubAccountNotFoundFailedEvt({
            transferId: "123", 
            errorDescription: "TransferHubAccountNotFoundFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
                        
    it("should return TransferNotFoundEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferNotFoundEvt({
            transferId: "123",
            errorDescription: "TransferNotFoundEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
                        
    it("should return TransferUnableToGetTransferByIdEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferUnableToGetTransferByIdEvt({
            transferId: "123",
            errorDescription: "TransferUnableToGetTransferByIdEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.INVALID_SIGNATURE.code,
                        "errorDescription": Enums.ClientErrors.INVALID_SIGNATURE.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.TRANSFER_EXPIRED.code,
                        "errorDescription": Enums.ClientErrors.TRANSFER_EXPIRED.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
                                    
    it("should return TransferCancelReservationFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferCancelReservationFailedEvt({
            transferId: "123",
            errorDescription: "TransferCancelReservationFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
                                    
    it("should return TransferCancelReservationAndCommitFailedEvt http call for participant type", async () => {
        // Arrange
        const msg = new TransferCancelReservationAndCommitFailedEvt({
            transferId: "123",
            errorDescription: "TransferCancelReservationAndCommitFailedEvt"
        })
        
        const message = createMessage(msg, Enums.EntityTypeEnum.TRANSFERS);

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
                        "errorDescription": Enums.ServerErrors.GENERIC_SERVER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.code,
                        "errorDescription": Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": msg.payload.errorInformation
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
                        "errorDescription": Enums.PayerErrors.GENERIC_PAYER_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
                        "errorDescription": Enums.ClientErrors.DESTINATION_FSP_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
                        "errorDescription": Enums.ClientErrors.DESTINATION_FSP_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
                        "errorDescription": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
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

        jest.spyOn(mockedParticipantService, "getParticipantInfo").mockResolvedValue(mockedParticipant);

        const sendRequestSpy = jest.spyOn(Request, "sendRequest");
        
        // Act
        await transfersEvtHandler.processMessage(message);

        // Assert
        await waitForExpect(async () => {
            expect(sendRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
                "payload": {
                    "errorInformation": { 
                        "errorCode": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
                        "errorDescription": Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
                    }
                },
                "url": expect.stringContaining(`/${transfersEntity}/${msg.payload.transferId}/error`)
            }));
        });
    });
    // #region

});
