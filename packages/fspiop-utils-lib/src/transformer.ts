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
    QuoteQueryResponseEvtPayload,
    TransferPreparedEvtPayload,
    TransferFulfiledEvtPayload,
    TransferQueryResponseEvtPayload,
    TransferRejectRequestProcessedEvtPayload,
    BulkTransferPreparedEvtPayload,
    BulkTransferFulfiledEvtPayload,
    BulkTransferQueryResponseEvtPayload,
    BulkTransferRejectRequestProcessedEvtPayload,
    PartyRejectedResponseEvtPayload,
    ParticipantRejectedResponseEvtPayload,
    QuoteRejectedResponseEvtPayload,
    BulkQuoteRejectedResponseEvtPayload
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {
    ExtensionList,
    FspiopError,
    GetBulkTransfer,
    GetTransfer,
    PostBulkQuote,
    PostBulkTransfer,
    PostQuote,
    IPostTransfer,
    PutBulkQuote,
    PutBulkTransfer,
    PutParticipant,
    PutParty,
    PutQuote,
    PutTransfer,
    IPutQuoteOpaqueState,
    IPostQuoteOpaqueState,
    IPostBulkQuoteOpaqueState,
    IPutBulkQuoteOpaqueState,
    IPostTransferOpaqueState,
    IPutTransferOpaqueState,
    IPutBulkTransferOpaqueState,
    IPutPartyOpaqueState
} from "./types";

export class FspiopTransformer {

    /* eslint-disable @typescript-eslint/no-explicit-any */
    static removeEmpty(obj: any) {
        Object.entries(obj).forEach(([key, val]) => {
            if (val instanceof Date) {
                return;
            }

            if (val && typeof val === "object") {
                FspiopTransformer.removeEmpty(val);

                if (Object.keys(val).length === 0) {
                    delete obj[key];
                }
            } else if (val === null || val === "" || val === undefined) {
                delete obj[key];
            }
        });
        return obj;
    }

    static transformPayloadParticipantPut(payload: ParticipantAssociationCreatedEvtPayload | ParticipantQueryResponseEvtPayload): PutParticipant {
        return {
            fspId: payload.ownerFspId
        };
    }

