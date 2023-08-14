"use strict";

// Motivation for this module is that hapi-openapi does not correctly validate headers on routes
// where the headers are specified at the path level, instead of the method level. And does not
// _appear_ to correctly validate the content of `string` + `pattern` headers at all, although the
// accuracy of this statement has not been thoroughly tested.

//Import the Enums
import express from "express";
import { parseAcceptHeader, parseContentTypeHeader, protocolVersions, FSPIOPErrorCodes } from "./validation";

// Some defaults
const defaultProtocolResources = [
  "parties",
  "participants",
  "quotes",
  "transfers",
  "bulkTransfers",
  "bulkQuotes",
  "transactionRequests",
  "authorizations"
];

const defaultProtocolVersions = [
  ...protocolVersions.ONE,
  protocolVersions.anyVersion
];

const errorMessages = {
  REQUESTED_VERSION_NOT_SUPPORTED: "The Client requested an unsupported version, see extension list for supported version(s).",
  INVALID_ACCEPT_HEADER: "Invalid accept header",
  INVALID_CONTENT_TYPE_HEADER: "Invalid content-type header",
  REQUIRE_ACCEPT_HEADER: "accept is required",
  REQUIRE_CONTENT_TYPE_HEADER: "Content-type is required",
  SUPPLIED_VERSION_NOT_SUPPORTED: "Client supplied a protocol version which is not supported by the server"
};

/**
 * HAPI plugin to validate request headers per FSPIOP-API spec 1.0
 *
 * @param {[Object]} supportedProtocolVersions - an array of numerical protocol version strings
 *                       supported by your implementation of the FSPIOP API e.g. ["1", "1.1"]. Can
 *                       also contain the anyVersion symbol: ["1", "1.1", anyVersion] found
 *                       elsewhere in this module
 * @param {[string]} resources - the API resources you wish to be validated. See
 *                       defaultProtocolResources for an example.
 */

export const validateHeaders = (req: express.Request, res: express.Response, next: express.NextFunction) => {
	const resource = req.path.replace(/^\//, "").split("/")[0];

	// Only validate requests for the requested resources
	if (!defaultProtocolResources.includes(resource)) {
		return res.status(400).json({
			errorInformation: {
				errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
				errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
			}
		});
	}

    // TODO: find another way around this since it"s only a temporary fix for admin-ui date header
	if(req.headers["fspiop-date"]) {
		req.headers.date = req.headers["fspiop-date"] as string;
		delete req.headers["fspiop-date"];
	}
  
	const supportedProtocolAcceptVersions = defaultProtocolVersions;
	const supportedProtocolContentTypeVersions = defaultProtocolVersions;
	// Always validate the accept header for a get request, or optionally if it has been
	// supplied
	if (req.method.toLowerCase() === "get" || req.headers.accept) {
		if (req.headers["content-type"] === undefined || !req.headers["content-type"] || req.headers["content-type"] === "application/json") {
			return res.status(400).json({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
					errorDescription: errorMessages.REQUIRE_ACCEPT_HEADER
				}
			});
		}
		const contentType = parseContentTypeHeader(resource, req.headers["content-type"]);
		if (!contentType.valid) {
			return res.status(400).json({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
					errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
				}
			});
		}

		if (req.headers.accept === undefined) {
			return res.status(400).json({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
					errorDescription: errorMessages.REQUIRE_ACCEPT_HEADER
				}
			});
        }

        const accept = parseAcceptHeader(resource, req.headers.accept);
        if (!accept.valid) {
			return res.status(400).json({
				errorInformation: {
				errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
				errorDescription: errorMessages.INVALID_ACCEPT_HEADER
				}
			});
		}

        const getVersionFromConfig = (resourceString:string) => {
            const resourceVersionMap:{[key: string]: { contentVersion: string; acceptVersion: string; }} = {};
            resourceString
				.split(",")
				.forEach((e) => e.split("=")
                .reduce((p:string, c:string):any => { // eslint-disable-line @typescript-eslint/no-explicit-any
					resourceVersionMap[p] = {
						contentVersion: c,
						acceptVersion: c.split(".")[0]
					};
					return null;
                }));
            return resourceVersionMap;
		};
		
        const acceptVersion = getVersionFromConfig(req.headers["accept"]);

        if(!acceptVersion || accept.versions === undefined) {
			return res.status(400).json({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
					errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
				}
			});
        }

		if (!supportedProtocolAcceptVersions.some(supportedVer => accept.versions.has(supportedVer))) {
			// TODO: Check which response is right: one is implemented, the other is asserted in some TTK tests

			// const supportedVersionExtensionListMap = convertSupportedVersionToExtensionList(supportedProtocolAcceptVersions)
			// return res.status(400).json({
			// 	errorInformation: {
			// 		errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
			// 		errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
			// 	}
			// });
			return res.status(406).json({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.UNACCEPTABLE_VERSION.code,
					errorDescription: FSPIOPErrorCodes.UNACCEPTABLE_VERSION.message,
				}
			});
		}

		if (!supportedProtocolContentTypeVersions.some(supportedVer => supportedVer === contentType.version)) {
			// TODO: Same reason as before, except here one implementation doens't exist, the other is asserted in some TTK tests
			return res.status(406).json({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.UNACCEPTABLE_VERSION.code,
					errorDescription: FSPIOPErrorCodes.UNACCEPTABLE_VERSION.message,
				}
			});
		}

		if(!req.headers["date"]) {
			return res.status(400).json({
				errorInformation: {
					errorCode: "3102",
					errorDescription: "Missing mandatory element"
				}
			});
		}

		const date:any = req.headers["date"]; // eslint-disable-line @typescript-eslint/no-explicit-any
		let tempDate:string;
		if (typeof date === "object" && date instanceof Date) {
			tempDate = date.toUTCString();
		} else {
			try {
				tempDate = (new Date(date)).toUTCString();
				if (tempDate === "Invalid Date") {
					return res.status(400).json({
						errorInformation: {
							errorCode: "3102",
							errorDescription: "Invalid date-type"
						}
					});
				}
			} catch (err) {
				tempDate = date;
			}
		}
	}

	if(req.headers["date"]) {
		// Determine which library to use to validate dates
		const headerDate = new Date(req.headers["date"]);
		if(headerDate.toDateString() === "Invalid Date") {
			return res.status(400).json({
				errorInformation: {
					errorCode: "3102",
					errorDescription: "Invalid date-type"
				}
			});
		}
	}

	next();
	return;
};
