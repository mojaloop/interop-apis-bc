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

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

 "use strict";

export enum ResponseTypeEnum {
    JSON = "json"
}

export enum FspiopRequestMethodsEnum {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH"
}

export enum PartyIdType {
    MSISDN = "MSISDN",
    EMAIL = "EMAIL",
    PERSONAL_ID = "PERSONAL_ID",
    BUSINESS = "BUSINESS",
    DEVICE = "DEVICE",
    ACCOUNT_ID = "ACCOUNT_ID",
    IBAN = "IBAN",
    ALIAS = "ALIAS",
}

export enum ErrorCode {
	BAD_REQUEST = "9882",
    UNAUTHORIZED = "4565",
    FORBIDDEN = "4244",
    NOT_FOUND = "8377",
    METHOD_NOT_ALLOWED = "5868",
    NOT_ACCEPTABLE = "9221",
    NOT_IMPLEMENTED = "5261",
    SERVICE_UNAVAILABLE = "6991"
}

export const CommunicationErrors = {
    COMMUNCATION_ERROR: {
        code: "1000",
        name: "Communication error",
        description: "Generic communication error."
    },
    DESTINATION_COMMUNICATION_ERROR: {
        code: "1001",
        name: "Destination communication error",
        description: "Destination of the request failed to be reached. This usually indicates that a Peer FSP failed to respond from an intermediate entity."
    },
} as const;

export const ServerErrors = {
    GENERIC_SERVER_ERROR: {
        code: "2000",
        name: "Generic server error",
        description: "Generic server error to be used in order not to disclose information that may be considered private."
    },
    INTERNAL_SERVER_ERROR: {
        code: "2001",
        name: "Internal server error",
        description: "Generic unexpected exception. This usually indicates a bug or unhandled error case."
    },
	NOT_IMPLEMENTED: {
        code: "2002",
        name: "Not implemented",
        description: "Service requested is not supported by the server."
    },
	SERVICE_CURRENTLY_UNAVAILABLE: {
        code: "2003",
        name: "Service currently unavailable",
        description: "Service requested is currently unavailable on the server. This could be because maintenance is taking place, or because of a temporary failure."
    },
	SERVER_TIMED_OUT: {
        code: "2004",
        name: "Server timed out",
        description: "Timeout has occurred, meaning the next Party in the chain did not send a callback in time. This could be because a timeout is set too low or because something took longer than expected."
    },
	SERVER_BUSY: {
        code: "2005",
        name: "Server busy",
        description: "Server is rejecting requests due to overloading. Try again later.	"
    },
} as const;

