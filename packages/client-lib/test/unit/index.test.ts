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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

 "use strict";
 
import Crypto from "crypto";
import base64url from "base64url";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ITransfer } from "@mojaloop/transfers-bc-public-types-lib";
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
        const fspiopOpaqueState = { fulfilment: "FRzzxm0H2F_aIclc7pH4o18Ov-Cb4vSwOj67O-Zos_0" };
        const transfer = { condition: "HAgz1za3d1ExOAIHuiuqOV7pJD_dEOX00kslIr0ERYY" } as ITransfer;

        // Act
        const result = validationClient.validateFulfilmentOpaqueState(fspiopOpaqueState, transfer);

        // Assert
        expect(result).toBe(true);
    });

    it("should return true when fspiopOpaqueState is null", () => {
        // Arrange
        const fspiopOpaqueState = null;
        const transfer = { condition: "dummyCondition" } as ITransfer;

        // Act
        const result = validationClient.validateFulfilmentOpaqueState(fspiopOpaqueState, transfer);

        // Assert
        expect(result).toBe(true);
    });

    it("should throw invalid length error", () => {
        // Arrange
        const fspiopOpaqueState = { fulfilment: "invalidBase64String" };
        const transfer = { condition: "dummyCondition" } as ITransfer;

        // Act & Assert
        expect(() => validationClient.validateFulfilmentOpaqueState(fspiopOpaqueState, transfer)).toThrow("Interledger preimages must be exactly 32 bytes");
    });

    it("should throw UnableToValidateFulfilment error when an unknown error occurs", () => {
        // Arrange
        const fspiopOpaqueState = { fulfilment: "FRzzxm0H2F_aIclc7pH4o18Ov-Cb4vSwOj67O-Zos_0" };
        const transfer = { condition: "HAgz1za3d1ExOAIHuiuqOV7pJD_dEOX00kslIr0ERYY" } as ITransfer;

        const mockHash = {
            update: jest.fn().mockImplementation(() => {
                throw new UnableToValidateFulfilment("Update failed");
            }),
            digest: jest.fn()
        };

        jest.spyOn(Crypto, "createHash").mockReturnValue(mockHash as any);
        
        // Act & Assert
        expect(() => validationClient.validateFulfilmentOpaqueState(fspiopOpaqueState, transfer)).toThrow(UnableToValidateFulfilment);
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