    static transformPayloadPartyAssociationPut(payload: ParticipantAssociationCreatedEvtPayload): PutParty {
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

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadPartyDisassociationPut(payload: ParticipantAssociationRemovedEvtPayload): PutParty {
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

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadPartyInfoRequestedPut(payload: PartyInfoRequestedEvtPayload): PutParty {
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
        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadPartyInfoReceivedPut(payload: PartyQueryResponseEvtPayload, protocolValues?: IPutPartyOpaqueState): PutParty {
        const correctPayload = {
            party: {
                partyIdInfo: {
                    partyIdType: payload.partyType,
                    partyIdentifier: payload.partyId,
                    partySubIdOrType: payload.partySubType,
                    fspId: payload.ownerFspId,
                    extensionList: this.revertToExtensionList(payload.extensions),
                },
                merchantClassificationCode: payload.merchantClassificationCode,
                name: payload.name,
                personalInfo: {
                    complexName: {
                        firstName: payload.firstName,
                        middleName: payload.middleName,
                        lastName: payload.lastName
                    },
                    dateOfBirth: payload.partyDoB,
                    kycInformation: payload.kycInfo,
                },
                supportedCurrencies: payload.supportedCurrencies,
            }
        };

        return FspiopTransformer.removeEmpty(correctPayload);
    }

    static transformPayloadError({
        errorCode,
        errorDescription,
        extensionList = null
    }: {
        errorCode: string,
        errorDescription: string,
        extensionList?: ExtensionList | null
    }): FspiopError {
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
    }

    static transformPayloadQuotingRequestPost(payload: QuoteRequestAcceptedEvtPayload, protocolValues: IPostQuoteOpaqueState): PostQuote {
        const info: PostQuote = {
            quoteId: payload.quoteId,
            transactionId: payload.transactionId,
            payee: payload.payee,
            payer: payload.payer,
            amountType: payload.amountType,
            amount: payload.amount,
            transactionType: payload.transactionType,
            expiration: payload.expiration,
            note: payload.note,
            extensionList: this.revertToExtensionList(payload.extensions)
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadQuotingResponsePut(payload: QuoteResponseAcceptedEvtPayload, protocolValues: IPutQuoteOpaqueState): PutQuote {
        const info: PutQuote = {
            transferAmount: payload.transferAmount,
            expiration: payload.expiration,
            note: payload.note,
            payeeReceiveAmount: payload.payeeReceiveAmount,
            payeeFspFee: payload.payeeFspFee,
            payeeFspCommission: payload.payeeFspCommission,
            geoCode: payload.geoCode,
            extensionList: this.revertToExtensionList(payload.extensions),

            // OpaqueState
            ilpPacket: protocolValues.ilpPacket,
            condition: protocolValues.condition,
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadQuotingResponseGet(payload: QuoteQueryResponseEvtPayload, protocolValues: IPutQuoteOpaqueState): PutQuote {
        const info: PutQuote = {
            transferAmount: payload.transferAmount,
            expiration: payload.expiration,
            note: payload.note,
            payeeReceiveAmount: payload.payeeReceiveAmount,
            payeeFspFee: payload.payeeFspFee,
            payeeFspCommission: payload.payeeFspCommission,
            geoCode: payload.geoCode,
            extensionList: this.revertToExtensionList(payload.extensions),

            // OpaqueState
            ilpPacket: protocolValues.ilpPacket,
            condition: protocolValues.condition,
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkQuotingResponsePost(payload: BulkQuoteReceivedEvtPayload, protocolValues: IPostBulkQuoteOpaqueState): PostBulkQuote {
        const info: PostBulkQuote = {
            bulkQuoteId: payload.bulkQuoteId,
            payer: payload.payer,
            geoCode: payload.geoCode,
            expiration: payload.expiration,
            individualQuotes: payload.individualQuotes.map((quote:typeof payload.individualQuotes[number]) => {
                return {
                    ...quote,
                    fees: quote.feesPayer,
                    extensionList: this.revertToExtensionList(quote.extensions)
                };
            }),
            extensionList: this.revertToExtensionList(payload.extensions)
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkQuotingResponsePut(payload: BulkQuoteAcceptedEvtPayload, protocolValues: IPutBulkQuoteOpaqueState): PutBulkQuote {
        const info: PutBulkQuote = {
            bulkQuoteId: payload.bulkQuoteId,
            individualQuoteResults: payload.individualQuoteResults.map((quote:typeof payload.individualQuoteResults[number]) => {
                return {
                    ...quote,
                    errorInformation: quote.errorInformation ? {
                        errorCode: quote.errorInformation.errorCode,
                        errorDescription: quote.errorInformation.errorDescription,
                        extensionList: this.revertToExtensionList(quote.errorInformation.extensions),
                    } : null,
                    ilpPacket: protocolValues.ilpPacket,
                    condition: protocolValues.condition,
                    extensionList: this.revertToExtensionList(quote.extensions)
                };
            }),
            expiration: payload.expiration,
            extensionList: this.revertToExtensionList(payload.extensions)
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadQuotingRequestPutError(payload: QuoteRejectedResponseEvtPayload): FspiopError {
        const info: FspiopError = {
            errorInformation: payload.errorInformation
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkQuotingRequestPutError(payload: BulkQuoteRejectedResponseEvtPayload): FspiopError {
        const info: FspiopError = {
            errorInformation: payload.errorInformation
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadTransferRequestPost(payload: TransferPreparedEvtPayload, protocolValues: IPostTransferOpaqueState): IPostTransfer {
        const info: IPostTransfer = {
            transferId: payload.transferId,
            payeeFsp: payload.payeeFsp,
            payerFsp: payload.payerFsp,
            amount: {
                amount: payload.amount,
                currency: payload.currencyCode
            },
            expiration: new Date(payload.expiration).toISOString(),
            extensionList: this.revertToExtensionList(payload.extensions),

            // OpaqueState
            ilpPacket: protocolValues.ilpPacket,
            condition: protocolValues.condition,
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadTransferRequestPut(payload: TransferFulfiledEvtPayload, protocolValues: IPutTransferOpaqueState): PutTransfer {
        const info: PutTransfer = {
            transferState: "COMMITTED",
            completedTimestamp: new Date(payload.completedTimestamp).toISOString(),
            extensionList: this.revertToExtensionList(payload.extensions),

            // OpaqueState
            fulfilment: protocolValues.fulfilment,
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadTransferRequestGet(payload: TransferQueryResponseEvtPayload, protocolValues: IPutTransferOpaqueState): GetTransfer {
        const info: GetTransfer = {
            transferState: "COMMITTED",
            completedTimestamp: payload.completedTimestamp ? new Date(payload.completedTimestamp).toJSON() : null,
            extensionList: this.revertToExtensionList(payload.extensions),

            // OpaqueState
            fulfilment: protocolValues.fulfilment,
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadTransferRequestPutError(payload: TransferRejectRequestProcessedEvtPayload): FspiopError {
        const info: FspiopError = {
            errorInformation: payload.errorInformation
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkTransferRequestPost(payload: BulkTransferPreparedEvtPayload, protocolValues: IPutBulkTransferOpaqueState): PostBulkTransfer {
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
            extensionList: this.revertToExtensionList(payload.extensions),
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkTransferRequestPut(payload: BulkTransferFulfiledEvtPayload, protocolValues: IPutBulkTransferOpaqueState): PutBulkTransfer {
        const info: PutBulkTransfer = {
            completedTimestamp: payload.completedTimestamp,
            bulkTransferState: payload.bulkTransferState,
            individualTransferResults: payload.individualTransferResults.map((transfer:typeof payload.individualTransferResults[number]) => {
                return {
                    ...transfer,
                    errorInformation: transfer.errorInformation && {
                        errorCode: transfer.errorInformation.errorCode,
                        errorDescription: transfer.errorInformation.errorDescription,
                        extensionList: this.revertToExtensionList(transfer.errorInformation.extensions),
                    },
                    fulfilment: protocolValues.fulfilment,
                    extensionList: this.revertToExtensionList(transfer.extensions),
                };
            }),
            extensionList: this.revertToExtensionList(payload.extensions),
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkTransferRequestGet(payload: BulkTransferQueryResponseEvtPayload, protocolValues?: any): GetBulkTransfer {
        const info: GetBulkTransfer = {
            completedTimestamp: payload.completedTimestamp,
            bulkTransferState: payload.bulkTransferState,
            individualTransferResults: payload.individualTransferResults,
            ...protocolValues
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadBulkTransferRequestPutError(payload: BulkTransferRejectRequestProcessedEvtPayload): FspiopError {
        const info: FspiopError = {
            errorInformation: payload.errorInformation
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadPartyRejectedPut(payload: PartyRejectedResponseEvtPayload): FspiopError {
        const info: FspiopError = {
            errorInformation: payload.errorInformation
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static transformPayloadParticipantRejectedPut(payload: ParticipantRejectedResponseEvtPayload): FspiopError {
        const info: FspiopError = {
            errorInformation: {
                errorCode: payload.errorInformation.errorCode,
                errorDescription: payload.errorInformation.errorDescription,
                extensionList: this.revertToExtensionList(payload.errorInformation.extensions),
            }
        };

        return FspiopTransformer.removeEmpty(info);
    }

    static convertToFlatExtensions(extensionList: {
        extension: {
            key: string;
            value: string;
        }[];
    } | null) {
        return extensionList?.extension ? extensionList.extension : [];
    }

    static revertToExtensionList(extension: any): ExtensionList | null {
        if (!extension || extension.length === 0) {
            return null;
        }

        return {
            extension: extension
        };
    }
}
