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
 
 export const QuotesPostRequest = {
    "$id": "QuotesPostRequest",
    "title": "QuotesPostRequest",
    "description": "POST /quotes object",
    "required": [
        "quoteId",
        "transactionId",
        "payee",
        "payer",
        "amountType",
        "amount",
        "transactionType"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "quoteId": {
            "description": "Common ID between the FSPs for the quote object, decided by the Payer FSP. The ID should be reused for resends of the same quote for a transaction. A new ID should be generated for each new quote for a transaction.",
            "type": "string"
        },
        "transactionId": {
            "description": "Common ID (decided by the Payer FSP) between the FSPs for the future transaction object. The actual transaction will be created as part of a successful transfer process. The ID should be reused for resends of the same quote for a transaction. A new ID should be generated for each new quote for a transaction.",
            "type": "string"
        },
        "transactionRequestId": {
            "description": "Identifies an optional previously-sent transaction request.",
            "type": "string"
        },
        "payee": {
            "$ref": "defs#/definitions/Party"
        },
        "payer": {
            "$ref": "defs#/definitions/Party"
        },
        "amountType": {
            "description": "SEND for send amount, RECEIVE for receive amount.",
            "type": "string"
        },
        "amount": {
            "$ref": "defs#/definitions/Money"
        },
        "fees": {
            "$ref": "defs#/definitions/Money"
        },
        "transactionType": {
            "$ref": "defs#/definitions/TransactionType"
        },
        "geoCode": {
            "$ref": "defs#/definitions/GeoCode"
        },
        "note": {
            "description": "A memo that will be attached to the transaction.",
            "type": "string"
        },
        "expiration": {
            "description": "Expiration is optional. It can be set to get a quick failure in case the peer FSP takes too long to respond. Also, it may be beneficial for Consumer, Agent, and Merchant to know that their request has a time limit.",
            "type": "string"
        },
            "extensionList": {
            "$ref": "defs#/definitions/ExtensionList"
        }
    }
};

export const QuotesIDPutResponse = {
    "$id": "QuotesIDPutResponse",
    "title": "QuotesIDPutResponse",
    "description": "PUT /quotes/{ID} object",
    "required": [
        "transferAmount",
        "expiration",
        "ilpPacket",
        "condition"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "transferAmount": {
            "$ref": "defs#/definitions/Money"
        },
        "payeeReceiveAmount": {
            "$ref": "defs#/definitions/Money"
        },
        "payeeFspFee": {
            "$ref": "defs#/definitions/Money"
        },
        "payeeFspCommission": {
            "$ref": "defs#/definitions/Money"
        },
        "expiration": {
            "description": "Date and time until when the quotation is valid and can be honored when used in the subsequent transaction.",
            "type": "string"
        },
        "geoCode": {
            "$ref": "defs#/definitions/GeoCode"
        },
        "ilpPacket": {
            "description": "The ILP Packet that must be attached to the transfer by the Payer.",
            "type": "string"
        },
        "condition": {
            "description": "The condition that must be attached to the transfer by the Payer.",
            "type": "string"
        },
        "extensionList": {
            "$ref": "defs#/definitions/ExtensionList"
        }
    }
};