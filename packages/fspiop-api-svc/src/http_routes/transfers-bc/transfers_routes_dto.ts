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

export type TransferPrepareRequestedDTO = {
    Params: {
        id: string
    },
    Body: {
        transferId: string;
        payeeFsp: string;
        payerFsp: string;
        amount: {
            currency: string,
            amount: string
        },
        ilpPacket: string;
        condition: string;
        expiration: string;
        extensionList: {
            extension: {
                key: string;
                value: string;
            }[];
        } | null;
    }
}

export type TransferFulfilRequestedDTO = {
    Params: {
        id: string
    },
    Body: {
        transferState: "PENDING" | "ACCEPTED" | "PROCESSING" | "COMPLETED" | "REJECTED";
        fulfilment: string | null;
        completedTimestamp: Date;
        extensionList: {
            extension: {
                key: string;
                value: string;
            }[];
        } | null;
        notifyPayee: boolean;
    }
}

export type TransferRejectRequestedDTO = {
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

export type TransferQueryReceivedDTO = {
    Params: {
        id: string
    }
}
