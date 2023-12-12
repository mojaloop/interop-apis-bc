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

import {ConsoleLogger, ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import { JsonWebSignatureHelper, AllowedSigningAlgorithms } from "@mojaloop/security-bc-client-lib";
import { publicKey, privateKey } from "@mojaloop/interop-apis-bc-shared-mocks-lib";
import {
    FSPIOP_HEADERS_ACCEPT,
    FSPIOP_HEADERS_CONTENT_LENGTH,
    FSPIOP_HEADERS_CONTENT_TYPE,
    FSPIOP_HEADERS_DATE,
    FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
    FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION,
    FSPIOP_HEADERS_DESTINATION,
    FSPIOP_HEADERS_ENCRYPTION,
    FSPIOP_HEADERS_HTTP_METHOD,
    FSPIOP_HEADERS_SIGNATURE,
    FSPIOP_HEADERS_SOURCE,
    FSPIOP_HEADERS_SWITCH,
    FSPIOP_HEADERS_URI,
    FSPIOP_HEADERS_X_FORWARDED_FOR
} from "../../src/constants";
import { Enums,
    FspiopJwsSignature,
    InvalidFSPIOPHttpSourceHeaderError,
    InvalidFSPIOPPayloadError,
    InvalidFSPIOPURIHeaderError,
    MissingFSPIOPDateHeaderInProtectedHeader,
    MissingFSPIOPDestinationHeader,
    MissingFSPIOPDestinationInProtectedHeader,
    MissingFSPIOPHttpMethodHeader,
    MissingFSPIOPHttpMethodHeaderInDecodedHeader,
    MissingFSPIOPSourceHeaderInDecodedHeader,
    MissingFSPIOPURIHeaderInDecodedHeader,
    MissingFSPIOPURIHeaderInProtectedHeader,
    MissingRequiredJWSFSPIOPHeaders,
    NonMatchingFSPIOPDateJWSHeader,
    NonMatchingFSPIOPDestinationJWSHeader,
    NonMatchingFSPIOPHttpMethodJWSHeader,
    NonMatchingFSPIOPSourceJWSHeader,
    NonMatchingFSPIOPURIJWSHeader,
    PublicKeyNotAvailableForDFSPError,
    Request
} from "../../src";
import axios from "axios";
import HeaderBuilder from "../../src/headers/header_builder";
import { 
    removeEmpty,
    transformPayloadError,
    transformPayloadParticipantPut,
    transformPayloadPartyAssociationPut,
    transformPayloadPartyDisassociationPut,
    transformPayloadPartyInfoReceivedPut,
    transformPayloadPartyInfoRequestedPut
} from "../../src/transformer";
import { 
    ParticipantAssociationCreatedEvtPayload, 
    ParticipantAssociationRemovedEvtPayload,
    ParticipantQueryResponseEvtPayload,
    PartyInfoRequestedEvtPayload,
    PartyQueryResponseEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { URLBuilder } from "../../src/request";

jest.mock("axios");

// JWS Signature
const pubKeyCont = Buffer.from(publicKey)
const privKeyCont = Buffer.from(privateKey)

const jwsConfig = {
    enabled: true,
    privateKey: privKeyCont,
    publicKeys: {
        "bluebank": pubKeyCont,
        "greenbank": pubKeyCont
    }
}

const logger: ILogger = new ConsoleLogger();
logger.setLogLevel(LogLevel.FATAL);

const jwsHelper = FspiopJwsSignature.getInstance();
jwsHelper.addLogger(logger);
jwsHelper.enableJws(jwsConfig.enabled);
jwsHelper.addPublicKeys(jwsConfig.publicKeys);
jwsHelper.addPrivateKey(jwsConfig.privateKey);

const validSignature = '{"signature":"AtIc2YhY2iDHET8QKncbcaG0f4ABI_gaLim4nc0naGdpXtE9bF-f4FIRNaqbBAp3capp45GY_IMompxvkS3I6CbX8m-PjklOdUWYutDS2eg-W-w_y1XFvl9Qd0-2J7Vus4EhwfjYWuOFNq1XL33Jf67f4VAGWGPFg09QVTysE26fX21E5KKwJbSIztwVLWQ4862OmNhf6_kWqCX93PMT9pL9Hb0ZVFxV7vNlCemIaE9MlYpLep5orzFzU58TtJQf_wOrcS1aXZjlBP6KB6fC1K3P-5FWneCMIu4Kp51-tcQFho0eyrmcdUwnH_rzfh69gd8NwXhIyBOaTBXLew9_-Q","protectedHeader":"eyJhbGciOiJSUzI1NiIsIkZTUElPUC1VUkkiOiIvdHJhbnNmZXJzIiwiRlNQSU9QLUhUVFAtTWV0aG9kIjoiUE9TVCIsIkZTUElPUC1Tb3VyY2UiOiJibHVlYmFuayJ9"}'

const signWithoutValidation = (headers:any, payload:any) => {
    const token = JsonWebSignatureHelper.sign(Buffer.from(privKeyCont).toString(), 
        {
            "alg": "RS256",
            "FSPIOP-URI": headers[FSPIOP_HEADERS_URI],
            "FSPIOP-HTTP-Method": headers[FSPIOP_HEADERS_HTTP_METHOD],
            "FSPIOP-Source": headers[FSPIOP_HEADERS_SOURCE],
            "FSPIOP-Destination": headers[FSPIOP_HEADERS_DESTINATION],
            "Date": headers[FSPIOP_HEADERS_DATE]
        },
        JSON.stringify(payload), 
        AllowedSigningAlgorithms.RS256
    );
    const [ protectedHeaderBase64, , signature ] = token.split('.');

    const signatureObject = {
        signature: signature,
        protectedHeader: protectedHeaderBase64
    };

    return JSON.stringify(signatureObject)
}

describe("FSPIOP Utils Lib", () => {
    let urlBuilder: URLBuilder;

    beforeEach(() => {
      urlBuilder = new URLBuilder("https://example.com");
    });

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
                "alg": AllowedSigningAlgorithms.RS256
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
            currency: null,
            extensionList: null
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
    // #endregion

    // #region URLBuilder
    it("should append query parameters", () => {
        // Arrange & Act
        urlBuilder.appendQueryParam("param1", "value1");
        urlBuilder.appendQueryParam("param2", "value2");

        // Assert
        expect(urlBuilder.getParams().toString()).toEqual("param1=value1&param2=value2");
    });

    it("should clear query parameters", () => {
        // Arrange & Act
        urlBuilder.appendQueryParam("param1", "value1");
        urlBuilder.clearQueryParams();

        // Assert
        expect(urlBuilder.getParams().toString()).toEqual("");
    });

    it("should delete a query parameter", () => {
        // Arrange & Act
        urlBuilder.appendQueryParam("param1", "value1");
        urlBuilder.deleteQueryParam("param1");

        // Assert
        expect(urlBuilder.getParams().toString()).toEqual("");
    });

    it("should set the path", () => {
        // Arrange & Act
        urlBuilder.setPath("/newpath");

        // Assert
        expect(urlBuilder.getPath()).toEqual("/newpath");
    });

    it("should build url without any adicional parameters", () => {
        // Arrange & Act
        const result = urlBuilder.build();

        // Assert
        expect(result).toEqual("https://example.com");
    });

    it("should build url with specified parameters parameters", () => {
        // Arrange & Act
        const result = urlBuilder.build();

        // Assert
        expect(result).toEqual("https://example.com");
    });

    it("should get different set", () => {
        // Arrange & Act
        urlBuilder.setEntity("randomentity");
        urlBuilder.setLocation(["newlocation1", "newlocation2"]);
        urlBuilder.setId("randomid");
        urlBuilder.setQueryParam("randomparam", "123");
        urlBuilder.setQueryString("randomquerystring");
        urlBuilder.hasError();

        // Assert
        expect(urlBuilder.getBase().toString()).toEqual("https://example.com/");
        expect(urlBuilder.getPath()).toEqual("/");
        expect(urlBuilder.getHostname()).toEqual("example.com");
        expect(urlBuilder.getParams().toString()).toEqual("randomquerystring=");
        expect(urlBuilder.getQueryString().toString()).toEqual("randomquerystring=");
        expect(urlBuilder.getQueryParam("randomquerystring=")).toEqual(undefined);
    });
    
    it("should build url with specified parameters", () => {
        // Arrange & Act
        urlBuilder.setEntity("randomentity");
        urlBuilder.setLocation(["newlocation1", "newlocation2"]);
        urlBuilder.setId("randomid");
        urlBuilder.hasError();

        const result = urlBuilder.build();

        // Assert
        expect(result).toEqual("https://example.com/randomentity/newlocation1/newlocation2/randomid/error");
    });
    //#endregion

    //#region JWS validate
    it("should throw InvalidFSPIOPPayloadError when validating a JWS signature without payload", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
        }

        // Act & Assert
        expect(() => jwsHelper.validate(headers, null)).toThrow(InvalidFSPIOPPayloadError);
    });

    it("should throw InvalidFSPIOPHttpSourceHeaderError when validating a JWS signature without fspiop source header", () => {
        // Arrange
        const headers = {}

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(InvalidFSPIOPHttpSourceHeaderError);
    });

    it("should throw PublicKeyNotAvailableForDFSPError when validating a JWS signature without a pubkey for the fspiop source header", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "nonexistingdfsp"
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(PublicKeyNotAvailableForDFSPError);
    });
    
    it("should throw MissingRequiredJWSFSPIOPHeaders when validating a JWS signature without URI header", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingRequiredJWSFSPIOPHeaders);
    });

    it("should throw MissingRequiredJWSFSPIOPHeaders when validating a JWS signature without http-method header", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers"
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingRequiredJWSFSPIOPHeaders);
    });

    it("should throw MissingRequiredJWSFSPIOPHeaders when validating a JWS signature without signature header", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingRequiredJWSFSPIOPHeaders);
    });
    
    it("should throw unable to verify token error when validating a JWS signature due to invalid signature token", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "{}"
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow("Unable to verify token - invalid token");
    });

    it("should throw MissingFSPIOPURIHeaderInDecodedHeader when validating a JWS with a signature with missing URI decoded header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {}

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPURIHeaderInDecodedHeader);
    });
    
    it("should throw MissingFSPIOPURIHeaderInDecodedHeader when validating a JWS with a signature with missing URI decoded header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {}

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPURIHeaderInDecodedHeader);
    });

    it("should throw NonMatchingFSPIOPURIJWSHeader when validating a JWS with a signature with non matching URI protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_URI]: "/quotes"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(NonMatchingFSPIOPURIJWSHeader);
    });

    it("should throw MissingFSPIOPHttpMethodHeaderInDecodedHeader when validating a JWS with a signature with missing http method protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_URI]: "/transfers"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPHttpMethodHeaderInDecodedHeader);
    });
    
    it("should throw NonMatchingFSPIOPHttpMethodJWSHeader when validating a JWS with a signature with non matching http method protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "PUT"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(NonMatchingFSPIOPHttpMethodJWSHeader);
    });
    
    it("should throw MissingFSPIOPSourceHeaderInProtectedHeader when validating a JWS with a signature with missing fspiop source protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPSourceHeaderInDecodedHeader);
    });

    it("should throw NonMatchingFSPIOPSourceJWSHeader when validating a JWS with a signature with non matching fspiop source protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_SOURCE]: "randomsource",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(NonMatchingFSPIOPSourceJWSHeader);
    });
    
    it("should throw MissingFSPIOPDateHeaderInProtectedHeader when validating a JWS with a signature with missing protected date", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_DATE]: "Tue, 23 May 2017 21:12:31 GMT"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPDateHeaderInProtectedHeader);
    });
        
    it("should throw NonMatchingFSPIOPDateJWSHeader when validating a JWS with a signature with non matching fspiop source protected date", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1",
            [FSPIOP_HEADERS_DATE]: "Wed, 23 May 2017 21:12:31 GMT"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_DATE]: "Tue, 23 May 2017 21:12:31 GMT"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(NonMatchingFSPIOPDateJWSHeader);
    });

    it("should throw MissingFSPIOPDestinationInProtectedHeader when validating a JWS with a signature with missing fspiop destination protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_DESTINATION]: "greenbank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPDestinationInProtectedHeader);
    });

    it("should throw MissingFSPIOPDestinationHeader when validating a JWS with a signature with missing fspiop destination in request headers", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_DESTINATION]: "greenbank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(MissingFSPIOPDestinationHeader);
    });
    
    it("should throw NonMatchingFSPIOPDestinationJWSHeader when validating a JWS with a signature with non matching fspiop destination", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_DESTINATION]: "greenbank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}
        
        const missingHeaders = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_DESTINATION]: "randomdestination",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        headers[FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);

        // Act & Assert
        expect(() => jwsHelper.validate(headers, payload)).toThrow(NonMatchingFSPIOPDestinationJWSHeader);
    });
    //#endregion

    //#region JWS sign
    it("should throw InvalidFSPIOPPayloadError when signing without payload", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
        }

        // Act & Assert
        expect(() => jwsHelper.sign(headers, null)).toThrow(InvalidFSPIOPPayloadError);
    });

    it("should throw InvalidFSPIOPURIHeaderError when signing without URI header", () => {
        // Arrange
        const headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.sign(headers, payload)).toThrow(InvalidFSPIOPURIHeaderError);
    });

    it("should throw MissingFSPIOPHttpMethodHeader when signing with missing http method protected header", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_SIGNATURE]: "1"
        }

        const payload = {}

        // Act & Assert
        expect(() => jwsHelper.sign(headers, payload)).toThrow(MissingFSPIOPHttpMethodHeader);
    });

    
    it("should successfully return a signature", () => {
        // Arrange
        let headers = {
            [FSPIOP_HEADERS_SOURCE]: "bluebank",
            [FSPIOP_HEADERS_URI]: "/transfers",
            [FSPIOP_HEADERS_HTTP_METHOD]: "POST"
        }

        const payload = {}

        // Act
        const result = jwsHelper.sign(headers, payload);

        // Assert
        expect(result).toEqual(validSignature);
    });
    //#endregion

});

