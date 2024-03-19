"use strict";

// Motivation for this module is that hapi-openapi does not correctly validate headers on routes
// where the headers are specified at the path level, instead of the method level. And does not
// _appear_ to correctly validate the content of `string` + `pattern` headers at all, although the
// accuracy of this statement has not been thoroughly tested.

//Import the Enums
import { parseAcceptHeader, parseContentTypeHeader, protocolVersions, FSPIOPErrorCodes } from "./validation";
import { FastifyPluginAsync } from 'fastify';

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

/* istanbul ignore next */
export const validateHeaders: FastifyPluginAsync = async (fastify) => {
	fastify.addHook('preHandler', async (request:any, reply) => {
		const resource = request.raw.url.replace(/^\//, "").split("/")[0];
	
		// Only validate requests for the requested resources
		if (!defaultProtocolResources.includes(resource)) {
			reply.status(400).send({
				errorInformation: {
				errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
				errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
				}
			});
			return;
		}
	
		// Temporary fix for admin-ui date header
		if (request.headers["fspiop-date"]) {
			request.headers.date = request.headers["fspiop-date"] as string;
			delete request.headers["fspiop-date"];
		}
	
		const supportedProtocolAcceptVersions = defaultProtocolVersions;
	
		// Always validate the accept header for a get request, or optionally if it has been supplied
		if (request.method.toLowerCase() === "get" || request.headers.accept) {
			if (request.headers["content-type"] === undefined || !request.headers["content-type"] || request.headers["content-type"] === "application/json") {
				reply.status(400).send({
					errorInformation: {
						errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
						errorDescription: errorMessages.REQUIRE_CONTENT_TYPE_HEADER
					}
				});
				return;
			}
	
			const contentType = parseContentTypeHeader(resource, request.headers["content-type"]);
			if (!contentType.valid) {
				reply.status(400).send({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
					errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
				}
				});
				return;
			}
	
			if (request.headers.accept === undefined) {
				reply.status(400).send({
					errorInformation: {
						errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
						errorDescription: errorMessages.REQUIRE_ACCEPT_HEADER
					}
				});
				return;
			}
	
			const accept = parseAcceptHeader(resource, request.headers.accept);
			if (!accept.valid) {
				reply.status(400).send({
				errorInformation: {
					errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
					errorDescription: errorMessages.INVALID_ACCEPT_HEADER
				}
				});
				return;
			}
	
			const getVersionFromConfig = (resourceString: string) => {
				const resourceVersionMap: { [key: string]: { contentVersion: string; acceptVersion: string; } } = {};
				resourceString.split(",").forEach((e) => e.split("=").reduce((p: string, c: string): any => { // eslint-disable-line @typescript-eslint/no-explicit-any
				resourceVersionMap[p] = {
					contentVersion: c,
					acceptVersion: c.split(".")[0]
				};
				return null;
				}));
				return resourceVersionMap;
			};
	
			const acceptVersion = getVersionFromConfig(request.headers["accept"]);
	
			if (!acceptVersion || accept.versions === undefined) {
				reply.status(400).send({
					errorInformation: {
					errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
					errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
					}
				});
				return;
			}
	
			if (!supportedProtocolAcceptVersions.some(supportedVer => accept.versions.has(supportedVer))) {
				// const supportedVersionExtensionListMap = convertSupportedVersionToExtensionList(supportedProtocolAcceptVersions)
				reply.status(400).send({
					errorInformation: {
						errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
						errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
					}
				});
				return;
			}

			const date: any = request.headers["date"]; // eslint-disable-line @typescript-eslint/no-explicit-any
			let tempDate: string;
			if (typeof date === "object" && date instanceof Date) {
				tempDate = date.toUTCString();
			} else {
				try {
					tempDate = (new Date(date)).toUTCString();
					if (tempDate === "Invalid Date") {
						reply.status(400).send({
							errorInformation: {
							errorCode: "3102",
							errorDescription: "Invalid date-type"
							}
						});
						return;
					}
				} catch (err) {
					tempDate = date;
				}
			}
		}
	
		if (request.headers["date"]) {
			// Determine which library to use to validate dates
			const headerDate = new Date(request.headers["date"]);
			if (headerDate.toDateString() === "Invalid Date") {
				reply.status(400).send({
					errorInformation: {
						errorCode: "3102",
						errorDescription: "Invalid date-type"
					}
				});
				return;
			}
		}
	});
};
