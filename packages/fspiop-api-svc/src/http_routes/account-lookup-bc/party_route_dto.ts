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

export type GetPartyQueryReceivedByTypeAndIdDTO = { 
    Params: { 
        type: string; 
        id: string; 
    }, 
    Querystring: { 
        currency: string;
    } 
}

export type GetPartyQueryReceivedByTypeAndIdSubIdDTO = { 
    Params: { 
        type: string; 
        id: string;
        subid: string;
    }, 
    Querystring: { 
        currency: string;
    } 
}

export type GetPartyInfoAvailableByTypeAndIdDTO = { 
    Params: { 
        type: string;
        id: string 
    }, 
    Querystring: { 
        currency: string 
    }, 
    Body: { 
        party: {
            partyIdInfo: {
                fspId: string;
                extensionList: {
                    extension: {
                        key: string;
                        value: string;
                    }[];
                } | null;
            }
            name: string;
            merchantClassificationCode: string;
            personalInfo: {
                complexName: {
                    firstName: string;
                    middleName: string;
                    lastName: string;
                }
                dateOfBirth: Date | null;
                kycInformation: string | null;
            },
            supportedCurrencies: string[] | null;
        } 
    } 
}

export type GetPartyInfoAvailableByTypeAndIdAndSubIdDTO = { 
    Params: { 
        type: string;
        id: string;
        subid: string;
    }, 
    Querystring: { 
        currency: string 
    }, 
    Body: { 
        party: {
            partyIdInfo: {
                fspId: string;
                extensionList: {
                    extension: {
                        key: string;
                        value: string;
                    }[];
                } | null;
            }
            name: string;
            merchantClassificationCode: string;
            personalInfo: {
                complexName: {
                    firstName: string;
                    middleName: string;
                    lastName: string;
                }
                dateOfBirth: Date | null;
                kycInformation: string | null;
            },
            supportedCurrencies: string[] | null;
        } 
    } 
}

export type GetPartyByTypeAndIdQueryRejectDTO = { 
    Params: { 
        type: string; 
        id: string; 
    }, 
    Querystring: { 
        currency: string;
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

export type GetPartyByTypeAndIdAndSubIdQueryRejectDTO = { 
    Params: { 
        type: string; 
        id: string; 
        subid: string;
    }, 
    Querystring: { 
        currency: string;
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