export const ClientErrors = {
    GENERIC_CLIENT_ERROR: {
        code: "3000",
        name: "Generic client error",
        description: "Generic client error, used in order not to disclose information that may be considered private."
    },
    UNACCEPTABLE_VERSION_REQUESTED: {
        code: "3001",
        name: "Unacceptable version requested",
        description: "Client requested to use a protocol version which is not supported by the server."
    },
    UNKNOWN_URI: {
        code: "3002",
        name: "Unknown URI",
        description: "Provided URI was unknown to the server."
    },
    ADD_PARTY_INFORMATION_ERROR: {
        code: "3003",
        name: "Add Party information error",
        description: "Error occurred while adding or updating information regarding a Party."
    },
    GENERIC_VALIDATION_ERROR: {
        code: "3100",
        name: "Generic validation error",
        description: "Generic validation error to be used in order not to disclose information that may be considered private."
    },
    MALFORMED_SYNTAX: {
        code: "3101",
        name: "Malformed syntax",
        description: "Format of the parameter is not valid. For example, amount set to 5.ABC. The error description field should specify which information element is erroneous."
    },
    MISSING_MANDATORY_ELEMENT: {
        code: "3102",
        name: "Missing mandatory element",
        description: "Mandatory element in the data model was missing."
    },
    TOO_MANY_ELEMENTS: {
        code: "3103",
        name: "Too many elements",
        description: "Number of elements of an array exceeds the maximum number allowed."
    },
    TOO_LARGE_PAYLOAD: {
        code: "3104",
        name: "Too large payload",
        description: "Size of the payload exceeds the maximum size."
    },
    INVALID_SIGNATURE: {
        code: "3105",
        name: "Invalid signature",
        description: "Some parameters have changed in the message, making the signature invalid. This may indicate that the message may have been modified maliciously."
    },
    MODIFIED_REQUEST: {
        code: "3106",
        name: "Modified request",
        description: "Request with the same ID has previously been processed in which the parameters are not the same."
    },
    MISSING_MANDATORY_EXTENSION_PARAMETER: {
        code: "3107",
        name: "Missing mandatory extension parameter",
        description: "Scheme-mandatory extension parameter was missing."
    },
    GENERIC_ID_NOT_FOUND: {
        code: "3200",
        name: "Generic ID not found",
        description: "Generic ID error provided by the client."
    },
    DESTINATION_FSP_ERROR: {
        code: "3201",
        name: "Destination FSP Error",
        description: "Destination FSP does not exist or cannot be found."
    },
	PAYER_FSP_ID_NOT_FOUND: {
        code: "3202",
        name: "Payer FSP ID not found",
        description: "Provided Payer FSP ID not found."
    },
	PAYEE_FSP_ID_NOT_FOUND: {
        code: "3203",
        name: "Payee FSP ID not found",
        description: "Provided Payee FSP ID not found."
    },
	PARTY_NOT_FOUND: {
        code: "3204",
        name: "Party not found",
        description: "Party with the provided identifier, identifier type, and optional sub id or type was not found."
    },
    QUOTE_ID_NOT_FOUND: {
        code: "3205",
        name: "Quote ID not found",
        description: "Provided Quote ID was not found on the server."
    },
    TRANSACTION_REQUEST_ID_NOT_FOUND: {
        code: "3206",
        name: "Transaction request ID not found",
        description: "Provided Transaction Request ID was not found on the server."
    },
    TRANSACTION_ID_NOT_FOUND: {
        code: "3207",
        name: "Transaction ID not found",
        description: "Provided Transaction ID was not found on the server."
    },
    TRANSFER_ID_NOT_FOUND: {
        code: "3208",
        name: "Transfer ID not found",
        description: "Provided Transfer ID was not found on the server."
    },
    BULK_QUOTE_ID_NOT_FOUND: {
        code: "3209",
        name: "Bulk quote ID not found",
        description: "Provided Bulk Quote ID was not found on the server."
    },
    BULKD_TRANSFER_ID_NOT_FOUND: {
        code: "3210",
        name: "Bulk transfer ID not found",
        description: "Provided Bulk Transfer ID was not found on the server."
    },
    GENERIC_EXPIRED_ERROR: {
        code: "3300",
        name: "Generic expired error",
        description: "Generic expired object error, to be used in order not to disclose information that may be considered private."
    },
    TRANSACTION_REQUEST_EXPIRED: {
        code: "3301",
        name: "Transaction request expired",
        description: "Client requested to use a transaction request that has already expired."
    },
    QUOTE_EXPIRED: {
        code: "3302",
        name: "Quote expired",
        description: "Client requested to use a quote that has already expired."
    },
    TRANSFER_EXPIRED: {
        code: "3303",
        name: "Transfer expired",
        description: "Client requested to use a transfer that has already expired."
    },
} as const;

export const PayerErrors = {
    GENERIC_PAYER_ERROR: {
        code: "4000",
        name: "Generic Payer error",
        description: "Generic error related to the Payer or Payer FSP. Used for protecting information that may be considered private."
    },
    PAYER_FSP_INSUFFICIENT_LIQUIDITY: {
        code: "4001",
        name: "Payer FSP insufficient liquidity",
        description: "Payer FSP has insufficient liquidity to perform the transfer."
    },
    GENERIC_PAYER_REJECTION: {
        code: "4100",
        name: "Generic Payer rejection",
        description: "Payer or Payer FSP rejected the request."
    },
    PAYER_REJECTED_TRANSACTION_REQUEST: {
        code: "4101",
        name: "Payer rejected transaction request",
        description: "Payer rejected the transaction request from the Payee."
    },
    PAYER_FSP_UNSUPPORTED_TRANSACTION_TYPE: {
        code: "4102",
        name: "Payer FSP unsupported transaction type",
        description: "Payer FSP does not support or rejected the requested transaction type."
    },
    PAYER_UNSUPPORTED_CURRENCY: {
        code: "4103",
        name: "Payer unsupported currency",
        description: "Payer does not have an account which supports the requested currency."
    },
    PAYER_LIMIT_ERROR: {
        code: "4200",
        name: "Payer limit error",
        description: "Generic limit error, for example, the Payer is making more payments per day or per month than they are allowed to, or is making a payment which is larger than the allowed maximum per transaction."
    },
    PAYER_PERMISSION_ERROR: {
        code: "4300",
        name: "Payer permission error",
        description: "Generic permission error, the Payer or Payer FSP does not have the access rights to perform the service."
    },
    GENERIC_PAYER_BLOCKED_ERROR: {
        code: "4400",
        name: "Generic Payer blocked error",
        description: "Generic Payer blocked error; the Payer is blocked or has failed regulatory screenings."
    }
} as const;

