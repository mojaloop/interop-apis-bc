/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License")

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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

export type BulkQuoteQueryReceivedDTO = { 
    Params: { 
        type: string; id: string 
    }, 
}

export type BulkQuoteRequestDTO = { 
    Params: { 
        type: string; id: string 
    }, 
    Body: {
        bulkQuoteId: string;
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
                kycInformation: string | null;
            } | null;
            supportedCurrencies: string[] | null;
        };
        geoCode: {
            latitude: string;
            longitude: string;
        } | null;
        expiration: string | null;
        individualQuotes: {
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
                    kycInformation: string | null;
                } | null;
                supportedCurrencies: string[] | null;
            };
            amountType: "SEND" | "RECEIVE";
            amount: {
                currency: string;
                amount: string;
            };
            fees: {
                currency: string;
                amount: string;
            } | null;
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
            note: string | null;
            extensionList: {
                extension: {
                    key: string;
                    value: string;
                }[];
            } | null;
        }[];
        extensionList: {
            extension: {
                key: string;
                value: string;
            }[];
        } | null;
    }
}

export type BulkQuotePendingDTO = { 
    Params: { 
        type: string; id: string 
    }, 
    Body: {
        bulkQuoteId: string;
        individualQuoteResults: {
            quoteId: string;
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
                    kycInformation: string | null;
                } | null;
                supportedCurrencies: string[] | null;
            } | null;
            transferAmount: {
                currency: string;
                amount: string;
            };
            payeeReceiveAmount: {
                currency: string;
                amount: string;
            };
            payeeFspFee: {
                currency: string;
                amount: string;
            };
            payeeFspCommission: {
                currency: string;
                amount: string;
            };
            ilpPacket: string;
            condition: string;
            errorInformation: {
                errorCode: string;
                errorDescription: string;
                extensionList: {
                    extension: {
                        key: string;
                        value: string;
                    }[];
                };
            } | null;
            extensionList: {
                extension: {
                    key: string;
                    value: string;
                }[];
            } | null;
        }[];
        expiration: string | null;
        extensionList: {
            extension: {
                key: string;
                value: string;
            }[];
        } | null;
    }
}

export type BulkQuoteRejectRequestDTO = { 
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