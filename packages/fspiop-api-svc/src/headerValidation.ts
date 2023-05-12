'use strict'

// Motivation for this module is that hapi-openapi does not correctly validate headers on routes
// where the headers are specified at the path level, instead of the method level. And does not
// _appear_ to correctly validate the content of `string` + `pattern` headers at all, although the
// accuracy of this statement has not been thoroughly tested.

//Import the Enums
const { Factory: { createFSPIOPError }, Enums } = require('@mojaloop/central-services-error-handling')
import { parseAcceptHeader, parseContentTypeHeader, protocolVersions, convertSupportedVersionToExtensionList } from './validation'

// Some defaults

const defaultProtocolResources = [
  'parties',
  'participants',
  'quotes',
  'transfers',
  'bulkTransfers',
  'bulkQuotes',
  'transactionRequests',
  'authorizations'
]

const defaultProtocolVersions = [
  ...protocolVersions.ONE,
  protocolVersions.anyVersion
]

const errorMessages = {
  REQUESTED_VERSION_NOT_SUPPORTED: 'The Client requested an unsupported version, see extension list for supported version(s).',
  INVALID_ACCEPT_HEADER: 'Invalid accept header',
  INVALID_CONTENT_TYPE_HEADER: 'Invalid content-type header',
  REQUIRE_ACCEPT_HEADER: 'Accept is required',
  REQUIRE_CONTENT_TYPE_HEADER: 'Content-type is required',
  SUPPLIED_VERSION_NOT_SUPPORTED: 'Client supplied a protocol version which is not supported by the server'
}

/**
 * HAPI plugin to validate request headers per FSPIOP-API spec 1.0
 *
 * @param {[Object]} supportedProtocolVersions - an array of numerical protocol version strings
 *                       supported by your implementation of the FSPIOP API e.g. ['1', '1.1']. Can
 *                       also contain the anyVersion symbol: ['1', '1.1', anyVersion] found
 *                       elsewhere in this module
 * @param {[string]} resources - the API resources you wish to be validated. See
 *                       defaultProtocolResources for an example.
 */

export const validateHeaders = (request: any, res:any, next:any) => {
      const resources = defaultProtocolResources;
      const supportedProtocolContentVersions = defaultProtocolVersions;
      const supportedProtocolAcceptVersions = defaultProtocolVersions;

      // First, extract the resource type from the path
      const resource = request.path.replace(/^\//, '').split('/')[0]

      // Only validate requests for the requested resources
      if (!resources.includes(resource)) {
        return next()
      }

      // Always validate the accept header for a get request, or optionally if it has been
      // supplied
      if (request.method.toLowerCase() === 'get' || request.headers.accept) {
        if (request.headers.accept === undefined) {
			return res.status(400).json({
				errorInformation: {
					errorCode: Enums.FSPIOPErrorCodes.MISSING_ELEMENT,
					errorDescription: errorMessages.REQUIRE_ACCEPT_HEADER
				}
			});
        }
        const accept:any = parseAcceptHeader(resource, request.headers.accept)
        if (!accept.valid) {
          return res.status(400).json({
              errorInformation: {
                  errorCode: Enums.FSPIOPErrorCodes.MALFORMED_SYNTAX,
                  errorDescription: errorMessages.INVALID_ACCEPT_HEADER
              }
          });
        }
        if (!supportedProtocolAcceptVersions.some(supportedVer => accept.versions.has(supportedVer))) {
        //   const supportedVersionExtensionListMap = convertSupportedVersionToExtensionList(supportedProtocolAcceptVersions)
          return res.status(400).json({
              errorInformation: {
                  errorCode: Enums.FSPIOPErrorCodes.UNACCEPTABLE_VERSION,
                  errorDescription: errorMessages.REQUESTED_VERSION_NOT_SUPPORTED
              }
          });
        }
      }

      // Always validate the content-type header
		if (request.headers["content-type"] === undefined || !request.headers["content-type"] || request.headers["content-type"] === "application/json") {
			return res.status(400).json({
			errorInformation: {
				errorCode: Enums.FSPIOPErrorCodes.MISSING_ELEMENT,
				errorDescription: errorMessages.REQUIRE_CONTENT_TYPE_HEADER
			}
		});
      }
      const contentType = parseContentTypeHeader(resource, request.headers['content-type'])
      if (!contentType.valid) {
        return res.status(400).json({
			errorInformation: {
				errorCode: Enums.FSPIOPErrorCodes.MALFORMED_SYNTAX,
				errorDescription: errorMessages.INVALID_CONTENT_TYPE_HEADER
			}
		});
      }
      // if (!supportedProtocolContentVersions.includes(contentType.version)) {
      if (!supportedProtocolContentVersions.some(supportedVer => contentType.version === supportedVer)) {
        const supportedVersionExtensionListMap = convertSupportedVersionToExtensionList(supportedProtocolContentVersions)
        return res.status(400).json({
			errorInformation: {
				errorCode: Enums.FSPIOPErrorCodes.UNACCEPTABLE_VERSION,
				errorDescription: errorMessages.SUPPLIED_VERSION_NOT_SUPPORTED
			}
		});
      }
      return;
  }
