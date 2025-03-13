/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License")

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
*****/

"use strict";

import { AccountLookupErrorCodeNames } from "@mojaloop/account-lookup-bc-public-types-lib";
import { Enums } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ErrorMapping } from "./types";

const AccountLookupBCErrorMappings = {
    [AccountLookupErrorCodeNames.UNABLE_TO_ASSOCIATE_PARTICIPANT]: {
        errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name
    },
    [AccountLookupErrorCodeNames.UNABLE_TO_DISASSOCIATE_PARTICIPANT]: {
        errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name
    },
    [AccountLookupErrorCodeNames.DESTINATION_PARTICIPANT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [AccountLookupErrorCodeNames.SOURCE_PARTICIPANT_NOT_FOUND]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [AccountLookupErrorCodeNames.INVALID_DESTINATION_PARTICIPANT]: {
        errorCode: Enums.ClientErrors.GENERIC_CLIENT_ERROR.code,
        errorDescription: Enums.ClientErrors.GENERIC_CLIENT_ERROR.name
    },
    [AccountLookupErrorCodeNames.INVALID_SOURCE_PARTICIPANT]: {
        errorCode: Enums.ClientErrors.DESTINATION_FSP_ERROR.code,
        errorDescription: Enums.ClientErrors.DESTINATION_FSP_ERROR.name
    },
    [AccountLookupErrorCodeNames.INVALID_MESSAGE_PAYLOAD]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [AccountLookupErrorCodeNames.INVALID_MESSAGE_TYPE]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [AccountLookupErrorCodeNames.UNABLE_TO_GET_ORACLE_ADAPTER]: {
        errorCode: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.GENERIC_ID_NOT_FOUND.name
    },
    [AccountLookupErrorCodeNames.UNABLE_TO_GET_PARTICIPANT_FROM_ORACLE]: {
        errorCode: Enums.ClientErrors.PARTY_NOT_FOUND.code,
        errorDescription: Enums.ClientErrors.PARTY_NOT_FOUND.name
    },
    [AccountLookupErrorCodeNames.COMMAND_TYPE_UNKNOWN]: {
        errorCode: Enums.ServerErrors.INTERNAL_SERVER_ERROR.code,
        errorDescription: Enums.ServerErrors.INTERNAL_SERVER_ERROR.name
    },
    [AccountLookupErrorCodeNames.REQUIRED_SOURCE_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_ERROR.name
    },
    [AccountLookupErrorCodeNames.REQUIRED_SOURCE_PARTICIPANT_NOT_APPROVED]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_ERROR.name
    },
    [AccountLookupErrorCodeNames.REQUIRED_SOURCE_PARTICIPANT_NOT_ACTIVE]: {
        errorCode: Enums.PayerErrors.GENERIC_PAYER_ERROR.code,
        errorDescription: Enums.PayerErrors.GENERIC_PAYER_ERROR.name
    },
    [AccountLookupErrorCodeNames.REQUIRED_DESTINATION_PARTICIPANT_ID_MISMATCH]: {
        errorCode: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
        errorDescription: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
    },
    [AccountLookupErrorCodeNames.REQUIRED_DESTINATION_PARTICIPANT_NOT_APPROVED]: {
        errorCode: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
        errorDescription: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
    },
    [AccountLookupErrorCodeNames.REQUIRED_DESTINATION_PARTICIPANT_NOT_ACTIVE]: {
        errorCode: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.code,
        errorDescription: Enums.PayeeErrors.GENERIC_PAYEE_ERROR.name
    }
};

export type AccountLookupErrorCode = keyof typeof AccountLookupBCErrorMappings;

export function getAccountLookupBCErrorMapping(errorCode: AccountLookupErrorCode): ErrorMapping | null {
    const errorInformation = AccountLookupBCErrorMappings[errorCode];

    if(errorInformation) {
        return errorInformation;
    }

    return null;
}