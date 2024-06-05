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

import { TransferErrorCodeNames } from "@mojaloop/transfers-bc-public-types-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ErrorMapping } from "./types";

export const TransfersBCErrorMappings = {
    [TransferErrorCodeNames.COMMAND_TYPE_UNKNOWN]: {
        errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.HUB_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.UNABLE_TO_CANCEL_TRANSFER_RESERVATION_AND_COMMIT]: {
        errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.UNABLE_TO_ADD_TRANSFER]: {
        errorCode: Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.UNABLE_TO_UPDATE_TRANSFER]: {
        errorCode: Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.UNABLE_TO_DELETE_TRANSFER_REMINDER]: {
        errorCode: Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.HUB_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.HUB_ACCOUNT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.PAYER_POSITION_ACCOUNT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.PAYER_LIQUIDITY_ACCOUNT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.PAYER_PARTICIPANT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.PAYEE_POSITION_ACCOUNT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.PAYEE_LIQUIDITY_ACCOUNT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.PAYEE_PARTICIPANT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.TRANSFER_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.UNABLE_TO_GET_TRANSFER]: {
        errorCode: Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.TRANSFER_ID_NOT_FOUND.name
    },
    [TransferErrorCodeNames.TRANSFER_EXPIRED]: {
        errorCode: Enums.ClientErrors.TRANSFER_EXPIRED.code,
        errorDescription: Enums.ClientErrors.TRANSFER_EXPIRED.name
    },
    [TransferErrorCodeNames.UNABLE_TO_CANCEL_TRANSFER_RESERVATION]: {
        errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name
    },
    [TransferErrorCodeNames.TRANSFER_LIQUIDITY_CHECK_FAILED]: {
        errorCode: Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.code,
        errorDescription: Enums.PayerErrors.PAYER_FSP_INSUFFICIENT_LIQUIDITY.name
    },
    [TransferErrorCodeNames.PAYER_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.name
    },
    [TransferErrorCodeNames.PAYER_PARTICIPANT_NOT_ACTIVE]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.name
    },
    [TransferErrorCodeNames.PAYER_PARTICIPANT_NOT_APPROVED]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_BLOCKED_ERROR.name
    },
    [TransferErrorCodeNames.PAYEE_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
        errorDescription: Enums.ClientErrors.DESTINATION_FSP_ERROR.name
    },
    [TransferErrorCodeNames.PAYEE_PARTICIPANT_NOT_ACTIVE]: {
        errorCode: Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
        errorDescription: Enums.ClientErrors.DESTINATION_FSP_ERROR.name
    },
    [TransferErrorCodeNames.PAYEE_PARTICIPANT_NOT_APPROVED]: {
        errorCode: Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
        errorDescription: Enums.ClientErrors.DESTINATION_FSP_ERROR.name
    }
};

export type TransferErrorCode = keyof typeof TransfersBCErrorMappings;


export function getTransferBCErrorMapping(errorCode: TransferErrorCode): ErrorMapping | null {
    const errorInformation = TransfersBCErrorMappings[errorCode];

    if(errorInformation) {
        return errorInformation;
    }

    return null;
}