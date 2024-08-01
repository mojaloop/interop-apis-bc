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

import {Currency} from "@mojaloop/platform-configuration-bc-public-types-lib";
import { ClientErrors } from "./enums";
import { ValidationdError } from "./errors";
import base64url from "base64url";
import Crypto from "crypto";
import { DecodedIlpPacketQuote, DecodedIlpPacketTransfer } from "./ilp_types";
import { IPostTransfer, PutQuote } from "./types";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FiveBellsCondition = require("five-bells-condition");

type Amount =  {
	currency: string;
	amount: string | null;
}

export class FspiopValidator {
	private static instance: FspiopValidator;

	private _currencyList: Currency[];

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	private constructor() {}
  
	static getInstance() {
		if (FspiopValidator.instance) {
			return this.instance;
		}
		this.instance = new FspiopValidator();

		return this.instance;
	}


	get currencyList(): Currency[] {
		return this._currencyList;
	}
	set currencyList(currencyList: Currency[]) {
		this._currencyList = currencyList;
	}

	public addCurrencyList(currencyList: Currency[]):Currency[] {
		return this.currencyList = currencyList;
	}


	currencyAndAmount(amount:Amount) {
		const currency = this._currencyList.find((currency) => currency.code === amount.currency);

		if(!currency) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": "must be equal to one of the allowed values - path: /body/amount/currency",
					"extensionList": {
						"extension": [
							{
								"key": "keyword",
								"value": "enum"
							},
							{
								"key": "instancePath",
								"value": "/body/amount/currency"
							},
							{
								"key": "allowedValues",
								"value": this._currencyList.map(currency => currency.code)
							}
						]
					}
				}
			});
		}


		if(amount.amount) {
			if(amount.amount === "0") {
				throw new ValidationdError({
					"errorInformation": {
						"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
						"errorDescription": "Transfer amount cannot be equal to 0",
						"extensionList": null
					}
				});
			}
			const decimalValue = amount.amount.toString().split(".");
			
			if(decimalValue.length === 2 && currency.decimals < decimalValue[1].length) {
				throw new ValidationdError({
					"errorInformation": {
						"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
						"errorDescription": `Amount exceeds allowed decimal points for participant account of ${amount.currency} currency`,
						"extensionList": null
					}
				});
			}
		}
	
		return this;
	}

	validateIlpAgainstQuoteResponse = (quoteResponseBody:PutQuote, decodedQuoteIlpPacket:DecodedIlpPacketQuote) => {

		if (quoteResponseBody.transferAmount.currency !== decodedQuoteIlpPacket.amount.currency) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": `Request body currency ${quoteResponseBody.transferAmount.currency} and ilpPacket ${decodedQuoteIlpPacket.amount.currency} are not the same`,
					"extensionList": null
				}
			});
		}
		if (quoteResponseBody.transferAmount.amount !== decodedQuoteIlpPacket.amount.amount) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": `Request body amount ${quoteResponseBody.transferAmount.amount} and ilpPacket ${decodedQuoteIlpPacket.amount.amount} are not the same`,
					"extensionList": null
				}
			});
		}
		return true;
	};
	
	
	validateIlpAgainstTransferRequest = (transferRequestBody:IPostTransfer, decodedTransferIlpPacket:DecodedIlpPacketTransfer) => {
	
		if (transferRequestBody.payerFsp !== decodedTransferIlpPacket.payer.partyIdInfo.fspId) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": `Request body payerFsp ${transferRequestBody.payerFsp} and ilpPacket ${decodedTransferIlpPacket.payer.partyIdInfo.fspId} are not the same`,
					"extensionList": null
				}
			});
		}
		if (transferRequestBody.payeeFsp !== decodedTransferIlpPacket.payee.partyIdInfo.fspId) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": `Request body payeeFsp ${transferRequestBody.payeeFsp} and ilpPacket ${decodedTransferIlpPacket.payee.partyIdInfo.fspId} are not the same`,
					"extensionList": null
				}
			});
		}
		if (transferRequestBody.amount.currency !== decodedTransferIlpPacket.amount.currency) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": `Request body currency ${transferRequestBody.amount.currency} and ilpPacket ${decodedTransferIlpPacket.amount.currency} are not the same`,
					"extensionList": null
				}
			});
		}
		if (transferRequestBody.amount.amount !== decodedTransferIlpPacket.amount.amount) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": `Request body amount ${transferRequestBody.amount.amount} and ilpPacket ${decodedTransferIlpPacket.amount.amount} are not the same`,
					"extensionList": null
				}
			});
		}
		return true;
	};

	validateCondition = (conditionUri:string) => {

		try {
			// NOTE: we add this prefix because it's a Named Information (NI) 
			const prefix = "ni:///sha-256;";
			if (!conditionUri.startsWith(prefix)) {
				conditionUri = prefix + conditionUri;
			}
			//prepare condition url
			const condition = `${conditionUri}?fpt=preimage-sha-256&cost=0`;
			
			FiveBellsCondition.validateCondition(condition);
		} catch (err) {
			throw new ValidationdError({
				"errorInformation": {
					"errorCode": ClientErrors.GENERIC_VALIDATION_ERROR.code,
					"errorDescription": "Invalid condition",
					"extensionList": null
				}
			});
		}
	};
		
	validateFulfil = (fulfilment:string, condition:string) => {
		const preimage = base64url.toBuffer(fulfilment);
	
		if (preimage.length !== 32) {
			return false;
		}
	
		const calculatedConditionDigest = Crypto.createHash("sha256").update(preimage).digest("base64");
		const calculatedConditionUrlEncoded = base64url.fromBase64(calculatedConditionDigest);
	
		return (calculatedConditionUrlEncoded === condition);
	};
}