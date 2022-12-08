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
 
 export const BulkQuotesPostRequest = {
    "$id": "BulkQuotesPostRequest",
    "title": "BulkQuotesPostRequest",
    "description": "POST /bulkQuotes object",
    "required": [
      "bulkQuoteId",
      "payer",
      "individualQuotes"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "bulkQuoteId": {
        "description": "Common ID between the FSPs for the bulk quote object, decided by the Payer FSP. The ID should be reused for resends of the same bulk quote. A new ID should be generated for each new bulk quote.",
        "type": "string"
      },
      "payer": {
        "$ref": "defs#/definitions/Party"
      },
      "geoCode": {
        "$ref": "defs#/definitions/GeoCode"
      },
      "expiration": {
        "description": "Expiration is optional to let the Payee FSP know when a quote no longer needs to be returned.",
        "type": "string"
      },
      "individualQuotes": {
        "description": "List of quotes elements.",
        "maxItems": 1000,
        "minItems": 1,
        "type": "array",
        "items": {
          "$ref": "defs#/definitions/IndividualQuote"
        }
      },
      "extensionList": {
        "$ref": "defs#/definitions/ExtensionList"
      }
    }
};

export const BulkQuotesIDPutResponse = {
    "$id": "BulkQuotesIDPutResponse",
    "title": "BulkQuotesIDPutResponse",
    "description": "PUT /bulkQuotes/{ID} object",
    "required": [
      "expiration"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "individualQuoteResults": {
        "description": "Fees for each individual transaction, if any of them are charged per transaction.",
        "maxItems": 1000,
        "type": "array",
        "items": {
          "$ref": "defs#/definitions/IndividualQuoteResult"
        }
      },
      "expiration": {
        "description": "Date and time until when the quotation is valid and can be honored when used in the subsequent transaction request.",
        "type": "string"
      },
      "extensionList": {
        "$ref": "defs#/definitions/ExtensionList"
      }
    }
};