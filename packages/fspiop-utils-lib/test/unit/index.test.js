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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var logging_bc_public_types_lib_1 = require("@mojaloop/logging-bc-public-types-lib");
var security_bc_client_lib_1 = require("@mojaloop/security-bc-client-lib");
var interop_apis_bc_shared_mocks_lib_1 = require("@mojaloop/interop-apis-bc-shared-mocks-lib");
var constants_1 = require("../../src/constants");
var src_1 = require("../../src");
var axios_1 = require("axios");
var header_builder_1 = require("../../src/headers/header_builder");
var transformer_1 = require("../../src/transformer");
var request_1 = require("../../src/request");
jest.mock("axios");
// JWS Signature
var pubKeyCont = Buffer.from(interop_apis_bc_shared_mocks_lib_1.publicKey);
var privKeyCont = Buffer.from(interop_apis_bc_shared_mocks_lib_1.privateKey);
var jwsConfig = {
    enabled: true,
    privateKey: privKeyCont,
    publicKeys: {
        "bluebank": pubKeyCont,
        "greenbank": pubKeyCont
    }
};
var logger = new logging_bc_public_types_lib_1.ConsoleLogger();
logger.setLogLevel(logging_bc_public_types_lib_1.LogLevel.FATAL);
var jwsHelper = src_1.FspiopJwsSignature.getInstance();
jwsHelper.addLogger(logger);
jwsHelper.enableJws(jwsConfig.enabled);
jwsHelper.addPublicKeys(jwsConfig.publicKeys);
jwsHelper.addPrivateKey(jwsConfig.privateKey);
var validSignature = '{"signature":"AtIc2YhY2iDHET8QKncbcaG0f4ABI_gaLim4nc0naGdpXtE9bF-f4FIRNaqbBAp3capp45GY_IMompxvkS3I6CbX8m-PjklOdUWYutDS2eg-W-w_y1XFvl9Qd0-2J7Vus4EhwfjYWuOFNq1XL33Jf67f4VAGWGPFg09QVTysE26fX21E5KKwJbSIztwVLWQ4862OmNhf6_kWqCX93PMT9pL9Hb0ZVFxV7vNlCemIaE9MlYpLep5orzFzU58TtJQf_wOrcS1aXZjlBP6KB6fC1K3P-5FWneCMIu4Kp51-tcQFho0eyrmcdUwnH_rzfh69gd8NwXhIyBOaTBXLew9_-Q","protectedHeader":"eyJhbGciOiJSUzI1NiIsIkZTUElPUC1VUkkiOiIvdHJhbnNmZXJzIiwiRlNQSU9QLUhUVFAtTWV0aG9kIjoiUE9TVCIsIkZTUElPUC1Tb3VyY2UiOiJibHVlYmFuayJ9"}';
var signWithoutValidation = function (headers, payload) {
    var token = security_bc_client_lib_1.JsonWebSignatureHelper.sign(Buffer.from(privKeyCont).toString(), {
        "alg": "RS256",
        "FSPIOP-URI": headers[constants_1.FSPIOP_HEADERS_URI],
        "FSPIOP-HTTP-Method": headers[constants_1.FSPIOP_HEADERS_HTTP_METHOD],
        "FSPIOP-Source": headers[constants_1.FSPIOP_HEADERS_SOURCE],
        "FSPIOP-Destination": headers[constants_1.FSPIOP_HEADERS_DESTINATION],
        "Date": headers[constants_1.FSPIOP_HEADERS_DATE]
    }, JSON.stringify(payload), security_bc_client_lib_1.AllowedSigningAlgorithms.RS256);
    var _a = token.split('.'), protectedHeaderBase64 = _a[0], signature = _a[2];
    var signatureObject = {
        signature: signature,
        protectedHeader: protectedHeaderBase64
    };
    return JSON.stringify(signatureObject);
};
describe("FSPIOP Utils Lib", function () {
    var urlBuilder;
    beforeEach(function () {
        urlBuilder = new request_1.URLBuilder("https://example.com");
    });
    afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            jest.resetAllMocks();
            return [2 /*return*/];
        });
    }); });
    //#region Request
    test("should be able to send a request", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    response = [
                        { test: "random response" },
                    ];
                    axios_1.default.mockResolvedValueOnce(response);
                    // Act
                    return [4 /*yield*/, src_1.Request.sendRequest({
                            url: "testurl",
                            headers: (_a = {},
                                _a[constants_1.FSPIOP_HEADERS_CONTENT_TYPE] = "1",
                                _a[constants_1.FSPIOP_HEADERS_SOURCE] = "1",
                                _a[constants_1.FSPIOP_HEADERS_DESTINATION] = "1",
                                _a[constants_1.FSPIOP_HEADERS_ACCEPT] = "1",
                                _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "1",
                                _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
                                _a[constants_1.FSPIOP_HEADERS_DATE] = "1",
                                _a[constants_1.FSPIOP_HEADERS_URI] = "1",
                                _a[constants_1.FSPIOP_HEADERS_SWITCH] = "1",
                                _a),
                            source: "1",
                            destination: "2",
                            method: src_1.Enums.FspiopRequestMethodsEnum.PUT,
                            payload: {
                                fspId: "1",
                            },
                        })];
                case 1:
                    // Act
                    _b.sent();
                    // Assert
                    expect(axios_1.default).toHaveBeenCalledWith({
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
                            "alg": security_bc_client_lib_1.AllowedSigningAlgorithms.RS256
                        },
                        "method": "PUT",
                        "responseType": "json",
                        "url": "testurl",
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    //#endregion
    //#region Header builder
    test("should successfully build a valid header structure", function () { return __awaiter(void 0, void 0, void 0, function () {
        var headers, config, builder, result;
        return __generator(this, function (_a) {
            headers = {
                "accept": "application/vnd.interoperability.parties+json;version=1.0",
                "content-type": "application/vnd.interoperability.parties+json;version=1.0",
                "fspiop-source": "test-fspiop-source",
                "content-length": 0,
                "date": "Mon, 01 Jan 2001 00:00:00 GMT",
                "fspiop-destination": "test-fspiop-destination",
                "fspiop-encryption": "test-fspiop-encryption",
                "fspiop-http-method": src_1.Enums.FspiopRequestMethodsEnum.PUT,
                "fspiop-signature": "test-fspiop-signature",
                "fspiop-uri": "test-fspiop-uri",
                "x-forwarded-for": "test-fspiop-x-forwarded-for"
            };
            config = {
                httpMethod: "PUT",
                sourceFsp: "source",
                destinationFsp: "destination",
                protocolVersions: {
                    content: constants_1.FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
                    accept: constants_1.FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION
                },
                headers: headers
            };
            builder = new header_builder_1.default();
            builder.setAccept(headers[constants_1.FSPIOP_HEADERS_ACCEPT]);
            builder.setContentType(headers[constants_1.FSPIOP_HEADERS_CONTENT_TYPE]);
            builder.setDate(headers[constants_1.FSPIOP_HEADERS_DATE]);
            builder.setFspiopSource(headers[constants_1.FSPIOP_HEADERS_SOURCE]);
            builder.setContentLength(headers[constants_1.FSPIOP_HEADERS_CONTENT_LENGTH]);
            builder.setXForwardedFor(headers[constants_1.FSPIOP_HEADERS_X_FORWARDED_FOR]);
            builder.setFspiopDestination(headers[constants_1.FSPIOP_HEADERS_DESTINATION]);
            builder.setFspiopEncryption(headers[constants_1.FSPIOP_HEADERS_ENCRYPTION]);
            builder.setFspiopSignature(headers[constants_1.FSPIOP_HEADERS_SIGNATURE]);
            builder.setFspiopUri(headers[constants_1.FSPIOP_HEADERS_URI]);
            builder.setFspiopHttpMethod(headers[constants_1.FSPIOP_HEADERS_HTTP_METHOD], config);
            result = builder.getResult().build();
            // Assert
            expect(result).toMatchObject({
                "fspiop-source": "test-fspiop-source",
                "content-length": 0,
                "date": "Mon, 01 Jan 2001 00:00:00 GMT",
                "fspiop-destination": "test-fspiop-destination",
                "fspiop-encryption": "test-fspiop-encryption",
                "fspiop-http-method": src_1.Enums.FspiopRequestMethodsEnum.PUT,
                "fspiop-signature": "test-fspiop-signature",
                "fspiop-uri": "test-fspiop-uri",
                "x-forwarded-for": "test-fspiop-x-forwarded-for"
            });
            return [2 /*return*/];
        });
    }); });
    test("should default http method to null if null is passed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var config, builder, result;
        return __generator(this, function (_a) {
            config = {
                httpMethod: "PUT",
                sourceFsp: "source",
                destinationFsp: "destination",
                protocolVersions: {
                    content: constants_1.FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
                    accept: constants_1.FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION
                },
                headers: {}
            };
            builder = new header_builder_1.default();
            builder.setFspiopHttpMethod(null, config);
            result = builder.getResult().build();
            // Assert
            expect(result).toMatchObject(expect.objectContaining({
                "fspiop-http-method": undefined,
            }));
            return [2 /*return*/];
        });
    }); });
    test("should formate date to UTC string if date header is instance of date", function () { return __awaiter(void 0, void 0, void 0, function () {
        var headerDate, builder, result;
        return __generator(this, function (_a) {
            headerDate = new Date();
            builder = new header_builder_1.default();
            builder.setDate(headerDate);
            result = builder.getResult().build();
            // Assert
            expect(result).toMatchObject(expect.objectContaining({
                "date": headerDate.toUTCString(),
            }));
            return [2 /*return*/];
        });
    }); });
    test("should default to sent header date value if unable to convert invalid date", function () { return __awaiter(void 0, void 0, void 0, function () {
        var headerDate, builder, result;
        return __generator(this, function (_a) {
            headerDate = "invalid-date";
            builder = new header_builder_1.default();
            builder.setDate(headerDate);
            result = builder.getResult().build();
            // Assert
            expect(result).toMatchObject(expect.objectContaining({
                "date": "invalid-date",
            }));
            return [2 /*return*/];
        });
    }); });
    //#endregion
    //#region Transformer
    test("should be able to remove empty properties from an object", function () { return __awaiter(void 0, void 0, void 0, function () {
        var sampleObject, result;
        return __generator(this, function (_a) {
            sampleObject = {
                "name": "random",
                "age": null,
                "surname": "",
                "address": {
                    "street": "test",
                    "city": null,
                    "country": ""
                }
            };
            result = (0, transformer_1.removeEmpty)(sampleObject);
            // Assert
            expect(result).toEqual({
                "address": {
                    "street": "test",
                },
                "name": "random",
            });
            return [2 /*return*/];
        });
    }); });
    test("should be able to get correct result from transformPayloadParticipantPut", function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, result;
        return __generator(this, function (_a) {
            payload = {
                requesterFspId: "non-existing-requester-id",
                ownerFspId: "test-fspiop-source",
                partyId: "123456789",
                partyType: "MSISDN",
                partySubType: null,
                currency: null
            };
            result = (0, transformer_1.transformPayloadParticipantPut)(payload);
            // Assert
            expect(result).toEqual({
                "fspId": "test-fspiop-source",
            });
            return [2 /*return*/];
        });
    }); });
    test("should be able to get correct result from transformPayloadPartyAssociationPut", function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, result;
        return __generator(this, function (_a) {
            payload = {
                ownerFspId: "test-fspiop-source",
                partyId: "123456789",
                partyType: "MSISDN",
                partySubType: null
            };
            result = (0, transformer_1.transformPayloadPartyAssociationPut)(payload);
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
            return [2 /*return*/];
        });
    }); });
    test("should be able to get correct result from transformPayloadPartyDisassociationPut", function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, result;
        return __generator(this, function (_a) {
            payload = {
                ownerFspId: "test-fspiop-source",
                partyId: "123456789",
                partyType: "MSISDN",
                partySubType: null
            };
            result = (0, transformer_1.transformPayloadPartyDisassociationPut)(payload);
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
            return [2 /*return*/];
        });
    }); });
    test("should be able to get correct result from transformPayloadPartyInfoRequestedPut", function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, result;
        return __generator(this, function (_a) {
            payload = {
                requesterFspId: "test-fspiop-source",
                destinationFspId: "test-fspiop-destination",
                partyId: "123456789",
                partyType: "MSISDN",
                partySubType: null,
                currency: null
            };
            result = (0, transformer_1.transformPayloadPartyInfoRequestedPut)(payload);
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
            return [2 /*return*/];
        });
    }); });
    test("should be able to get correct result from transformPayloadPartyInfoReceivedPut", function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, result;
        return __generator(this, function (_a) {
            payload = {
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
                extensionList: null,
                supportedCurrencies: null,
                kycInfo: null,
            };
            result = (0, transformer_1.transformPayloadPartyInfoReceivedPut)(payload);
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
            return [2 /*return*/];
        });
    }); });
    test("should be able to get correct result from transformPayloadError", function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, result;
        return __generator(this, function (_a) {
            payload = {
                errorCode: src_1.Enums.ErrorCode.BAD_REQUEST,
                errorDescription: "test-error-description"
            };
            result = (0, transformer_1.transformPayloadError)(payload);
            // Assert
            expect(result).toEqual({
                "errorInformation": {
                    "errorCode": "9882",
                    "errorDescription": "test-error-description",
                },
            });
            return [2 /*return*/];
        });
    }); });
    // #endregion
    // #region URLBuilder
    it("should append query parameters", function () {
        // Arrange & Act
        urlBuilder.appendQueryParam("param1", "value1");
        urlBuilder.appendQueryParam("param2", "value2");
        // Assert
        expect(urlBuilder.getParams().toString()).toEqual("param1=value1&param2=value2");
    });
    it("should clear query parameters", function () {
        // Arrange & Act
        urlBuilder.appendQueryParam("param1", "value1");
        urlBuilder.clearQueryParams();
        // Assert
        expect(urlBuilder.getParams().toString()).toEqual("");
    });
    it("should delete a query parameter", function () {
        // Arrange & Act
        urlBuilder.appendQueryParam("param1", "value1");
        urlBuilder.deleteQueryParam("param1");
        // Assert
        expect(urlBuilder.getParams().toString()).toEqual("");
    });
    it("should set the path", function () {
        // Arrange & Act
        urlBuilder.setPath("/newpath");
        // Assert
        expect(urlBuilder.getPath()).toEqual("/newpath");
    });
    it("should build url without any adicional parameters", function () {
        // Arrange & Act
        var result = urlBuilder.build();
        // Assert
        expect(result).toEqual("https://example.com");
    });
    it("should build url with specified parameters parameters", function () {
        // Arrange & Act
        var result = urlBuilder.build();
        // Assert
        expect(result).toEqual("https://example.com");
    });
    it("should get different set", function () {
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
    it("should build url with specified parameters", function () {
        // Arrange & Act
        urlBuilder.setEntity("randomentity");
        urlBuilder.setLocation(["newlocation1", "newlocation2"]);
        urlBuilder.setId("randomid");
        urlBuilder.hasError();
        var result = urlBuilder.build();
        // Assert
        expect(result).toEqual("https://example.com/randomentity/newlocation1/newlocation2/randomid/error");
    });
    //#endregion
    //#region JWS validate
    it("should throw InvalidFSPIOPPayloadError when validating a JWS signature without payload", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, null); }).toThrow(src_1.InvalidFSPIOPPayloadError);
    });
    it("should throw InvalidFSPIOPHttpSourceHeaderError when validating a JWS signature without fspiop source header", function () {
        // Arrange
        var headers = {};
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.InvalidFSPIOPHttpSourceHeaderError);
    });
    it("should throw PublicKeyNotAvailableForDFSPError when validating a JWS signature without a pubkey for the fspiop source header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "nonexistingdfsp",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.PublicKeyNotAvailableForDFSPError);
    });
    it("should throw MissingRequiredJWSFSPIOPHeaders when validating a JWS signature without URI header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingRequiredJWSFSPIOPHeaders);
    });
    it("should throw MissingRequiredJWSFSPIOPHeaders when validating a JWS signature without http-method header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingRequiredJWSFSPIOPHeaders);
    });
    it("should throw MissingRequiredJWSFSPIOPHeaders when validating a JWS signature without signature header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingRequiredJWSFSPIOPHeaders);
    });
    it("should throw unable to verify token error when validating a JWS signature due to invalid signature token", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "{}",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow("Unable to verify token - invalid token");
    });
    it("should throw MissingFSPIOPURIHeaderInDecodedHeader when validating a JWS with a signature with missing URI decoded header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = {};
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPURIHeaderInDecodedHeader);
    });
    it("should throw MissingFSPIOPURIHeaderInDecodedHeader when validating a JWS with a signature with missing URI decoded header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = {};
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPURIHeaderInDecodedHeader);
    });
    it("should throw NonMatchingFSPIOPURIJWSHeader when validating a JWS with a signature with non matching URI protected header", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_URI] = "/quotes",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.NonMatchingFSPIOPURIJWSHeader);
    });
    it("should throw MissingFSPIOPHttpMethodHeaderInDecodedHeader when validating a JWS with a signature with missing http method protected header", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPHttpMethodHeaderInDecodedHeader);
    });
    it("should throw NonMatchingFSPIOPHttpMethodJWSHeader when validating a JWS with a signature with non matching http method protected header", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "PUT",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.NonMatchingFSPIOPHttpMethodJWSHeader);
    });
    it("should throw MissingFSPIOPSourceHeaderInProtectedHeader when validating a JWS with a signature with missing fspiop source protected header", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPSourceHeaderInDecodedHeader);
    });
    it("should throw NonMatchingFSPIOPSourceJWSHeader when validating a JWS with a signature with non matching fspiop source protected header", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_SOURCE] = "randomsource",
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.NonMatchingFSPIOPSourceJWSHeader);
    });
    it("should throw MissingFSPIOPDateHeaderInProtectedHeader when validating a JWS with a signature with missing protected date", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b[constants_1.FSPIOP_HEADERS_DATE] = "Tue, 23 May 2017 21:12:31 GMT",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPDateHeaderInProtectedHeader);
    });
    it("should throw NonMatchingFSPIOPDateJWSHeader when validating a JWS with a signature with non matching fspiop source protected date", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a[constants_1.FSPIOP_HEADERS_DATE] = "Wed, 23 May 2017 21:12:31 GMT",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b[constants_1.FSPIOP_HEADERS_DATE] = "Tue, 23 May 2017 21:12:31 GMT",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.NonMatchingFSPIOPDateJWSHeader);
    });
    it("should throw MissingFSPIOPDestinationInProtectedHeader when validating a JWS with a signature with missing fspiop destination protected header", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_DESTINATION] = "greenbank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPDestinationInProtectedHeader);
    });
    it("should throw MissingFSPIOPDestinationHeader when validating a JWS with a signature with missing fspiop destination in request headers", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _b[constants_1.FSPIOP_HEADERS_DESTINATION] = "greenbank",
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.MissingFSPIOPDestinationHeader);
    });
    it("should throw NonMatchingFSPIOPDestinationJWSHeader when validating a JWS with a signature with non matching fspiop destination", function () {
        var _a, _b;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_DESTINATION] = "greenbank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        var missingHeaders = (_b = {},
            _b[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _b[constants_1.FSPIOP_HEADERS_DESTINATION] = "randomdestination",
            _b[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _b[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _b);
        headers[constants_1.FSPIOP_HEADERS_SIGNATURE] = signWithoutValidation(missingHeaders, payload);
        // Act & Assert
        expect(function () { return jwsHelper.validate(headers, payload); }).toThrow(src_1.NonMatchingFSPIOPDestinationJWSHeader);
    });
    //#endregion
    //#region JWS sign
    it("should throw InvalidFSPIOPPayloadError when signing without payload", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a);
        // Act & Assert
        expect(function () { return jwsHelper.sign(headers, null); }).toThrow(src_1.InvalidFSPIOPPayloadError);
    });
    it("should throw InvalidFSPIOPURIHeaderError when signing without URI header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.sign(headers, payload); }).toThrow(src_1.InvalidFSPIOPURIHeaderError);
    });
    it("should throw MissingFSPIOPHttpMethodHeader when signing with missing http method protected header", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_SIGNATURE] = "1",
            _a);
        var payload = {};
        // Act & Assert
        expect(function () { return jwsHelper.sign(headers, payload); }).toThrow(src_1.MissingFSPIOPHttpMethodHeader);
    });
    it("should successfully return a signature", function () {
        var _a;
        // Arrange
        var headers = (_a = {},
            _a[constants_1.FSPIOP_HEADERS_SOURCE] = "bluebank",
            _a[constants_1.FSPIOP_HEADERS_URI] = "/transfers",
            _a[constants_1.FSPIOP_HEADERS_HTTP_METHOD] = "POST",
            _a);
        var payload = {};
        // Act
        var result = jwsHelper.sign(headers, payload);
        // Assert
        expect(result).toEqual(validSignature);
    });
    //#endregion
});
