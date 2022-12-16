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
 
export default {
  $id: "defs",
  definitions: {
    "ErrorInformation": {
      "title": "ErrorInformation",
      "description": "Data model for the complex type ErrorInformation.",
      "required": [
        "errorCode",
        "errorDescription"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "errorCode": {
          "description": "Specific error number.",
          "type": "string"
        },
        "errorDescription": {
          "description": "Error description string.",
          "type": "string"
        },
        "extensionList": {
          "$ref": "defs#/definitions/ExtensionList"
        }
      }
    },
    "Extension": {
      "title": "Extension",
      "description": "Data model for the complex type Extension",
      "required": [
        "key",
        "value"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "key": {
          "description": "Extension key.",
          "type": "string"
        },
        "value": {
          "description": "Extension value.",
          "type": "string"
        }
      }
    },
    "ExtensionList": {
      "title": "ExtensionList",
      "description": "Data model for the complex type ExtensionList",
      "required": [
        "extension"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "extension": {
          "description": "Number of Extension elements",
          "maxItems": 16,
          "minItems": 1,
          "type": "array",
          "items": {
            "$ref": "defs#/definitions/Extension"
          }
        }
      }
    },
    "FirstName": {
      "title": "FirstName",
      "description": "First name of the Party (Name Type).",
      "maxLength": 128,
      "minLength": 1,
      "pattern": "^(?!\\s*$)[\\p{L}\\p{Nd} .,'-]{1,128}$",
      "type": "string"
    },
    "GeoCode": {
      "title": "GeoCode",
      "description": "Data model for the complex type GeoCode. Indicates the geographic location from where the transaction was initiated.",
      "required": [
        "latitude",
        "longitude"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "latitude": {
          "description": "Latitude of the Party.",
          "type": "string"
        },
        "longitude": {
          "description": "Longitude of the   Party.",
          "type": "string"
        }
      }
    },
    "IndividualQuote": {
      "title": "IndividualQuote",
      "description": "Data model for the complex type IndividualQuote.",
      "required": [
        "quoteId",
        "transactionId",
        "payee",
        "amountType",
        "amount",
        "transactionType"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "quoteId": {
          "description": "Identifies quote message.",
          "type": "string"
        },
        "transactionId": {
          "description": "Identifies transaction message.",
          "type": "string"
        },
        "payee": {
          "$ref": "defs#/definitions/Party"
        },
        "amountType": {
          "description": "SEND for sendAmount, RECEIVE for receiveAmount.",
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
        "note": {
          "description": "Memo that will be attached to the transaction.",
          "type": "string"
        },
        "extensionList": {
          "$ref": "defs#/definitions/ExtensionList"
        }
      }
    },
    "IndividualQuoteResult": {
      "title": "IndividualQuoteResult",
      "description": "Data model for the complex type IndividualQuoteResult.",
      "required": [
        "quoteId"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "quoteId": {
          "description": "Identifies quote message.",
          "type": "string"
        },
        "payee": {
          "$ref": "defs#/definitions/Party"
        },
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
        "ilpPacket": {
          "description": "The ILP Packet that must be attached to the transfer by the Payer.",
          "type": "string"
        },
        "condition": {
          "description": "The condition that must be attached to the transfer by the Payer.",
          "type": "string"
        },
        "errorInformation": {
          "$ref": "defs#/definitions/ErrorInformation"
        },
        "extensionList": {
          "$ref": "defs#/definitions/ExtensionList"
        }
      }
    },
    "LastName": {
      "title": "LastName",
      "description": "Last name of the Party (Name Type).",
      "maxLength": 128,
      "minLength": 1,
      "pattern": "^(?!\\s*$)[\\p{L}\\p{Nd} .,'-]{1,128}$",
      "type": "string"
    },
    "MiddleName": {
      "title": "MiddleName",
      "description": "Middle name of the Party (Name Type).",
      "maxLength": 128,
      "minLength": 1,
      "pattern": "^(?!\\s*$)[\\p{L}\\p{Nd} .,'-]{1,128}$",
      "type": "string"
    },
    "Money": {
      "title": "Money",
      "description": "Data model for the complex type Money.",
      "required": [
        "currency",
        "amount"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "currency": {
          "description": "Currency of the amount.",
          "type": "string"
        },
        "amount": {
          "description": "Amount of Money.",
          "type": "string"
        }
      }
    },
    "Name": {
      "title": "Name",
      "description": "The API data type Name is a JSON String, restricted by a regular expression to avoid characters which are generally not used in a name. Regular Expression - The regular expression for restricting the Name type is \"^(?!\\s*$)[\\w .,'-]{1,128}$\". The restriction does not allow a string consisting of whitespace only, all Unicode characters are allowed, as well as the period (.) (apostrophe (‘), dash (-), comma (,) and space characters ( ). Note -  In some programming languages, Unicode support must be specifically enabled. For example, if Java is used the flag UNICODE_CHARACTER_CLASS must be enabled to allow Unicode characters.",
      "pattern": "^(?!\\s*$)[\\w .,'-]{1,128}$",
      "type": "string"
    },
    "Party": {
      "title": "Party",
      "description": "Data model for the complex type Party.",
      "required": [
        "partyIdInfo"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "partyIdInfo": {
          "$ref": "defs#/definitions/PartyIdInfo"
        },
        "merchantClassificationCode": {
          "description": "Used in the context of Payee Information, where the Payee happens to be a merchant accepting merchant payments.",
          "type": "string"
        },
        "name": {
          "description": "Display name of the Party, could be a real name or a nick name.",
          "type": "string"
        },
        "personalInfo": {
          "$ref": "defs#/definitions/PartyPersonalInfo"
        }
      }
    },
    "PartyComplexName": {
      "title": "PartyComplexName",
      "description": "Data model for the complex type PartyComplexName.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "firstName": {
          "$ref": "defs#/definitions/FirstName"
        },
        "middleName": {
          "$ref": "defs#/definitions/MiddleName"
        },
        "lastName": {
          "$ref": "defs#/definitions/LastName"
        }
      }
    },
    "PartyIdInfo": {
      "title": "PartyIdInfo",
      "description": "Data model for the complex type PartyIdInfo.",
      "required": [
        "partyIdType",
        "partyIdentifier"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "partyIdType": {
          "description": "Type of the identifier.",
          "type": "string"
        },
        "partyIdentifier": {
          "description": "An identifier for the Party.",
          "type": "string"
        },
        "partySubIdOrType": {
          "description": "A sub-identifier or sub-type for the Party.",
          "type": "string"
        },
        "fspId": {
          "description": "FSP ID (if known)",
          "type": "string"
        }
      }
    },
    "PartyPersonalInfo": {
      "title": "PartyPersonalInfo",
      "description": "Data model for the complex type PartyPersonalInfo.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "complexName": {
          "$ref": "defs#/definitions/PartyComplexName"
        },
        "dateOfBirth": {
          "description": "Date of birth for the Party.",
          "type": "string"
        }
      }
    },
    "PartyResult": {
      "title": "PartyResult",
      "description": "Data model for the complex type PartyResult.",
      "required": [
        "partyId"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "partyId": {
          "$ref": "defs#/definitions/PartyIdInfo"
        },
        "errorInformation": {
          "$ref": "defs#/definitions/ErrorInformation"
        }
      }
    },
    "Refund": {
      "title": "Refund",
      "description": "Data model for the complex type Refund.",
      "required": [
        "originalTransactionId"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "originalTransactionId": {
          "description": "Reference to the original transaction ID that is requested to be refunded.",
          "type": "string"
        },
        "refundReason": {
          "description": "Free text indicating the reason for the refund.",
          "type": "string"
        }
      }
    },
    "TransactionType": {
      "title": "TransactionType",
      "description": "Data model for the complex type TransactionType.",
      "required": [
        "scenario",
        "initiator",
        "initiatorType"
      ],
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "scenario": {
          "description": "Deposit, withdrawal, refund, …",
          "type": "string"
        },
        "subScenario": {
          "description": "Possible sub-scenario, defined locally within the scheme.",
          "type": "string"
        },
        "initiator": {
          "description": "Who is initiating the transaction - Payer or Payee",
          "type": "string"
        },
        "initiatorType": {
          "description": "Consumer, agent, business, …",
          "type": "string"
        },
        "refundInfo": {
          "$ref": "defs#/definitions/Refund"
        },
        "balanceOfPayments": {
          "description": "Balance of Payments code.",
          "type": "string"
        }
      }
    },
  },
};