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
	TransferFulfiledEvtPayload,
	TransferQueryResponseEvtPayload,
	TransferRejectRequestProcessedEvtPayload,
	BulkTransferPreparedEvtPayload,
	BulkTransferFulfiledEvtPayload,
	BulkTransferQueryResponseEvtPayload,
	BulkTransferRejectRequestProcessedEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { 
	ExtensionList,
	FspiopError,
	GetBulkTransfer,
	GetTransfer,
	PostBulkQuote,
	PostBulkTransfer,
	PostQuote,
	PostTransfer,
	PutBulkQuote,
	PutBulkTransfer,
	PutParticipant,
	PutParty,
	PutQuote,
	PutTransfer 
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const removeEmpty = (obj: any) => {
	Object.entries(obj).forEach(([key, val]) =>
		(val && typeof val === 'object') && removeEmpty(val) ||
		(val === null || val === "") && delete obj[key]
	);
	return obj;
};

export const transformPayloadParticipantPut = (payload: ParticipantQueryResponseEvtPayload): PutParticipant => {
	return {
		fspId: payload.ownerFspId
	};
};

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
				extensionList: payload.extensionList
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


export const transformPayloadQuotingRequestPost = (payload: QuoteRequestAcceptedEvtPayload): PostQuote => {
	const info: PostQuote = {
		quoteId: payload.quoteId,
		transactionId: payload.transactionId,
		payee: payload.payee,
		payer: payload.payer,
		amountType: payload.amountType,
		amount: payload.amount,
		transactionType: payload.transactionType,
		expiration: payload.expiration,
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

export const transformPayloadQuotingResponseGet = (payload: QuoteResponseAcceptedEvtPayload): PutQuote => {
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
		individualQuotes: payload.individualQuotes.map((quote:typeof payload.individualQuotes[number]) => {
			return {
				...quote,
				fees: quote.feesPayer
			};
		}),
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

export const transformPayloadTransferRequestPut = (payload: TransferFulfiledEvtPayload): PutTransfer => {
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
		transferState: "COMMITTED",
		fulfilment: payload.fulfilment,
		completedTimestamp: payload.completedTimestamp ? new Date(payload.completedTimestamp).toJSON() : null,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadTransferRequestPutError = (payload: TransferRejectRequestProcessedEvtPayload): FspiopError => {
	const info: FspiopError = {
		errorInformation: payload.errorInformation
	};

	return removeEmpty(info);
};

export const transformPayloadBulkTransferRequestPost = (payload: BulkTransferPreparedEvtPayload): PostBulkTransfer => {
	const info: PostBulkTransfer = {
		bulkTransferId: payload.bulkTransferId,
		bulkQuoteId: payload.bulkQuoteId,
		payeeFsp: payload.payeeFsp,
		payerFsp: payload.payerFsp,
		expiration: new Date(payload.expiration).toISOString(),
		individualTransfers: payload.individualTransfers.map((individualTransfer: any) => {
			return {
				...individualTransfer,
				transferAmount: {
					amount: individualTransfer.amount,
					currency: individualTransfer.currencyCode
				}
			};
		}),
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadBulkTransferRequestPut = (payload: BulkTransferFulfiledEvtPayload): PutBulkTransfer => {
	const info: PutBulkTransfer = {
		completedTimestamp: payload.completedTimestamp,
		bulkTransferState: payload.bulkTransferState,
		individualTransferResults: payload.individualTransferResults,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadBulkTransferRequestGet = (payload: BulkTransferQueryResponseEvtPayload): GetBulkTransfer => {
	const info: GetBulkTransfer = {
		completedTimestamp: payload.completedTimestamp,
		bulkTransferState: payload.bulkTransferState,
		individualTransferResults: payload.individualTransferResults,
		extensionList: payload.extensionList
	};

	return removeEmpty(info);
};

export const transformPayloadBulkTransferRequestPutError = (payload: BulkTransferRejectRequestProcessedEvtPayload): FspiopError => {
	const info: FspiopError = {
		errorInformation: payload.errorInformation
	};

	return removeEmpty(info);
};