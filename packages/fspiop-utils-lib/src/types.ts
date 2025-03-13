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

* Gates Foundation
- Name Surname <name.surname@gatesfoundation.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

// Error & Custom value fields


export interface ExtensionList {
	extension: {
		key: string,
		value: string
	}[]
}

export interface IInputExtensionList {
    extensionList: {
        extension: ExtensionList[];
    } | null;
}

export interface FspiopError {
	errorInformation: {
		errorCode: string,
		errorDescription: string,
		extensionList?: ExtensionList | null
	}
}

// Account Lookup
export interface PostParticipant {
	fspId: string;
}

export interface PutParticipant {
	fspId: string,
}

export interface PutParty {
	party: {
		partyIdInfo: {
			partyIdType: string,
			partyIdentifier: string,
			partySubIdOrType: string | null,
			fspId: string,
			extensionList?: ExtensionList
		}
	},
	merchantClassificationCode?: string,
	name: string,
	personalInfo: {
		complexName: {
			firstName: string,
			middleName: string,
			lastName: string
		},
		dateOfBirth: Date | null,
		kycInformation: string | null,
	}
	supportedCurrencies: string[] | null,
}

export interface IPutPartyOpaqueState {
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}


// Quoting
export interface IPostQuoteOpaqueState {
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export interface PostQuote {
	quoteId: string,
	transactionId: string,
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
		} | null;
	},
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
		} | null;
	},
	amountType: "SEND" | "RECEIVE",
	amount: {
		currency: string;
		amount: string;
	},
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
	},
	expiration: string | null;
	note: string | null;
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null;
}

export interface IPutQuoteOpaqueState {
	ilpPacket: string;
	condition: string;
	extensionList: {
		extension: {
			key: string;
			value: string;
		}[];
	} | null
}

export interface PutQuote {
	transferAmount: {
		currency: string,
		amount: string,
	},
	expiration: string,
	note: string | null,
	ilpPacket: string,
	condition: string,
	payeeReceiveAmount: {
		currency: string,
		amount: string,
	} | null,
	payeeFspFee: {
		currency: string,
		amount: string,
	} | null,
	payeeFspCommission: {
		currency: string,
		amount: string,
	} | null,
	geoCode: {
		latitude: string,
		longitude: string,
	} | null,
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export interface IPostBulkQuoteOpaqueState {
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export interface PostBulkQuote {
	bulkQuoteId: string,
	payer: {
		partyIdInfo: {
			partyIdType: string,
			partyIdentifier: string,
			partySubIdOrType: string | null,
			fspId: string | null,
		};
		merchantClassificationCode: string | null,
		name: string | null,
		personalInfo: {
			complexName: {
				firstName: string | null,
				middleName: string | null,
				lastName: string | null,
			} | null,
			dateOfBirth: string | null,
		} | null,
	},
	geoCode: {
		latitude: string,
		longitude: string,
	} | null,
	expiration: string | null,
	individualQuotes: {
		quoteId: string,
		transactionId: string,
		payee: {
			partyIdInfo: {
				partyIdType: string,
				partyIdentifier: string,
				partySubIdOrType: string | null,
				fspId: string | null,
			},
			merchantClassificationCode: string | null,
			name: string | null,
			personalInfo: {
				complexName: {
					firstName: string | null,
					middleName: string | null,
					lastName: string | null,
				} | null,
				dateOfBirth: string | null,
			} | null,
		},
		amountType: "SEND" | "RECEIVE",
		amount: {
			currency: string,
			amount: string,
		},
		fees: {
			currency: string,
			amount: string,
		} | null,
		transactionType: {
			scenario: string,
			subScenario: string | null,
			initiator: string,
			initiatorType: string,
			refundInfo: {
				originalTransactionId: string,
				refundReason: string | null,
			} | null,
			balanceOfPayments: string | null,
		},
		note: string | null,
		extensionList: {
			extension: {
				key: string,
				value: string,
			}[],
		} | null,
	}[],
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export interface IPutBulkQuoteOpaqueState {
	ilpPacket: string;
	condition: string;
	extensionList: {
		extension: {
			key: string;
			value: string;
		}[];
	} | null;
}

export interface PutBulkQuote {
	bulkQuoteId: string,
	individualQuoteResults: {
		quoteId: string,
		payee: {
			partyIdInfo: {
				partyIdType: string,
				partyIdentifier: string,
				partySubIdOrType: string | null,
				fspId: string | null,
			},
			merchantClassificationCode: string | null,
			name: string | null,
			personalInfo: {
				complexName: {
					firstName: string | null,
					middleName: string | null,
					lastName: string | null,
				} | null,
				dateOfBirth: string | null,
			} | null,
		} | null,
		transferAmount: {
			currency: string,
			amount: string,
		} | null,
		payeeReceiveAmount: {
			currency: string,
			amount: string,
		} | null,
		payeeFspFee: {
			currency: string,
			amount: string,
		} | null,
		payeeFspCommission: {
			currency: string,
			amount: string,
		} | null,
		ilpPacket: string | null,
		condition: string | null,
		errorInformation: {
			errorCode: string,
			errorDescription: string,
			extensionList: {
				extension: {
					key: string,
					value: string,
				}[],
			} | null,
		} | null,
		extensionList: {
			extension: {
				key: string,
				value: string,
			}[],
		} | null,
	}[],
	expiration: string | null,
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null,
}


// Transfer
export interface IPostTransferOpaqueState {
	ilpPacket: string;
	condition: string;
	extensionList: {
		extension: {
			key: string;
			value: string;
		}[];
	} | null
}

export interface IPostTransfer {
	transferId: string,
	payeeFsp: string,
	payerFsp: string,
	amount: {
		currency: string;
		amount: string;
	},
	ilpPacket: string,
	condition: string,
	expiration: string;
	extensionList: {
		extension: {
			key: string;
			value: string;
		}[];
	} | null
}

export interface IPutTransferOpaqueState {
	fulfilment: string | null,
	extensionList: {
		extension: {
			key: string;
			value: string;
		}[];
	} | null
}

export interface PutTransfer {
	transferState: string,
	fulfilment: string | null,
	completedTimestamp: string,
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export interface GetTransfer {
	transferState: string,
	fulfilment: string | null,
	completedTimestamp: string | null,
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}


export interface IPostBulkTransferOpaqueState {
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export interface PostBulkTransfer {
    bulkTransferId: string;
    bulkQuoteId: string;
    payeeFsp: string;
    payerFsp: string;
    expiration: string;
    individualTransfers: {
        transferId: string;
        amount: string;
        currencyCode: string;
        ilpPacket: string;
        condition: string;
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

export interface IPutBulkTransferOpaqueState {
	fulfilment: string | null;
	extensionList: {
		extension: {
			key: string;
			value: string;
		}[];
	} | null;
}
export interface PutBulkTransfer {
    completedTimestamp: number;
    bulkTransferState: string;
    individualTransferResults: {
        transferId: string;
        fulfilment: string | null;
        errorInformation: {
            errorCode: string;
            errorDescription: string;
            extensionList: {
                extension: {
                    key: string;
                    value: string;
                }[];
            } | null;
        } | null;
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

export interface GetBulkTransfer {
    completedTimestamp: number | null;
	bulkTransferState: string;
    individualTransferResults: {
        transferId: string;
        fulfilment: string | null;
        errorInformation: {
            errorCode: string;
            errorDescription: string;
            extensionList: {
                extension: {
                    key: string;
                    value: string;
                }[];
            } | null;
        };
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