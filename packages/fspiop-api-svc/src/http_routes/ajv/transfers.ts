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
 
 export const TransfersPostRequest = {
    "$id": "TransfersPostRequest",
    "title": "TransfersPostRequest",
    "description": "POST /transfers Request object",
    "required": [
      "transferId",
      "payeeFsp",
      "payerFsp",
      "amount",
      "ilpPacket",
      "condition",
      "expiration"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "transferId": {
        "description": "The common ID between the FSPs and the optional Switch for the transfer object, decided by the Payer FSP. The ID should be reused for resends of the same transfer. A new ID should be generated for each new transfer.",
        "type": "string"
      },
      "payeeFsp": {
        "description": "Payee FSP in the proposed financial transaction.",
        "type": "string"
      },
      "payerFsp": {
        "description": "Payer FSP in the proposed financial transaction.",
        "type": "string"
      },
      "amount": {
        "$ref": "defs#/definitions/Money"
      },
      "ilpPacket": {
        "description": "The ILP Packet containing the amount delivered to the Payee and the ILP Address of the Payee and any other end-to-end data.",
        "type": "string"
      },
      "condition": {
        "description": "The condition that must be fulfilled to commit the transfer.",
        "type": "string"
      },
      "expiration": {
        "description": "Expiration can be set to get a quick failure expiration of the transfer. The transfer should be rolled back if no fulfilment is delivered before this time.",
        "type": "string"
      },
      "extensionList": {
        "$ref": "defs#/definitions/ExtensionList"
      }
    }
}

export const TransfersIDPutResponse = {
    "$id": "TransfersIDPutResponse",
    "title": "TransfersIDPutResponse",
    "description": "PUT /transfers/{ID} object",
    "required": [
        "transferState"
    ],
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "fulfilment": {
          "description": "Fulfilment of the condition specified with the transaction. Mandatory if transfer has completed successfully.",
          "type": "string"
        },
        "completedTimestamp": {
          "description": "Time and date when the transaction was completed.",
          "type": "string"
        },
        "transferState": {
          "description": "State of the transfer.",
          "type": "string"
        },
        "extensionList": {
          "$ref": "defs#/definitions/ExtensionList"
        }
    }
}