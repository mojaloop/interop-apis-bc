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
 should be listed with a "" in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a "-". Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 **/

"use strict";


import { FSPIOP_HEADERS_ACCEPT, FSPIOP_HEADERS_CONTENT_LENGTH, FSPIOP_HEADERS_CONTENT_TYPE, FSPIOP_HEADERS_DATE, FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION, FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION, FSPIOP_HEADERS_DESTINATION, FSPIOP_HEADERS_ENCRYPTION, FSPIOP_HEADERS_HTTP_METHOD, FSPIOP_HEADERS_SIGNATURE, FSPIOP_HEADERS_SOURCE, FSPIOP_HEADERS_SWITCH, FSPIOP_HEADERS_URI, FSPIOP_HEADERS_X_FORWARDED_FOR } from "../../src/constants";
import { Enums, Constants, Request } from "../../src";
import axios from "axios";
import HeaderBuilder from "../../src/headers/header_builder";
import { ParticipantsPutTypeAndId } from "../../../fspiop-api-svc/src/errors";
import { removeEmpty, transformPayloadError, transformPayloadParticipantPut, transformPayloadPartyAssociationPut, transformPayloadPartyDisassociationPut, transformPayloadPartyInfoReceivedPut, transformPayloadPartyInfoRequestedPut } from "../../src/transformer";
import { ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvtPayload, ParticipantQueryResponseEvtPayload, PartyInfoRequestedEvtPayload, PartyQueryResponseEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";

jest.mock("axios");

describe("FSPIOP Utils Lib", () => {

    afterEach(async () => {
        jest.resetAllMocks();
    });

    //#region Request
    test("should be able to send a request", async()=>{
        // Arrange
        const response = [
            { test: "random response" },
        ];

        (axios as unknown as jest.Mock).mockResolvedValueOnce(response)

        // Act
        await Request.sendRequest({
            url: "testurl",
            headers: {
                [FSPIOP_HEADERS_CONTENT_TYPE]: "1",
                [FSPIOP_HEADERS_SOURCE]: "1",
                [FSPIOP_HEADERS_DESTINATION]: "1",
                [FSPIOP_HEADERS_ACCEPT]: "1",
                [FSPIOP_HEADERS_HTTP_METHOD]: "1",
                [FSPIOP_HEADERS_SIGNATURE]: "1",
                [FSPIOP_HEADERS_DATE]: "1",
                [FSPIOP_HEADERS_URI]: "1",
                [FSPIOP_HEADERS_SWITCH]: "1",
            },
            source: "1",
            destination: "2",
            method: Enums.FspiopRequestMethodsEnum.PUT,
            payload: {
                fspId: "1",
            },
        });


        // Assert
        expect(axios).toBeCalledWith({
            "data": {
                "fspId": "1",
            },
            "headers": {
                "accept": "1",
                "content-length": undefined,
                "content-type": "1",
                "date": "Mon, 01 Jan 2001 00:00:00 GMT",
                "fspiop-destination": "1",
                "fspiop-encryption": undefined,
                "fspiop-http-method": "PUT",
                "fspiop-signature": "1",
                "fspiop-source": "1",
                "fspiop-uri": "1",
                "x-forwarded-for": undefined,
            },
            "method": "PUT",
            "responseType": "json",
            "url": "testurl",
        });
    });
    //#endregion

    //#region Header builder
    test("should successfully build a valid header structure", async()=>{
        // Arrange
        const headers = {
            "accept":"application/vnd.interoperability.parties+json;version=1.0",
            "content-type":"application/vnd.interoperability.parties+json;version=1.0",
            "fspiop-source":"test-fspiop-source",
            "content-length": 0,
            "date": "Mon, 01 Jan 2001 00:00:00 GMT",
            "fspiop-destination": "test-fspiop-destination",
            "fspiop-encryption": "test-fspiop-encryption",
            "fspiop-http-method": Enums.FspiopRequestMethodsEnum.PUT,
            "fspiop-signature": "test-fspiop-signature",
            "fspiop-uri": "test-fspiop-uri",
            "x-forwarded-for": "test-fspiop-x-forwarded-for"
        };

        const config =  {
            httpMethod: "PUT",
            sourceFsp: "source",
            destinationFsp: "destination",
            protocolVersions: {
                content: FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
                accept: FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION
            },
            headers
        };

        // Act
        const builder = new HeaderBuilder();
        builder.setAccept(headers[FSPIOP_HEADERS_ACCEPT]);
        builder.setContentType(headers[FSPIOP_HEADERS_CONTENT_TYPE]);
        builder.setDate(headers[FSPIOP_HEADERS_DATE])
        builder.setFspiopSource(headers[FSPIOP_HEADERS_SOURCE]);
        builder.setContentLength(headers[FSPIOP_HEADERS_CONTENT_LENGTH]);
        builder.setXForwardedFor(headers[FSPIOP_HEADERS_X_FORWARDED_FOR]);
        builder.setFspiopDestination(headers[FSPIOP_HEADERS_DESTINATION]);
        builder.setFspiopEncryption(headers[FSPIOP_HEADERS_ENCRYPTION]);
        builder.setFspiopSignature(headers[FSPIOP_HEADERS_SIGNATURE]);
        builder.setFspiopUri(headers[FSPIOP_HEADERS_URI]);
        builder.setFspiopHttpMethod(headers[FSPIOP_HEADERS_HTTP_METHOD], config);

        const result = builder.getResult().build();

        // Assert
        expect(result).toMatchObject({
            "fspiop-source":"test-fspiop-source",
            "content-length": 0,
            "date": "Mon, 01 Jan 2001 00:00:00 GMT",
            "fspiop-destination": "test-fspiop-destination",
            "fspiop-encryption": "test-fspiop-encryption",
            "fspiop-http-method": Enums.FspiopRequestMethodsEnum.PUT,
            "fspiop-signature": "test-fspiop-signature",
            "fspiop-uri": "test-fspiop-uri",
            "x-forwarded-for": "test-fspiop-x-forwarded-for"
        });
    });

    test("should default http method to null if null is passed", async()=>{
        // Arrange
        const config =  {
            httpMethod: "PUT",
            sourceFsp: "source",
            destinationFsp: "destination",
            protocolVersions: {
                content: FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
                accept: FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION
            },
            headers: {}
        };

        // Act
        const builder = new HeaderBuilder();

        builder.setFspiopHttpMethod(null as unknown as string, config);

        const result = builder.getResult().build();

        // Assert
        expect(result).toMatchObject(expect.objectContaining({
            "fspiop-http-method": undefined,
        }));
    });

    test("should formate date to UTC string if date header is instance of date", async()=>{
        // Arrange
        const headerDate = new Date();

        // Act
        const builder = new HeaderBuilder();

        builder.setDate(headerDate);

        const result = builder.getResult().build();

        // Assert
        expect(result).toMatchObject(expect.objectContaining({
            "date": headerDate.toUTCString(),
        }));
    });

    test("should default to sent header date value if unable to convert invalid date", async()=>{
        // Arrange
        const headerDate = "invalid-date";

        // Act
        const builder = new HeaderBuilder();

        builder.setDate(headerDate);

        const result = builder.getResult().build();

        // Assert
        expect(result).toMatchObject(expect.objectContaining({
            "date": "invalid-date",
        }));
    });
    //#endregion

    //#region Transformer
    test("should be able to remove empty properties from an object", async()=>{
        // Arrange
        const sampleObject = {
            "name": "random",
            "age": null,
            "surname": "",
            "address": {
                "street": "test",
                "city": null,
                "country": ""
            }
        };

        // Act
        const result = removeEmpty(sampleObject);

        // Assert
        expect(result).toEqual({
            "address": {
                "street": "test",
            },
            "name": "random",
        });
    });

    test("should be able to get correct result from transformPayloadParticipantPut", async()=>{
        // Arrange
        const payload: ParticipantQueryResponseEvtPayload = {
            requesterFspId: "non-existing-requester-id",
            ownerFspId:"test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        // Act
        const result = transformPayloadParticipantPut(payload);

        // Assert
        expect(result).toEqual({
            "fspId": "test-fspiop-source",
        });
    });

    test("should be able to get correct result from transformPayloadPartyAssociationPut", async()=>{
        // Arrange
        const payload: ParticipantAssociationCreatedEvtPayload = {
            ownerFspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null
        };

        // Act
        const result = transformPayloadPartyAssociationPut(payload);

        // Assert
        expect(result).toEqual({
            "party": {
                    "partyIdInfo": {
                    "fspId": "test-fspiop-source",
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                },
            },
        });
    });

    test("should be able to get correct result from transformPayloadPartyDisassociationPut", async()=>{
        // Arrange
        const payload: ParticipantAssociationRemovedEvtPayload = {
            ownerFspId: "test-fspiop-source",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null
        };

        // Act
        const result = transformPayloadPartyDisassociationPut(payload);

        // Assert
        expect(result).toEqual({
            "party": {
                    "partyIdInfo": {
                    "fspId": "test-fspiop-source",
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                },
            },
        });
    });

    test("should be able to get correct result from transformPayloadPartyInfoRequestedPut", async()=>{
        // Arrange
        const payload: PartyInfoRequestedEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            partyId: "123456789",
            partyType: "MSISDN",
            partySubType: null,
            currency: null
        };

        // Act
        const result = transformPayloadPartyInfoRequestedPut(payload);

        // Assert
        expect(result).toEqual({
            "party": {
                    "partyIdInfo": {
                    "fspId": "test-fspiop-source",
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789"
                },
            },
        });
    });

    test("should be able to get correct result from transformPayloadPartyInfoReceivedPut", async()=>{
        // Arrange
        const payload: PartyQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: "test-fspiop-destination",
            ownerFspId: "test-fspiop-owner",
            partyId: "123456789",
            partyType: "MSISDN",
            merchantClassificationCode: "18",
            name: "test-party-name",
            firstName: "test-first-name",
            middleName: "test-middle-name",
            lastName: "test-last-name",
            partyDoB: new Date(),
            partySubType: null,
            currency: null
        };

        // Act
        const result = transformPayloadPartyInfoReceivedPut(payload);

        // Assert
        expect(result).toEqual({
            "party": {
                "name": "test-party-name",
                "merchantClassificationCode": payload.merchantClassificationCode,
                "partyIdInfo": {
                    "partyIdType": "MSISDN",
                    "partyIdentifier": "123456789",
                    "fspId": "test-fspiop-owner"
                },
                "personalInfo": {
                    "complexName": {
                        "firstName": "test-first-name",
                        "middleName": "test-middle-name",
                        "lastName": "test-last-name"
                    },
                    "dateOfBirth": payload.partyDoB
                }
            }
        });
    });

    test("should be able to get correct result from transformPayloadError", async()=>{
        // Arrange
        const payload = {
            errorCode: Enums.ErrorCode.BAD_REQUEST,
            errorDescription: "test-error-description"
        };

        // Act
        const result = transformPayloadError(payload);

        // Assert
        expect(result).toEqual({
            "errorInformation": {
                "errorCode": "9882",
                "errorDescription": "test-error-description",
            },
        });
    });
    //#endregion
});

