/*****
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
*****/

"use strict";

import Crypto from "crypto";
import base64url from "base64url";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { InteropValidationClient, UnableToValidateFulfilment } from "../../src/index";
import { fulfilmentToCondition } from "../../src/utils";

const mockLogger: ILogger = new ConsoleLogger();
let validationClient: InteropValidationClient;

describe("Unit tests - Interop Validation Client lib", () => {
    beforeEach(() => {
        validationClient = new InteropValidationClient(mockLogger);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should validate fulfilment correctly", () => {
        // Arrange
        const inboundProtocolOpaqueState = { fulfilment: "FRzzxm0H2F_aIclc7pH4o18Ov-Cb4vSwOj67O-Zos_0" };
        const transferInboundProtocol = { fspiopOpaqueState: { condition: "HAgz1za3d1ExOAIHuiuqOV7pJD_dEOX00kslIr0ERYY" } };

        // Act
        const result = validationClient.validateFulfilmentOpaqueState(inboundProtocolOpaqueState, transferInboundProtocol);

        // Assert
        expect(result).toBe(true);
    });

    it("should return true when fspiopOpaqueState is null", () => {
        // Arrange
        const inboundProtocolOpaqueState = null;
        const transferInboundProtocol = { fspiopOpaqueState: { condition: "dummyCondition" } };

        // Act
        const result = validationClient.validateFulfilmentOpaqueState(inboundProtocolOpaqueState, transferInboundProtocol);

        // Assert
        expect(result).toBe(true);
    });

    it("should throw invalid length error", () => {
        // Arrange
        const inboundProtocolOpaqueState = { fspiopOpaqueState: { fulfilment: "invalidBase64String" } };
        const transferInboundProtocol = { fspiopOpaqueState: { condition: "dummyCondition" } };

        // Act & Assert
        expect(() => validationClient.validateFulfilmentOpaqueState(inboundProtocolOpaqueState, transferInboundProtocol)).toThrow("Interledger preimages must be exactly 32 bytes");
    });

    it("should throw UnableToValidateFulfilment error when an unknown error occurs", () => {
        // Arrange
        const inboundProtocolOpaqueState = { fspiopOpaqueState: { fulfilment: "FRzzxm0H2F_aIclc7pH4o18Ov-Cb4vSwOj67O-Zos_0" } };
        const transferInboundProtocol = { fspiopOpaqueState: { condition: "HAgz1za3d1ExOAIHuiuqOV7pJD_dEOX00kslIr0ERYY" } };

        const mockHash = {
            update: jest.fn().mockImplementation(() => {
                throw new UnableToValidateFulfilment("Update failed");
            }),
            digest: jest.fn()
        };

        jest.spyOn(Crypto, "createHash").mockReturnValue(mockHash as any);

        // Act & Assert
        expect(() => validationClient.validateFulfilmentOpaqueState(inboundProtocolOpaqueState, transferInboundProtocol)).toThrow(UnableToValidateFulfilment);
    });

    it("should throw error if fulfilment length is not 32 bytes", () => {
        // Arrange
        const fulfilment = "shortString";

        // Act & Assert
        expect(() => fulfilmentToCondition(fulfilment)).toThrow("Interledger preimages must be exactly 32 bytes");
    });

    it("should calculate condition from fulfilment correctly", () => {
        // Arrange
        const fulfilment = base64url.encode(Crypto.randomBytes(32));

        // Act
        const condition = fulfilmentToCondition(fulfilment);

        // Assert
        expect(condition).toBeDefined();
        expect(condition).toHaveLength(43);
    });
});
