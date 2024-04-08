import { FastifyRequest, FastifyReply } from 'fastify';
import { parseAcceptHeader, parseContentTypeHeader, protocolVersions, FSPIOPErrorCodes } from "./validation";

// Define resource types and error messages with type annotations for better type safety
const defaultProtocolResources: string[] = [
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
] as string[];

const errorMessages: { [key: string]: string } = {
  REQUESTED_VERSION_NOT_SUPPORTED: "The Client requested an unsupported version, see extension list for supported version(s).",
  INVALID_ACCEPT_HEADER: "Invalid accept header",
  INVALID_CONTENT_TYPE_HEADER: "Invalid content-type header",
  REQUIRE_ACCEPT_HEADER: "accept is required",
  REQUIRE_CONTENT_TYPE_HEADER: "Content-type is required",
  SUPPLIED_VERSION_NOT_SUPPORTED: "Client supplied a protocol version which is not supported by the server"
};

export const validateHeadersPlugin = async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.routerPath || request.raw.url as string;
    const resource = url.replace(/^\//, "").split("/")[0];

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

    // Always validate the accept header for a get request, or optionally if it has been supplied
    if (request.method.toLowerCase() === "get" || request.headers.accept) {
		if (!request.headers["content-type"] || request.headers["content-type"] === "application/json") {
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

		if (!request.headers.accept) {
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

		if (!defaultProtocolVersions.some(version => accept.versions?.has(version))) {
			reply.status(400).send({
			errorInformation: {
				errorCode: FSPIOPErrorCodes.MISSING_ELEMENT.code,
				errorDescription: errorMessages.INVALID_ACCEPT_HEADER,
			}
			});
			return;
		}
    }

    if (request.headers["date"]) {
		const headerDate = new Date(request.headers["date"]);
		if (isNaN(headerDate.getTime())) { // Using isNaN to check for invalid date
			reply.status(400).send({
				errorInformation: {
					errorCode: "3102",
					errorDescription: "Invalid date-type"
				}
			});
			return;
		}
    }
};