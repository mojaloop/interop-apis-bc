/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

export type QuoteRequestReceivedDTO = {
    Params: {
        type: string; id: string
    },
    Body: {
        quoteId: string;
        transactionId: string;
        transactionRequestId: string | null;
        payee: {
            partyIdInfo: {
                partyIdType: string;
                partyIdentifier: string;
                partySubIdOrType: string | null;
                fspId: string | null;
            };
            merchantClassificationCode: string | null;
            name: string | null;
            personalInfo: {
                complexName: {
                    firstName: string | null;
                    middleName: string | null;
                    lastName: string | null;
                } | null;
                dateOfBirth: string | null;
                kycInformation: string | null; // TODO: Confirm this
            } | null;
            supportedCurrencies: string[] | null;
        };
        payer: {
            partyIdInfo: {
                partyIdType: string;
                partyIdentifier: string;
                partySubIdOrType: string | null;
                fspId: string | null;
            };
            merchantClassificationCode: string | null;
            name: string | null;
            personalInfo: {
                complexName: {
                    firstName: string | null;
                    middleName: string | null;
                    lastName: string | null;
                } | null;
                dateOfBirth: string | null;
                kycInformation: string | null; // TODO: Confirm this
            } | null;
            supportedCurrencies: string[] | null;
        };
        amountType: "SEND" | "RECEIVE";
        amount: {
            currency: string;
            amount: string;
        };
        transactionType: {
            scenario: string;
            subScenario: string | null;
            initiator: string;
            initiatorType: string;
            refundInfo: {
                originalTransactionId: string;
                refundReason: string | null;
            } | null;
            balanceOfPayments: string | null;
        };
        fees: {
            currency: string;
            amount: string;
        } | null;
        geoCode: {
            latitude: string;
            longitude: string;
        } | null;
        note: string | null;
        expiration: string | null;
        extensionList: {
            extension: {
                key: string;
                value: string;
            }[];
        } | null;
        converter: string | null;
        currencyConversion: {
            sourceAmount: {
                currency: string;
                amount: string;
            };
            targetAmount: {
                currency: string;
                amount: string;
            };
        } | null;
    }
}

export type QuoteResponseReceivedDTO = {
    Params: {
        type: string; id: string
    },
    Body: {
        quoteId: string;
        transferAmount: {
            currency: string;
            amount: string;
        };
        expiration: string;
        note: string | null;
        ilpPacket: string;
        condition: string;
        payeeReceiveAmount: {
            currency: string;
            amount: string;
        } | null;
        payeeFspFee: {
            currency: string;
            amount: string;
        } | null;
        payeeFspCommission: {
            currency: string;
            amount: string;
        } | null;
        geoCode: {
            latitude: string;
            longitude: string;
        } | null;
        extensionList: {
            extension: {
                key: string;
                value: string;
            }[];
        } | null;
    }
}

export type QuoteQueryReceivedDTO = {
    Params: {
        type: string; id: string
    },
}

export type QuoteRejectRequestDTO = {
    Params: {
        id: string
    },
    Body: {
        errorInformation: {
            errorCode: string;
            errorDescription: string;
            extensionList: {
                extension: {
                    key: string;
                    value: string;
                }[];
            } | null;
        }
    }
}
