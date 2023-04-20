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
    MISSING_MANDATORY_ELEMENT = "3002",
    TOO_MANY_ELEMENTS = "3003",
    TOO_LARGE_PAYLOAD = "3004",
    INVALID_SIGNATURE = "3005",
    MODIFIED_REQUEST = "3006",
    MISSING_MANDATORY_EXTENSION_PARAMETER = "3007",
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
    BULKD_TRANSFER_ID_NOT_FOUND = "3210"
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