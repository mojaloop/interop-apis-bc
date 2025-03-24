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

import { QuotingErrorCodeNames } from "@mojaloop/quoting-bc-public-types-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ErrorMapping } from "./types";

const QuotingBCErrorMappings = {
    [QuotingErrorCodeNames.INVALID_MESSAGE_PAYLOAD]: {
        errorCode: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
    },
    [QuotingErrorCodeNames.INVALID_MESSAGE_TYPE]: {
        errorCode: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
    },
    [QuotingErrorCodeNames.INVALID_BULK_QUOTE_LENGTH]: {
        errorCode: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
    },
    [QuotingErrorCodeNames.RULE_SCHEME_VIOLATED_RESPONSE]: {
        errorCode: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
    },
    [QuotingErrorCodeNames.RULE_SCHEME_VIOLATED_REQUEST]: {
        errorCode: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_VALIDATION_ERROR.name
    },
    [QuotingErrorCodeNames.QUOTE_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.QUOTE_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.QUOTE_ID_NOT_FOUND.name
    },
    [QuotingErrorCodeNames.BULK_QUOTE_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.name
    },
    [QuotingErrorCodeNames.INDIVIDUAL_QUOTES_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.BULK_QUOTE_ID_NOT_FOUND.name
    },
    [QuotingErrorCodeNames.INVALID_DESTINATION_PARTICIPANT]: {
        errorCode: Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
        errorDescription: Enums.ClientErrors.DESTINATION_FSP_ERROR.name
    },
    [QuotingErrorCodeNames.SOURCE_PARTICIPANT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYER_FSP_ID_NOT_FOUND.name
    },
    [QuotingErrorCodeNames.DESTINATION_PARTICIPANT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PAYEE_FSP_ID_NOT_FOUND.name
    },
    [QuotingErrorCodeNames.QUOTE_EXPIRED]: {
        errorCode: Enums.ClientErrors.QUOTE_EXPIRED.code,
        errorDescription: Enums.ClientErrors.QUOTE_EXPIRED.name
    },
    [QuotingErrorCodeNames.BULK_QUOTE_EXPIRED]: {
        errorCode: Enums.ClientErrors.QUOTE_EXPIRED.code,
        errorDescription: Enums.ClientErrors.QUOTE_EXPIRED.name
    },
    [QuotingErrorCodeNames.REQUIRED_SOURCE_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_ERROR.name
    },
    [QuotingErrorCodeNames.REQUIRED_SOURCE_PARTICIPANT_NOT_APPROVED]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_ERROR.name
    },
    [QuotingErrorCodeNames.REQUIRED_SOURCE_PARTICIPANT_NOT_ACTIVE]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_ERROR.name
    },
    [QuotingErrorCodeNames.REQUIRED_DESTINATION_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
        errorDescription: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
    },
    [QuotingErrorCodeNames.REQUIRED_DESTINATION_PARTICIPANT_NOT_APPROVED]: {
        errorCode: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
        errorDescription: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
    },
    [QuotingErrorCodeNames.REQUIRED_DESTINATION_PARTICIPANT_NOT_ACTIVE]: {
        errorCode: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
        errorDescription: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
    },
    [QuotingErrorCodeNames.DUPLICATE_QUOTE]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [QuotingErrorCodeNames.UNABLE_TO_ADD_QUOTE]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [QuotingErrorCodeNames.UNABLE_TO_ADD_BULK_QUOTE]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [QuotingErrorCodeNames.UNABLE_TO_UPDATE_QUOTE]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [QuotingErrorCodeNames.UNABLE_TO_UPDATE_BULK_QUOTE]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [QuotingErrorCodeNames.INVALID_SOURCE_PARTICIPANT]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [QuotingErrorCodeNames.COMMAND_TYPE_UNKNOWN]: {
        errorCode: Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
    }
};

export type QuotingErrorCode = keyof typeof QuotingBCErrorMappings;

export function getQuotingBCErrorMapping(errorCode: QuotingErrorCode): ErrorMapping | null {
    const errorInformation = QuotingBCErrorMappings[errorCode];

    if(errorInformation) {
        return errorInformation;
    }

    return null;
}
