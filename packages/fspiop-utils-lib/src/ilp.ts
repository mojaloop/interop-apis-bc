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

import { deserializeIlpPacket } from "ilp-packet";
import { DecodedIlpPacket, DecodedIlpPacketTransfer, EncodedIlpPacketTransfer } from "./ilp_types";

export const decodeIlpPacket = (base64IlpPacket: string): DecodedIlpPacketTransfer => {
    try {
        const ilpPacketBuffer = Buffer.from(base64IlpPacket, "base64");
        const decodedIlpPacket = deserializeIlpPacket(ilpPacketBuffer) as unknown as any;

        if (!decodedIlpPacket.data) {
            throw new Error("Invalid ILP Packet: Missing data fields.");
        }

        if (!decodedIlpPacket.data.data) {
            throw new Error("Invalid ILP Packet: Missing buffer data.");
        }

        const ilpPacketStructure = decodedIlpPacket.data;
        const bufferContent = ilpPacketStructure.data;
        const decodedDataJsonString = Buffer.from(bufferContent.toString("utf8"), "base64").toString("utf8");
        return JSON.parse(decodedDataJsonString);
    } catch (error: unknown) {
        console.error("Unable to decode ILP Packet", (error as Error).message);
        throw new Error(`ILP Packet decoding failed: ${(error as Error).message}`);
    }
};

const validateEnum = (value: string, allowedValues: string[], fieldName: string, errors: string[]): void => {
    if (!allowedValues.includes(value)) {
        errors.push(`Invalid value for ${fieldName}, expected one of ${allowedValues.join(", ")}`);
    }
};

export const validateDecodedIlpPacket = (decodedIlpPacket: DecodedIlpPacket): string[] => {
    const errors: string[] = [];

    // Validate transactionId
    if (typeof decodedIlpPacket.transactionId !== "string") {
        errors.push("Invalid type for transactionId, expected string");
    }

    // Validate quoteId
    if (typeof decodedIlpPacket.quoteId !== "string") {
        errors.push("Invalid type for quoteId, expected string");
    }

    // Validate payee
    if (!decodedIlpPacket.payee || typeof decodedIlpPacket.payee !== "object") {
        errors.push("Invalid type for payee, expected object");
    } else {
        // Validate payee.partyIdInfo
        if (!decodedIlpPacket.payee.partyIdInfo || typeof decodedIlpPacket.payee.partyIdInfo !== "object") {
            errors.push("Invalid type for payee.partyIdInfo, expected object");
        } else {
            if (typeof decodedIlpPacket.payee.partyIdInfo.partyIdType !== "string") {
                errors.push("Invalid type for payee.partyIdInfo.partyIdType, expected string");
            }
            if (typeof decodedIlpPacket.payee.partyIdInfo.partyIdentifier !== "string") {
                errors.push("Invalid type for payee.partyIdInfo.partyIdentifier, expected string");
            }
            if (typeof decodedIlpPacket.payee.partyIdInfo.fspId !== "string") {
                errors.push("Invalid type for payee.partyIdInfo.fspId, expected string");
            }
        }
    }

    // Validate payer
    if (!decodedIlpPacket.payer || typeof decodedIlpPacket.payer !== "object") {
        errors.push("Invalid type for payer, expected object");
    } else {
        // Validate payer.partyIdInfo
        if (!decodedIlpPacket.payer.partyIdInfo || typeof decodedIlpPacket.payer.partyIdInfo !== "object") {
            errors.push("Invalid type for payer.partyIdInfo, expected object");
        } else {
            if (typeof decodedIlpPacket.payer.partyIdInfo.partyIdType !== "string") {
                errors.push("Invalid type for payer.partyIdInfo.partyIdType, expected string");
            }
            if (typeof decodedIlpPacket.payer.partyIdInfo.partyIdentifier !== "string") {
                errors.push("Invalid type for payer.partyIdInfo.partyIdentifier, expected string");
            }
            if (typeof decodedIlpPacket.payer.partyIdInfo.fspId !== "string") {
                errors.push("Invalid type for payer.partyIdInfo.fspId, expected string");
            }
        }
    }

    // Validate amount
    if (!decodedIlpPacket.amount || typeof decodedIlpPacket.amount !== "object") {
        errors.push("Invalid type for amount, expected object");
    } else {
        if (typeof decodedIlpPacket.amount.currency !== "string") {
            errors.push("Invalid type for amount.currency, expected string");
        }
        if (typeof decodedIlpPacket.amount.amount !== "string") {
            errors.push("Invalid type for amount.amount, expected string");
        }
    }

    // Validate transactionType
    if (!decodedIlpPacket.transactionType || typeof decodedIlpPacket.transactionType !== "object") {
        errors.push("Invalid type for transactionType, expected object");
    } else {
        const validScenarios = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYMENT", "REFUND"];
        const validInitiators = ["PAYER", "PAYEE"];
        const validInitiatorTypes = ["CONSUMER", "AGENT", "BUSINESS", "DEVICE"];

        validateEnum(decodedIlpPacket.transactionType.scenario, validScenarios, "transactionType.scenario", errors);
        validateEnum(decodedIlpPacket.transactionType.initiator, validInitiators, "transactionType.initiator", errors);
        validateEnum(decodedIlpPacket.transactionType.initiatorType, validInitiatorTypes, "transactionType.initiatorType", errors);
    }

    return errors;
};
