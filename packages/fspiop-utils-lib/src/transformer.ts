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

import { ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvtPayload, ParticipantQueryResponseEvtPayload, PartyInfoRequestedEvtPayload, PartyQueryResponseEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { FSPIOP_HEADERS_CONTENT_LENGTH, FSPIOP_HEADERS_SOURCE, FSPIOP_HEADERS_HOST, FSPIOP_HEADERS_HTTP_METHOD, FSPIOP_HEADERS_DESTINATION, FSPIOP_HEADERS_ACCEPT, FSPIOP_HEADERS_SWITCH_REGEX, FSPIOP_HEADERS_CONTENT_TYPE_CONTENT, FSPIOP_HEADERS_DATE, FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX, FSPIOP_HEADERS_SIGNATURE, FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX_VALUE } from "./constants";
import { Currency, ErrorCode, FspiopRequestMethodsEnum, PartyIdentifier } from "./enums";

type TransformHeadersOptions = {
	headers: {
		[x: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	};
	config: {
		protocolVersions: {
			content: string;
			accept: string;
		};
		httpMethod: FspiopRequestMethodsEnum;
		sourceFsp: string;
		destinationFsp: string;
	};
};


export interface ExtensionList {
	extension: [
		{
			key: string,
			value: string
		}
	]
}
export interface FspiopError {
	errorInformation: {
		errorCode: ErrorCode,
		errorDescription: string,
		extensionList?: ExtensionList
	}
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
		dateOfBirth: Date | null
	}
}

const getResourceInfoFromHeader = (headerValue: string) => {
	const result: { resourceType?: string; version?: string } = {};
	const regex = FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX.exec(headerValue);
	if (regex) {
		if (regex[2]) result.resourceType = regex[2];
		if (regex[4]) result.version = regex[4];
	}
	return result;
};

export const transformHeaders = ({
	headers,
	config
}: TransformHeadersOptions) => {
	// Normalized keys
	const normalizedKeys: { [x: string]: string } = Object.keys(headers).reduce(
		function(keys: { [x: string]: string }, k: string) {
			keys[k.toLowerCase()] = k;
			return keys;
		},
		{}
	);

	// Normalized headers
	const normalizedHeaders: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

	// resource type for content-type and accept headers
	let resourceType;

	// Determine the acceptVersion using the injected config
	const acceptVersion = config.protocolVersions.accept;
	

	// Determine the contentVersion using the injected config
	const contentVersion = config.protocolVersions.content;

	// check to see if FSPIOP-Destination header has been left out of the initial request. If so then add it.
	if (!normalizedKeys[FSPIOP_HEADERS_DESTINATION]) {
		headers[FSPIOP_HEADERS_DESTINATION] = "";
	}

	for (const headerKey in headers) {
		const headerValue = headers[headerKey];
		let tempDate: Date | string | null = null;

		switch (headerKey.toLowerCase()) {
			case FSPIOP_HEADERS_DATE:
				if (
					typeof headerValue === "object" &&
					headerValue instanceof Date
				) {
					tempDate = headerValue.toUTCString();
				} else {
					try {
						tempDate = new Date(headerValue).toUTCString();
						if (tempDate === "Invalid Date") {
							throw Error("Invalid Date");
						}
					} catch (err) {
						tempDate = headerValue;
					}
				}
				normalizedHeaders[headerKey] = tempDate;
				break;
			case FSPIOP_HEADERS_CONTENT_LENGTH:
				// Do nothing here, do not map. This will be inserted correctly by the Axios library
				break;
			case FSPIOP_HEADERS_HOST:
				// Do nothing here, do not map. This will be inserted correctly by the Axios library
				break;
			case FSPIOP_HEADERS_HTTP_METHOD:
				// Check to see if we find a regex match the source header containing the switch name.
				// If so we include the signature otherwise we remove it.
				if (
					headers[normalizedKeys[FSPIOP_HEADERS_SOURCE]].match(
						FSPIOP_HEADERS_SWITCH_REGEX
					) === null
				) {
					if (
						config.httpMethod.toLowerCase() ===
						headerValue.toLowerCase()
					) {
						// HTTP Methods match, and thus no change is required
						normalizedHeaders[headerKey] = headerValue;
					} else {
						// HTTP Methods DO NOT match, and thus a change is required for target HTTP Method
						normalizedHeaders[headerKey] = config.httpMethod;
					}
				} else {
					if (
						config.httpMethod.toLowerCase() ===
						headerValue.toLowerCase()
					) {
						// HTTP Methods match, and thus no change is required
						normalizedHeaders[
							headerKey
						] = headerValue.toUpperCase();
					} else {
						// HTTP Methods DO NOT match, and thus a change is required for target HTTP Method
						normalizedHeaders[
							headerKey
						] = config.httpMethod.toUpperCase();
					}
				}
				break;
			case FSPIOP_HEADERS_SOURCE:
				normalizedHeaders[headerKey] = config.sourceFsp;
				break;
			case FSPIOP_HEADERS_DESTINATION:
				normalizedHeaders[headerKey] = config.destinationFsp;
				break;
			case FSPIOP_HEADERS_ACCEPT:
				if (!FSPIOP_HEADERS_SWITCH_REGEX.test(config.sourceFsp)) {
					normalizedHeaders[headerKey] = headerValue;
					break;
				}
				if (!resourceType) {
					resourceType = getResourceInfoFromHeader(headers[headerKey])
						.resourceType;
				}

				// Fall back to using the legacy approach to determine the resourceVersion
				//  if (resourceType && !acceptVersion) {
				//     acceptVersion = resourceVersions[resourceType].acceptVersion;
				//  }
				normalizedHeaders[
					headerKey
				] = FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX_VALUE(
					resourceType,
					acceptVersion
				);
				break;
			case FSPIOP_HEADERS_CONTENT_TYPE_CONTENT:
				if (!FSPIOP_HEADERS_SWITCH_REGEX.test(config.sourceFsp)) {
					normalizedHeaders[headerKey] = headerValue;
					break;
				}
				if (!resourceType) {
					resourceType = getResourceInfoFromHeader(headers[headerKey])
						.resourceType;
				}
				// Fall back to using the legacy approach to determine the resourceVersion
				//  if (resourceType && !contentVersion) contentVersion = resourceVersions[resourceType].contentVersion
				normalizedHeaders[
					headerKey
				] = FSPIOP_HEADERS_CONTENT_AND_ACCEPT_REGEX_VALUE(
					resourceType,
					contentVersion
				);
				break;
			default:
				normalizedHeaders[headerKey] = headerValue;
		}
	}

	if (
		normalizedHeaders[normalizedKeys[FSPIOP_HEADERS_SOURCE]].match(
			FSPIOP_HEADERS_SWITCH_REGEX
		) !== null
	) {
		// Check to see if we find a regex match the source header containing the switch name.
		// If so we remove the signature added by default.
		delete normalizedHeaders[normalizedKeys[FSPIOP_HEADERS_SIGNATURE]];
	}

	// Per the FSPIOP API spec, remove the Accept header on all PUT requests
	if (config && config.httpMethod === FspiopRequestMethodsEnum.PUT) {
		delete normalizedHeaders[FSPIOP_HEADERS_ACCEPT];
	}
	return normalizedHeaders;
};

export const decodePayload = (
	input: string | object,
	{ asParsed = true } = {}
) => {
	if (typeof input === "string") {
		return asParsed
			? JSON.parse(input)
			: { mimeType: "text/plain", body: input };
	} else if (typeof input === "object") {
		return asParsed
			? input
			: { mimeType: "application/json", body: JSON.stringify(input) };
	} else {
		throw new Error("input should be Buffer or String");
	}
};

const removeEmpty = (obj: any) => {
	Object.entries(obj).forEach(([key, val])  =>
		(val && typeof val === 'object') && removeEmpty(val) ||
		(val === null || val === "") && delete obj[key]
	);
	return obj;
  };

export const transformPayloadParticipantPut = (payload: ParticipantQueryResponseEvtPayload):PutParticipant => {
	return {
		fspId: payload.ownerFspId
	};
};

export const transformPayloadPartyAssociationPut = (payload: ParticipantAssociationCreatedEvtPayload):Pick<PutParty, 'party'> => {
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

	return removeEmpty(correctPayload)
};

export const transformPayloadError = ({errorCode, errorDescription }:{ errorCode: ErrorCode, errorDescription: string}):FspiopError => {
	return {
		errorInformation: {
			errorCode: errorCode,
			errorDescription: errorDescription,
		}
	};
};
