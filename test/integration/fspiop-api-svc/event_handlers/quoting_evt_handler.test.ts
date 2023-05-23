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
import { Request, Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { IParticipant } from "@mojaloop/participant-bc-public-types-lib";
import {
    BulkQuoteAcceptedEvt,
    BulkQuoteAcceptedEvtPayload,
    BulkQuoteReceivedEvt,
    BulkQuoteReceivedEvtPayload,
    QuotingBCInvalidIdErrorEvent,
    QuoteErrorPayload,
    QuoteQueryResponseEvt,
    QuoteQueryResponseEvtPayload,
    QuoteRequestAcceptedEvt,
    QuoteRequestAcceptedEvtPayload,
    QuoteRequestReceivedEvt,
    QuoteResponseAccepted,
    QuoteResponseAcceptedEvtPayload,
    QuotingBCTopics
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { Service } from "@mojaloop/interop-apis-bc-fspiop-api-svc";
import KafkaProducer, { getCurrentKafkaOffset } from "../helpers/kafkaproducer";

// Sets the location of your OpenAPI Specification file
jestOpenAPI(path.join(__dirname, "../../../../packages/fspiop-api-svc/api-specs/quoting-service/api-swagger.yaml"));

const kafkaProducer = new KafkaProducer();

const KAFKA_QUOTING_TOPIC = process.env["KAFKA_QUOTING_TOPIC"] || QuotingBCTopics.DomainEvents;
const KAFKA_OPERATOR_ERROR_TOPIC = process.env["KAFKA_OPERATOR_ERROR_TOPIC"] || "OperatorBcErrors";

const quoteEntity = "quotes";
const bulkQuoteEntity = "bulkQuotes";

jest.setTimeout(40000);

const validPostPayload = {
    "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
    "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
    "payee": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "1",
        "fspId": "fspPayeeOriginal",
        partySubIdOrType: null
      },
      merchantClassificationCode: null,
      name: null,
      personalInfo: null
    },
    "payer": {
      "partyIdInfo": {
        "partyIdType": "MSISDN",
        "partyIdentifier": "1",
        "fspId": "fspPayerOriginal",
        partySubIdOrType: null
      },
      merchantClassificationCode: null,
      name: null,
      personalInfo: null
    },
    "amountType": Enums.AmountTypeEnum.SEND,
    "amount": {
      "currency": "EUR",
      "amount": "1"
    },
    "transactionType": {
      "scenario": "DEPOSIT",
      "initiator": "PAYER",
      "initiatorType": "BUSINESS",
      subScenario: null,
      refundInfo: null,
      balanceOfPayments: null,
    },

    transactionRequestId: null,
    fees: null,
    geoCode: null,
    note: null,
    expiration: null,
    extensionList: null
};

const validPutPayload = {
    "transferAmount": {
        "currency": "EUR",
        "amount": "1"
      },
      "expiration": "2022-12-06T09:47:12.783Z",
      "ilpPacket": "AYICFwAAAAAAAABkFGcudW5kZWZpbmVkLm1zaXNkbi4xggH2ZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTjJZMVpEazNPRFF0TTJFMU55MDFPRFkxTFRsaFlUQXROMlJrWlRjM09URTFORGhoSWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMll5WmpGbU5DSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNKOWZTd2ljR0Y1WlhJaU9uc2ljR0Z5ZEhsSlpFbHVabThpT25zaWNHRnlkSGxKWkZSNWNHVWlPaUpOVTBsVFJFNGlMQ0p3WVhKMGVVbGtaVzUwYVdacFpYSWlPaUl4SW4xOUxDSmhiVzkxYm5RaU9uc2lZM1Z5Y21WdVkza2lPaUpGVlZJaUxDSmhiVzkxYm5RaU9pSXhJbjBzSW5SeVlXNXpZV04wYVc5dVZIbHdaU0k2ZXlKelkyVnVZWEpwYnlJNklrUkZVRTlUU1ZRaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkNWVk5KVGtWVFV5SjlmUQA",
      "condition": "ytl5JHBqkN1GGczeIqjN6mAgVEcilC8JVyWHDVOXoAA",
      "payeeFspCommission": {
        "currency": "EUR",
        "amount": "0.3"
      },
      "geoCode": {
        "latitude": "+90.000000",
        "longitude": "-7.882352"
      },
      "payeeReceiveAmount": {
        "currency": "EUR",
        "amount": "1"
      },
      "payeeFspFee": {
        "currency": "EUR",
        "amount": "0.2"
      },
      extensionList: null,
};

