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
 
 export const ParticipantsTypeIDSubIDPostRequest = {
    "$id": "ParticipantsTypeIDSubIDPostRequest",
    "title": "ParticipantsTypeIDSubIDPostRequest",
    "description": "POST /participants/{Type}/{ID}/{SubId}, /participants/{Type}/{ID} object",
    "required": [
      "fspId"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "fspId": {
            "description": "FSP Identifier that the Party belongs to.",
            "type": "string"
        },
        "currency": {
            "description": "Indicate that the provided Currency is supported by the Party.",
            "type": "string"
        }
    }
};
  
export const ParticipantsTypeIDPutResponse = {
    "$id": "ParticipantsTypeIDPutResponse",
    "title": "ParticipantsTypeIDPutResponse",
    "description": "PUT /participants/{Type}/{ID}/{SubId}, /participants/{Type}/{ID} object",
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "fspId": {
            "description": "FSP Identifier that the Party belongs to.",
            "type": "string"
        }
    }
};

export const ParticipantsIDPutResponse = {
    "$id": "ParticipantsIDPutResponse",
    "title": "ParticipantsIDPutResponse",
    "description": "PUT /participants/{ID} object",
    "required": [
      "partyList"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "partyList": {
            "description": "List of PartyResult elements that were either created or failed to be created.",
            "maxItems": 10000,
            "minItems": 1,
            "type": "array",
            "items": {
                "$ref": "#/components/schemas/PartyResult"
            }
        },
        "currency": {
            "description": "Indicate that the provided Currency was set to be supported by each successfully added PartyIdInfo.",
            "type": "string"
        }
    }
};

export const  ParticipantsPostRequest = {
    "$id": "ParticipantsPostRequest",
    "title": "ParticipantsPostRequest",
    "description": "POST /participants object",
    "required": [
      "requestId",
      "partyList"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "requestId": {
            "description": "The ID of the request, decided by the client. Used for identification of the callback from the server.",
            "type": "string"
        },
        "partyList": {
            "description": "List of PartyIdInfo elements that the client would like to update or create FSP information about.",
            "maxItems": 10000,
            "minItems": 1,
            "type": "array",
            "items": {
                "$ref": "#/components/schemas/PartyIdInfo"
            }
        },
        "currency": {
            "description": "Indicate that the provided Currency is supported by each PartyIdInfo in the list.",
            "type": "string"
        }
    }
};