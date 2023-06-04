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
    DELETE = "DELETE"
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

export enum CommunicationErrorCodes {
    COMMUNCATION_ERROR = "1000",
    DESTINATION_COMMUNICATION_ERROR = "1001"
}

export enum ServerErrorCodes {
    GENERIC_SERVER_ERROR = "2000",
    INTERNAL_SERVER_ERROR = "2001",
	NOT_IMPLEMENTED = "2002",
	SERVICE_CURRENTLY_UNAVAILABLE = "2003",
	SERVER_TIMED_OUT = "2004",
	SERVER_BUSY = "2005"
}

export enum ClientErrorCodes {
    GENERIC_CLIENT_ERROR = "3000",
    UNACCEPTABLE_VERSION_REQUESTED = "3001",
    UNKNOWN_URI = "3002",
    ADD_PARTY_INFORMATION_ERROR = "3003",
    GENERIC_VALIDATION_ERROR = "3100",
    MALFORMED_SYNTAX = "3101",
    MISSING_MANDATORY_ELEMENT = "3102",
    TOO_MANY_ELEMENTS = "3103",
    TOO_LARGE_PAYLOAD = "3104",
    INVALID_SIGNATURE = "3105",
    MODIFIED_REQUEST = "3106",
    MISSING_MANDATORY_EXTENSION_PARAMETER = "3107",
    GENERIC_ID_NOT_FOUND = "3200",
    DESTINATION_FSP_ERROR = "3201",
	PAYER_FSP_ID_NOT_FOUND = "3202",
	PAYEE_FSP_ID_NOT_FOUND = "3203",
	PARTY_NOT_FOUND = "3204",
    QUOTE_ID_NOT_FOUND = "3205",
    TRANSACTION_REQUEST_ID_NOT_FOUND = "3206",
    TRANSACTION_ID_NOT_FOUND = "3207",
    TRANSFER_ID_NOT_FOUND = "3208",
    BULK_QUOTE_ID_NOT_FOUND = "3209",
    BULKD_TRANSFER_ID_NOT_FOUND = "3210",
    GENERIC_EXPIRED_ERROR = "3300",
    TRANSACTION_REQUEST_EXPIRED = "3301",
    QUOTE_EXPIRED = "3302",
    TRANSFER_EXPIRED = "3303"
}

export enum PayerErrorCodes {
    GENERIC_PAYER_ERROR = "4000",
    PAYER_FSP_INSUFFICIENT_LIQUIDITY = "4001",
    GENERIC_PAYER_REJECTION = "4100",
    PAYER_REJECTED_TRANSACTION_REQUEST = "4101",
    PAYER_FSP_UNSUPPORTED_TRANSACTION_TYPE = "4102",
    PAYER_UNSUPPORTED_CURRENCY = "4103",
    PAYER_LIMIT_ERROR = "4200",
    PAYER_PERMISSION_ERROR = "4300",
    GENERIC_PAYER_BLOCKED_ERROR = "4400"
}

export enum PayeeErrorCodes {
    GENERIC_PAYEE_ERROR = "5000",
    PAYEE_FSP_INSUFFICIENT_LIQUIDITY = "5001",
    GENERIC_PAYEE_REJECTION = "5100",
    PAYEE_REJECTED_QUOTE = "5101",
    PAYEE_FSP_UNSUPPORTED_TRANSACTION_TYPE = "5102",
    PAYEE_FSP_REJECTED_QUOTE = "5103",
    PAYEE_REJECTED_TRANSACTION = "5104",
    PAYEE_FSP_REJECTED_TRANSACTION = "5105",
    PAYEE_UNSUPPORTED_CURRENCY = "5106",
    PAYEE_LIMIT_ERROR = "5200",
    PAYEE_PERMISSION_ERROR = "5300",
    GENERIC_PAYEE_BLOCKED_ERROR = "5400",
}

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
    TRANSFERS = "transfers"
}

export enum AmountTypeEnum {
    SEND = "SEND",
    RECEIVE = "RECEIVE"
}