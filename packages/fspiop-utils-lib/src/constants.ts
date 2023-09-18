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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
 
 --------------
 ******/

"use strict";

// Cherry-picked from @mojaloop/central-services-shared


export const FSPIOP_HEADERS_SWITCH = "bluebank";
export const FSPIOP_HEADERS_SWITCH_REGEX = /^switch$/i;

export const FSPIOP_HEADERS_SOURCE = "fspiop-source";
export const FSPIOP_HEADERS_DESTINATION = "fspiop-destination";
export const FSPIOP_HEADERS_HTTP_METHOD = "fspiop-http-method";
export const FSPIOP_HEADERS_SIGNATURE = "fspiop-signature";
export const FSPIOP_HEADERS_URI = "fspiop-uri";

export const FSPIOP_HEADERS_ACCEPT = "accept";
export const FSPIOP_HEADERS_ACCEPT_REGEX = /application\/vnd.interoperability[.]/;
export const FSPIOP_HEADERS_CONTENT_TYPE_REGEX = /application\/vnd.interoperability[.]/;
export const FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX = /(application\/vnd\.interoperability\.)(\w*)+(\+json\s{0,1};\s{0,1}version=)(.*)/;
export const FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX_VALUE = (resourceType?: string, version?: string,) => `application/vnd.interoperability.${resourceType}+json;version=${version}`;
export const FSPIOP_HEADERS_CONTENT_TYPE = "content-type";
export const FSPIOP_HEADERS_CONTENT_TYPE_DEFAULT = "application/json";
export const FSPIOP_HEADERS_CONTENT_TYPE_CONTENT = "content-length";
export const FSPIOP_HEADERS_HOST = "host";
export const FSPIOP_HEADERS_X_FORWARDED_FOR = "x-forwarded-for";
export const FSPIOP_HEADERS_ENCRYPTION = "fspiop-encryption";

// these are http defaults, not sure if we need them
export const FSPIOP_HEADERS_DATE = "date";
export const FSPIOP_HEADERS_CONTENT_LENGTH = "content-length";
export const FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION = "1.1";
export const FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION = "1";


export const FSPIOP_ENDPOINT_TYPES = {
    FSPIOP_CALLBACK_URL_PARTICIPANT_PUT: "FSPIOP_CALLBACK_URL_PARTICIPANT_PUT",
    FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR: "FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR",
    FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT: "FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT",
    FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR: "FSPIOP_CALLBACK_URL_PARTICIPANT_SUB_ID_PUT_ERROR"
};

export const FSPIOP_PARTY_ACCOUNT_TYPES = {
    MSISDN: "MSISDN",
    EMAIL: "EMAIL",
    PERSONAL_ID: "PERSONAL_ID",
    BUSINESS: "BUSINESS",
    DEVICE: "DEVICE",
    ACCOUNT_ID: "ACCOUNT_ID",
    IBAN: "IBAN",
    ALIAS: "ALIAS",
    CONSENT: "CONSENT",
    THIRD_PARTY_LINK: "THIRD_PARTY_LINK"
};

export const RequiredHeaders = {
    participants: [FSPIOP_HEADERS_CONTENT_TYPE, FSPIOP_HEADERS_SOURCE],
    parties: [FSPIOP_HEADERS_CONTENT_TYPE, FSPIOP_HEADERS_SOURCE],
};