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

  }