// Bulk Quotes

const validBulkPostPayload = {
    "payer": {
        "partyIdInfo": {
            "partyIdType": "MSISDN",
            "partyIdentifier": "1"
        }
    },
    "geoCode": {
        "latitude": "8.0",
        "longitude": "48.5378"
    },
    "expiration": "2023-01-04T22:49:25.375Z",
    "individualQuotes": [
        {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
            "payee": {
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "1"
                }
            },
            "amountType": "SEND",
            "amount": {
                "currency": "EUR",
                "amount": "1"
            },
            "transactionType": {
                "scenario": "DEPOSIT",
                "initiator": "PAYER",
                "initiatorType": "BUSINESS"
            },
        }
    ]
} as BulkQuoteReceivedEvtPayload;

const validBulkPutPayload = {
    "expiration": "4346-10-31T23:04:15.737+12:48",
    "individualQuoteResults": [
      {
        "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
        "ilpPacket": "AYICFwAAAAAAAABkFGcudW5kZWZpbmVkLm1zaXNkbi4xggH2ZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTjJZMVpEazNPRFF0TTJFMU55MDFPRFkxTFRsaFlUQXROMlJrWlRjM09URTFORGhoSWl3aWNYVnZkR1ZKWkNJNklqSXlORE5tWkdKbExUVmtaV0V0TTJGaVpDMWhNakV3TFRNM09EQmxOMll5WmpGbU5DSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTVNKOWZTd2ljR0Y1WlhJaU9uc2ljR0Z5ZEhsSlpFbHVabThpT25zaWNHRnlkSGxKWkZSNWNHVWlPaUpOVTBsVFJFNGlMQ0p3WVhKMGVVbGtaVzUwYVdacFpYSWlPaUl4SW4xOUxDSmhiVzkxYm5RaU9uc2lZM1Z5Y21WdVkza2lPaUpGVlZJaUxDSmhiVzkxYm5RaU9pSXhJbjBzSW5SeVlXNXpZV04wYVc5dVZIbHdaU0k2ZXlKelkyVnVZWEpwYnlJNklrUkZVRTlUU1ZRaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkNWVk5KVGtWVFV5SjlmUQA",
        "payeeFspFee": {
          "currency": "USD",
          "amount": "2"
        },
        "transferAmount": {
          "currency": "USD",
          "amount": "123"
        },
        "errorInformation": null,
        "condition": "xmHnYE0iQnMvi1CshISk9iYCf7MG3_ZsMNN9I4HKnAo",
        "extensionList": {
          "extension": [
            {
              "key": "irure",
              "value": "occaecat irure"
            },
            {
              "key": "eu laborum qui",
              "value": "dolore ipsum aliqua irure reprehenderit"
            }
          ]
        },
        "payeeReceiveAmount": {
          "currency": "USD",
          "amount": "123"
        },
        "payee": {
          "partyIdInfo": {
            "partyIdType": "EMAIL",
            "partyIdentifier": "ex nostrud veniam mollit",
            "partySubIdOrType": "aliquip anim qui reprehenderit o",
            "extensionList": {
              "extension": [
                {
                  "key": "proident cill",
                  "value": "cupidatat tempor"
                },
                {
                  "key": "aute Duis pariatu",
                  "value": "id sit proident"
                }
              ]
            },
            "fspId": "magna minim sit"
          },
          "name": " L_lauPoCLiu=nlpeu,}=iurploMri ag.gL=aJukraaMtp r_ =cMC{'PnkugJJ{--e}eoL{aL}M}kd,otMiC_pte,LoaoMr.,r",
          "personalInfo": {
            "complexName": {
              "firstName": "Maria",
              "middleName": "G",
              "lastName": "Smith"
            },
            "dateOfBirth": "1988-11-04"
          },
          "merchantClassificationCode": "7"
        },
        "payeeFspCommission": {
          "currency": "USD",
          "amount": "3"
        }
      }
    ],
    "extensionList": {
      "extension": [
        {
          "key": "cillum ut co",
          "value": "nisi"
        },
        {
          "key": "velit repr",
          "value": "fugiat culpa reprehenderit commodo"
        }
      ]
    }
  };

