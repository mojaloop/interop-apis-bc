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