export const PayeeErrors = {
    GENERIC_PAYEE_ERROR: {
        code: "5000",
        name: "Generic Payee error",
        description: "Generic error due to the Payer or Payer FSP, to be used in order not to disclose information that may be considered private."
    },
    PAYEE_FSP_INSUFFICIENT_LIQUIDITY: {
        code: "5001",
        name: "Payee FSP insufficient liquidity",
        description: "Payee FSP has insufficient liquidity to perform the transfer."
    },
    GENERIC_PAYEE_REJECTION: {
        code: "5100",
        name: "Generic Payee rejection",
        description: "Payee or Payee FSP rejected the request."
    },
    PAYEE_REJECTED_QUOTE: {
        code: "5101",
        name: "Payee rejected quote",
        description: "Payee does not want to proceed with the financial transaction after receiving a quote."
    },
    PAYEE_FSP_UNSUPPORTED_TRANSACTION_TYPE: {
        code: "5102",
        name: "Payee FSP unsupported transaction type",
        description: "Payee FSP does not support or has rejected the requested transaction type."
    },
    PAYEE_FSP_REJECTED_QUOTE: {
        code: "5103",
        name: "Payee FSP rejected quote",
        description: "Payee FSP does not want to proceed with the financial transaction after receiving a quote."
    },
    PAYEE_REJECTED_TRANSACTION: {
        code: "5104",
        name: "Payee rejected transaction",
        description: "Payee rejected the financial transaction."
    },
    PAYEE_FSP_REJECTED_TRANSACTION: {
        code: "5105",
        name: "Payee FSP rejected transaction",
        description: "Payee FSP rejected the financial transaction."
    },
    PAYEE_UNSUPPORTED_CURRENCY: {
        code: "5106",
        name: "Payee unsupported currency",
        description: "Payee does not have an account that supports the requested currency."
    },
    PAYEE_LIMIT_ERROR: {
        code: "5200",
        name: "Payee limit error",
        description: "Generic limit error, for example, the Payee is receiving more payments per day or per month than they are allowed to, or is receiving a payment that is larger than the allowed maximum per transaction."
    },
    PAYEE_PERMISSION_ERROR: {
        code: "5300",
        name: "Payee permission error",
        description: "Generic permission error, the Payee or Payee FSP does not have the access rights to perform the service."
    },
    GENERIC_PAYEE_BLOCKED_ERROR: {
        code: "5400",
        name: "Generic Payee blocked error",
        description: "Generic Payee Blocked error, the Payee is blocked or has failed regulatory screenings."
    }
} as const;

export enum PartyIdentifier {
    MSISDN = "MSISDN",
    EMAIL = "EMAIL",
    PERSONAL_ID = "PERSONAL_ID",
    BUSINESS = "BUSINESS",
    DEVICE = "DEVICE",
    ACCOUNT_ID = "ACCOUNT_ID",
    IBAN = "IBAN",
    ALIAS = "ALIAS"
}

export enum Currency {
    EUR = "EUR",
    USD = "USD",
}

export enum EntityTypeEnum {
    PARTICIPANTS = "participants",
    PARTIES = "parties",
    QUOTES = "quotes",
    BULK_QUOTES = "bulkQuotes",
    TRANSFERS = "transfers",
    BULK_TRANSFERS = "bulkTransfers"
}

export enum AmountTypeEnum {
    SEND = "SEND",
    RECEIVE = "RECEIVE"
}

export enum TransferStateEnum {
    RECEIVE = "RECEIVE",
    RESERVED = "RESERVED",
    COMMITED = "COMMITED",
    ABORTED = "ABORTED"
}

