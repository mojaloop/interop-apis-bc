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

export type BulkTransferQueryReceivedDTO = {
    Params: {
        id: string
    }
}

export type BulkTransferPrepareRequestDTO = {
    Params: {
        id: string
    },
    Body: {
        bulkTransferId: string;
        bulkQuoteId: string;
        payerFsp: string;
        payeeFsp: string;
        expiration: string;
        individualTransfers: {
            transferId: string;
            transferAmount: {
                currency: string;
                amount: string;
            };
            ilpPacket: string;
            condition: string;
            payerIdType: string;
            payeeIdType: string;
            transferType: string;
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

export type BulkTransferFulfilRequestedDTO = {
    Params: {
        id: string
    },
    Body: {
        completedTimestamp: number;
        bulkTransferState: "PENDING" | "ACCEPTED" | "PROCESSING" | "COMPLETED" | "REJECTED";
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
}

export type BulkTransfersRejectRequestDTO = {
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
