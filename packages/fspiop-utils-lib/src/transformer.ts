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

'use strict';

import {
	BulkQuoteReceivedEvtPayload,
	BulkQuoteAcceptedEvtPayload,
	ParticipantAssociationCreatedEvtPayload,
	ParticipantAssociationRemovedEvtPayload,
	ParticipantQueryResponseEvtPayload,
	PartyInfoRequestedEvtPayload,
	PartyQueryResponseEvtPayload,
	QuoteRequestAcceptedEvtPayload,
	QuoteResponseAcceptedEvtPayload,
	TransferPreparedEvtPayload,
	TransferCommittedFulfiledEvtPayload,
	TransferQueryResponseEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ExtensionList {
	extension: {
		key: string,

		value: string
	}[]
}
export interface FspiopError {
	errorInformation: {
		errorCode: string,
		errorDescription: string,
		extensionList?: ExtensionList | null
	}
}



export const removeEmpty = (obj: any) => {
	Object.entries(obj).forEach(([key, val]) =>
		(val && typeof val === 'object') && removeEmpty(val) ||
		(val === null || val === "") && delete obj[key]
	);
	return obj;
};


export interface PutParticipant {
	fspId: string,
}

export const transformPayloadParticipantPut = (payload: ParticipantQueryResponseEvtPayload): PutParticipant => {
	return {
		fspId: payload.ownerFspId
	};
};

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
		dateOfBirth: Date | null
	}
}

export const transformPayloadPartyAssociationPut = (payload: ParticipantAssociationCreatedEvtPayload): PutParty => {
	const info = {
		party: {
			partyIdInfo: {
				partyIdType: payload.partyType,
				partyIdentifier: payload.partyId,
				partySubIdOrType: payload.partySubType,
				fspId: payload.ownerFspId,
			}
		},
	};

	return removeEmpty(info);
};

export const transformPayloadPartyDisassociationPut = (payload: ParticipantAssociationRemovedEvtPayload): PutParty => {
	const info = {
		party: {
			partyIdInfo: {
				partyIdType: payload.partyType,
				partyIdentifier: payload.partyId,
				partySubIdOrType: payload.partySubType,
				fspId: payload.ownerFspId,
			}
		},
	};

	return removeEmpty(info);
};

export const transformPayloadPartyInfoRequestedPut = (payload: PartyInfoRequestedEvtPayload): PutParty => {
	const info = {
		party: {
			partyIdInfo: {
				partyIdType: payload.partyType,
				partyIdentifier: payload.partyId,
				partySubIdOrType: payload.partySubType,
				fspId: payload.requesterFspId
			}
		},
	};
	return removeEmpty(info);
};

export const transformPayloadPartyInfoReceivedPut = (payload: PartyQueryResponseEvtPayload): PutParty => {
	const correctPayload = {
		party: {
			partyIdInfo: {
				partyIdType: payload.partyType,
				partyIdentifier: payload.partyId,
				partySubIdOrType: payload.partySubType,
				fspId: payload.ownerFspId,
			},
			merchantClassificationCode: payload.merchantClassificationCode,
			name: payload.name,
			personalInfo: {
				complexName: {
					firstName: payload.firstName,
					middleName: payload.middleName,
					lastName: payload.lastName
				},
				dateOfBirth: payload.partyDoB
			}
		}
	};

	return removeEmpty(correctPayload);
};

export const transformPayloadError = ({
	errorCode,
	errorDescription,
	extensionList = null
}: {
	errorCode: string,
	errorDescription: string,
	extensionList?: ExtensionList | null
}): FspiopError => {
	const payload: FspiopError = {
		errorInformation: {
			errorCode: errorCode,
			errorDescription: errorDescription,
		}
	};

	if (extensionList) {
		payload.errorInformation.extensionList = extensionList;
	}

	return payload;
};

// Quoting

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
	}
}

export interface PutQuote {
	transferAmount: {
		currency: string,
		amount: string,
	},
	expiration: string,
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
		ilpPacket: string,
		condition: string,
		errorInformation: {
			errorCode: string,
			errorDescription: string,
			extensionList: {
				extension: {
					key: string,
					value: string,
				}[],
			},
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

export const transformPayloadQuotingRequestPost = (payload: QuoteRequestAcceptedEvtPayload): PostQuote => {
	const info: PostQuote = {
		quoteId: payload.quoteId,
		transactionId: payload.transactionId,
		payee: payload.payee,
		payer: payload.payer,
		amountType: payload.amountType,
		amount: payload.amount,
		transactionType: payload.transactionType
	};

	return removeEmpty(info);
};

export const transformPayloadQuotingResponsePut = (payload: QuoteResponseAcceptedEvtPayload): PutQuote => {
	const info: PutQuote = {
		transferAmount: payload.transferAmount,
		expiration: payload.expiration,
		ilpPacket: payload.ilpPacket,
		condition: payload.condition,
		payeeReceiveAmount: payload.payeeReceiveAmount,
		payeeFspFee: payload.payeeFspFee,
		payeeFspCommission: payload.payeeFspCommission,
		geoCode: payload.geoCode,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadBulkQuotingResponsePost = (payload: BulkQuoteReceivedEvtPayload): PostBulkQuote => {
	const info: PostBulkQuote = {
		bulkQuoteId: payload.bulkQuoteId,
		payer: payload.payer,
		geoCode: payload.geoCode,
		expiration: payload.expiration,
		individualQuotes: payload.individualQuotes,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadBulkQuotingResponsePut = (payload: BulkQuoteAcceptedEvtPayload): PutBulkQuote => {
	const info: PutBulkQuote = {
		bulkQuoteId: payload.bulkQuoteId,
		individualQuoteResults: payload.individualQuoteResults,
		expiration: payload.expiration,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

// Transfer
export interface PostTransfer {
	transferId: string,
	payeeFsp: string,
	payerFsp: string,
	amount: {
		currency: string;
		amount: string;
	},
	ilpPacket: string,
	condition: string,
	expiration: number
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
	transferId: string,
	transferState: string,
	fulfilment: string | null,
	completedTimestamp: number | null,
	extensionList: {
		extension: {
			key: string,
			value: string,
		}[],
	} | null
}

export const transformPayloadTransferRequestPost = (payload: TransferPreparedEvtPayload): PostTransfer => {
	const info: PostTransfer = {
		transferId: payload.transferId,
		payeeFsp: payload.payeeFsp,
		payerFsp: payload.payerFsp,
		amount: {
			amount: payload.amount,
			currency: payload.currencyCode
		},
		ilpPacket: payload.ilpPacket,
		condition: payload.condition,
		expiration: payload.expiration,
	};

	return removeEmpty(info);
};

export const transformPayloadTransferRequestPut = (payload: TransferCommittedFulfiledEvtPayload): PutTransfer => {
	const info: PutTransfer = {
		transferState: "COMMITTED",
		fulfilment: payload.fulfilment,
		completedTimestamp: new Date(payload.completedTimestamp).toJSON(),
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadTransferRequestGet = (payload: TransferQueryResponseEvtPayload): GetTransfer => {
	const info: GetTransfer = {
		transferId: payload.transferId,
		transferState: payload.transferState,
		completedTimestamp: payload.completedTimestamp,
		fulfilment: payload.fulfilment,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};