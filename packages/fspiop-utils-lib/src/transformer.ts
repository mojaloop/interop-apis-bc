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
	Object.entries(obj).forEach(([key, val])  =>
		(val && typeof val === 'object') && removeEmpty(val) ||
		(val === null || val === "") && delete obj[key]
	);
	return obj;
};


export interface PutParticipant {
	fspId: string,
}

export const transformPayloadParticipantPut = (payload: ParticipantQueryResponseEvtPayload):PutParticipant => {
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

export const transformPayloadPartyAssociationPut = (payload: ParticipantAssociationCreatedEvtPayload):PutParty => {
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

export const transformPayloadPartyDisassociationPut = (payload: ParticipantAssociationRemovedEvtPayload):Pick<PutParty, 'party'> => {
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

export const transformPayloadPartyInfoRequestedPut = (payload: PartyInfoRequestedEvtPayload):Pick<PutParty, 'party'> => {
	return {
		party: {
			partyIdInfo: {
				partyIdType: payload.partyType,
				partyIdentifier: payload.partyId,
				partySubIdOrType: payload.partySubType,
				fspId: payload.requesterFspId,
			}
		},
	};
};

export const transformPayloadPartyInfoReceivedPut = (payload: PartyQueryResponseEvtPayload):PutParty => {
	const correctPayload = {
		party: {
			partyIdInfo: {
				partyIdType: payload.partyType,
				partyIdentifier: payload.partyId,
				partySubIdOrType: payload.partySubType,
				fspId: payload.requesterFspId,
			}
		},
		name: payload.partyName,
		personalInfo: {
			complexName: {
				firstName: payload.partyName,
				middleName: payload.partyName,
				lastName: payload.partyName
			},
			dateOfBirth: payload.partyDoB
		}
	};

	return removeEmpty(correctPayload);
};

export const transformPayloadError = ({
		errorCode,
		errorDescription,
		extensionList = null
	}:{
		errorCode: string,
		errorDescription: string,
		extensionList?: ExtensionList | null
	}):FspiopError => {
		const payload:FspiopError = {
			errorInformation: {
				errorCode: errorCode,
				errorDescription: errorDescription,
			}
		};

		if(extensionList) {
			payload.errorInformation.extensionList = extensionList;
		}

		return payload;
	};

// Quoting

export const transformPayloadQuotingRequestPost = (payload: QuoteRequestAcceptedEvtPayload):any => {
	const info = {
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

export const transformPayloadQuotingResponsePut = (payload: QuoteResponseAcceptedEvtPayload):any => {
	const info = {
		quoteId: payload.quoteId,
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

export const transformPayloadBulkQuotingResponsePost = (payload: BulkQuoteReceivedEvtPayload):any => {
	const info = {
        bulkQuoteId: payload.bulkQuoteId,
        payer: payload.payer,
		geoCode: payload.geoCode,
		expiration: payload.expiration,
        individualQuotes: payload.individualQuotes,
		extensionList: payload.extensionList
    };

	return removeEmpty(info);
};

export const transformPayloadBulkQuotingResponsePut = (payload: BulkQuoteAcceptedEvtPayload):any => {
	const info = {
		bulkQuoteId: payload.bulkQuoteId,
		individualQuoteResults: payload.individualQuoteResults,
		expiration: payload.expiration,
		extensionList: payload.extensionList
    };

	return removeEmpty(info);
};

// Transfer

export const transformPayloadTransferRequestPost = (payload: TransferPreparedEvtPayload):any => {
	const info = {
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

export const transformPayloadTransferRequestPut = (payload: TransferCommittedFulfiledEvtPayload):any => {
	const info = {
		transferId: payload.transferId,
		transferState: "COMMITTED",
		fulfilment: payload.fulfilment,
		completedTimestamp: payload.completedTimestamp,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadTransferRequestGet = (payload: TransferQueryResponseEvtPayload):any => {
	const info = {
		transferId: payload.transferId,
		transferState: payload.transferState,
		completedTimestamp: payload.completedTimestamp,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};