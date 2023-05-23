"use strict";

// Motivation for this module is that hapi-openapi does not correctly validate headers on routes
// where the headers are specified at the path level, instead of the method level. And does not
// _appear_ to correctly validate the content of `string` + `pattern` headers at all, although the
// accuracy of this statement has not been thoroughly tested.

//Import the Enums
const { Factory: { createFSPIOPError }, Enums } = require("@mojaloop/central-services-error-handling")
import { parseAcceptHeader, parseContentTypeHeader, protocolVersions, convertSupportedVersionToExtensionList } from "./validation"

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
]

const defaultProtocolVersions = [
  ...protocolVersions.ONE,
  protocolVersions.anyVersion
]

const errorMessages = {
  REQUESTED_VERSION_NOT_SUPPORTED: "The Client requested an unsupported version, see extension list for supported version(s).",
  INVALID_ACCEPT_HEADER: "Invalid accept header",
  INVALID_CONTENT_TYPE_HEADER: "Invalid content-type header",
  REQUIRE_ACCEPT_HEADER: "Accept is required",
  REQUIRE_CONTENT_TYPE_HEADER: "Content-type is required",
  SUPPLIED_VERSION_NOT_SUPPORTED: "Client supplied a protocol version which is not supported by the server"
}

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

export const validateHeaders = (req: any, res:any, next:any) =>{
  const resources = [
      "parties",
      "participants",
      "quotes",
      "transfers",
      "bulkTransfers",
      "bulkQuotes",
      "transactionRequests",
      "authorizations"
    ]

  const resource = req.path.replace(/^\//, "").split("/")[0]

  // Only validate requests for the requested resources
  // if (!resources.includes(resource)) {
  //   debugger
  // }

  const supportedProtocolAcceptVersions = defaultProtocolVersions;
  // Always validate the accept header for a get request, or optionally if it has been
  // supplied
  if (req.method.toLowerCase() === "get" || req.headers.accept) {
      if (req.headers["content-type"] === undefined || !req.headers["content-type"] || req.headers["content-type"] === "application/json") {
          return res.status(400).json({
              errorInformation: {
                  errorCode: "3102",
                  errorDescription: "Missing content-type or wrong header/body format"
              }
          });
      }
      const contentType:any = parseContentTypeHeader(resource, req.headers["content-type"])
      if (!contentType.valid) {
          return res.status(400).json({
              errorInformation: {
                  errorCode: Enums.FSPIOPErrorCodes.MALFORMED_SYNTAX,
                  errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
              }
          });
      }

      if (req.headers.accept === undefined) {
          return res.status(400).json({
              errorInformation: {
                  errorCode: Enums.FSPIOPErrorCodes.MISSING_ELEMENT,
                  errorDescription: errorMessages.REQUIRE_ACCEPT_HEADER
              }
          });
      }

      const accept:any = parseAcceptHeader(resource, req.headers.accept)
      if (!accept.valid) {
          return res.status(400).json({
              errorInformation: {
                  errorCode: Enums.FSPIOPErrorCodes.MALFORMED_SYNTAX,
                  errorDescription: errorMessages.INVALID_ACCEPT_HEADER
              }
          });
      }
      if (!supportedProtocolAcceptVersions.some(supportedVer => accept.versions.has(supportedVer))) {
          // const supportedVersionExtensionListMap = convertSupportedVersionToExtensionList(supportedProtocolAcceptVersions)
          return res.status(400).json({
              errorInformation: {
                  errorCode: Enums.FSPIOPErrorCodes.MISSING_ELEMENT.code,
                  errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
              }
          });
      }
      const getVersionFromConfig = (resourceString:any) => {
          const resourceVersionMap:any = {}
          resourceString
            .split(",")
            .forEach((e:any) => e.split("=")
              .reduce((p:any, c:any) => {
                resourceVersionMap[p] = {
                  contentVersion: c,
                  acceptVersion: c.split(".")[0]
                }
                return null
              }))
          return resourceVersionMap
        }
      const acceptVersion = getVersionFromConfig(req.headers["accept"])

      // if(!acceptVersion) {
      //     debugger
      // }

      const date:any = req.headers["date"]
      let tempDate:any;
      if (typeof date === "object" && date instanceof Date) {
          tempDate = date.toUTCString()
        } else {
          try {
            tempDate = (new Date(date)).toUTCString()
            if (tempDate === "Invalid Date") {
              throw Error("Invalid Date")
            }
          } catch (err) {
            tempDate = date
          }
        }
  }

  if(req.headers["date"]) {
      // Determine which library to use to validate dates
      const headerDate = new Date(req.headers["date"]);
      if(headerDate.toDateString() === "Invalid Date") {
          return res.status(400).json({
              "errorInformation": {
                  "errorCode": "3102",
                  "errorDescription": "Invalid date-type"
              }
          });
      }
  }

  // TODO: find another way around this since it"s only a temporary fix for admin-ui date header
  if(req.headers["fspiop-date"]) {
      req.headers.date = req.headers["fspiop-date"] as string;
      delete req.headers["fspiop-date"];
  }

  next();
  return;
}