describe("FSPIOP API Service Quoting Handler", () => {
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
    });

    afterAll(async () => {
        await Service.stop();
        await kafkaProducer.destroy();
    });

    //#region QuotingBCInvalidIdErrorEvent
    it("should successful treat QuotingBCInvalidIdErrorEvent for Quote type event", async () => {
        // Arrange
        const payload: QuoteErrorPayload = {
            requesterFspId: "Greenbank",
            destinationFspId: "test-fspiop-destination",
            quoteId: "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            errorMessage: "test error message",
            sourceEvent: QuoteRequestReceivedEvt.name,
        };

        const event = new QuotingBCInvalidIdErrorEvent(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"Greenbank",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"Greenbank"
            }
        };

        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quoteEntity}/${payload.quoteId}/error`)
            }));
        });


        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when QuotingBCInvalidIdErrorEvent finds no participant endpoint", async () => {
        // Arrange
        const payload: QuoteErrorPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            errorMessage: "test error message",
            sourceEvent: "non-existing-source-event",
        };

        const event = new QuotingBCInvalidIdErrorEvent(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 5000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage:any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }

        // Assert
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuotingBCInvalidIdErrorEvent.name);
        });
    });

    it("should log when QuotingBCInvalidIdErrorEvent throws an error", async () => {
        // Arrange
        const payload: QuoteErrorPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            errorMessage: "test error message",
            sourceEvent: "non-existing-source-event",
            ...validPutPayload
        };

        const event = new QuotingBCInvalidIdErrorEvent(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };


        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        await new Promise((r) => setTimeout(r, 2000));

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });

    it("should use default case when QuotingBCInvalidIdErrorEvent has no correct name", async () => {
        // Arrange
        const payload: QuoteErrorPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            quoteId: "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            errorMessage: "test error message",
            sourceEvent: "non-existing-source-event",
            ...validPutPayload
        };

        const event = new QuotingBCInvalidIdErrorEvent(payload);

        event.msgName = "non-existing-message-name";

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        await new Promise((r) => setTimeout(r, 2000));

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledTimes(0);
        });
    });
    //#endregion

    //#region QuoteRequestAcceptedEvt
    it("should log error when QuoteRequestAcceptedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload: QuoteRequestAcceptedEvtPayload = {
            ...validPostPayload,

        };

        const event = new QuoteRequestAcceptedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"non-existing-owner-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage:any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }

        // Assert
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteRequestAcceptedEvt.name);
        });
    });

    it("should throw error QuoteRequestAcceptedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload: QuoteRequestAcceptedEvtPayload = {
            ...validPostPayload
        };

        const event = new QuoteRequestAcceptedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async () => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quoteEntity}/${payload.quoteId}/error`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    });
    //#endregion

     //#region QuoteResponseAccepted
     it("should successful treat QuoteResponseAccepted", async () => {
        // Arrange
        const payload: QuoteResponseAcceptedEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteResponseAccepted(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quoteEntity}/${payload.quoteId}`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when QuoteResponseAccepted finds no participant endpoint", async () => {
        // Arrange
        const payload: QuoteResponseAcceptedEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteResponseAccepted(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage:any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }

        // Assert
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteResponseAccepted.name);
        });
    });

    it("should throw error QuoteResponseAccepted due to failing to sendRequest", async () => {
        // Arrange
        const payload: QuoteResponseAcceptedEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteResponseAccepted(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async () => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quoteEntity}/${payload.quoteId}/error`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    });
    //#endregion

    //#region QuoteQueryResponseEvt
    it("should successful treat QuoteQueryResponseEvt", async () => {
        // Arrange
        const payload: QuoteQueryResponseEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteQueryResponseEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quoteEntity}/${payload.quoteId}`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when QuoteQueryResponseEvt finds no participant endpoint", async () => {
        // Arrange
        const payload: QuoteQueryResponseEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteQueryResponseEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage:any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }

        // Assert
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(QuoteQueryResponseEvt.name);
        });
    });

    it("should throw error QuoteQueryResponseEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload: QuoteQueryResponseEvtPayload = {
            "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validPutPayload
        };

        const event = new QuoteQueryResponseEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${quoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async () => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${quoteEntity}/${payload.quoteId}/error`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    });
    //#endregion

    //#region BulkQuoteReceivedEvt
    it("should successful treat BulkQuoteReceivedEvt", async () => {
        // Arrange
        const payload: BulkQuoteReceivedEvtPayload = {
            ...validBulkPostPayload,
            "bulkQuoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
        };

        const event = new BulkQuoteReceivedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuoteEntity}`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when BulkQuoteReceivedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload: BulkQuoteReceivedEvtPayload = {
            ...validBulkPostPayload,
            "bulkQuoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
        };

        const event = new BulkQuoteReceivedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage:any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }

        // Assert
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(BulkQuoteReceivedEvt.name);
        });
    });

    it("should throw error BulkQuoteReceivedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload: BulkQuoteReceivedEvtPayload = {
            ...validBulkPostPayload,
            "bulkQuoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
        };

        const event = new BulkQuoteReceivedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async () => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuoteEntity}/${payload.bulkQuoteId}/error`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    });
    //#endregion

    //#region BulkQuoteAcceptedEvt
    it("should successful treat BulkQuoteAcceptedEvt", async () => {
        // Arrange
        const payload: BulkQuoteAcceptedEvtPayload = {
            "bulkQuoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validBulkPutPayload,
        };

        const event = new BulkQuoteAcceptedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpy = jest.spyOn(Request, "sendRequest");

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        jest.spyOn(Request, "sendRequest");

        const res = async () => {
            return await requestSpy.mock.results[requestSpy.mock.results.length].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuoteEntity}/${payload.bulkQuoteId}`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();
    });

    it("should log error when BulkQuoteAcceptedEvt finds no participant endpoint", async () => {
        // Arrange
        const payload: BulkQuoteAcceptedEvtPayload = {
            "bulkQuoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validBulkPutPayload,
        };

        const event = new BulkQuoteAcceptedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"non-existing-requester-id",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        participantClientSpy.mockResolvedValueOnce(null);

        // Act
        const expectedOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);

        await new Promise((r) => setTimeout(r, 2000));

        let sentMessagesCount = 0;
        let expectedOffsetMessage:any;
        const currentOffset = await getCurrentKafkaOffset(KAFKA_OPERATOR_ERROR_TOPIC);

        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
            expectedOffsetMessage = JSON.parse(currentOffset.value as string);
        }

        // Assert
        await waitForExpect(() => {
            expect(sentMessagesCount).toBe(1);
            expect(expectedOffsetMessage.msgName).toBe(BulkQuoteAcceptedEvt.name);
        });
    });

    it("should throw error BulkQuoteAcceptedEvt due to failing to sendRequest", async () => {
        // Arrange
        const payload: BulkQuoteAcceptedEvtPayload = {
            "bulkQuoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
            ...validBulkPutPayload,
        };

        const event = new BulkQuoteAcceptedEvt(payload);

        event.fspiopOpaqueState = {
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "content-type":`application/vnd.interoperability.${bulkQuoteEntity}+json;version=1.0`,
                "date":"randomdate",
                "fspiop-source":"test-fspiop-source"
            }
        };

        const requestSpyOn = jest.spyOn(Request, "sendRequest");

        requestSpyOn.mockImplementationOnce(() => {
            throw new Error("test error");
        });

        // Act
        kafkaProducer.sendMessage(KAFKA_QUOTING_TOPIC, event);


        const apiSpy = jest.spyOn(Request, "sendRequest");
        const res = async () => {
            return await apiSpy.mock.results[apiSpy.mock.results.length-1].value;
        };

        // Assert
        await waitForExpect(() => {
            expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
                url: expect.stringContaining(`/${bulkQuoteEntity}/${payload.bulkQuoteId}/error`)
            }));
        });

        expect(await res()).toSatisfyApiSpec();

    });
    // //#endregion
});
