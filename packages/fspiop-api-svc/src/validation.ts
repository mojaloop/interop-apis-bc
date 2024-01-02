
/* istanbul ignore file */
import { strict as assert } from "assert";

export const protocolVersions = {
  anyVersion: Symbol("Any"),
  ONE: ["1", "1.0", "1.1"]
};

export const protocolVersionsMap = [
  { key: "1", value: "0" },
  { key: "1", value: "1" }
];

// Some convenience functions for generating regexes for header matching

export const generateContentTypeRegex = (resource:string) =>
  new RegExp(`^application/vnd\\.interoperability\\.${resource}\\+json\\s{0,1};\\s{0,1}version=(\\d+\\.\\d+)$`);

export const generateAcceptRegex = (resource:string) =>
  new RegExp(`^${generateSingleAcceptRegexStr(resource)}(,${generateSingleAcceptRegexStr(resource)})*$`);

export const generateSingleAcceptRegex = (resource:string) =>
  new RegExp(generateSingleAcceptRegexStr(resource));

export const generateSingleAcceptRegexStr = (resource:string) =>
  `application/vnd\\.interoperability\\.${resource}\\+json(\\s{0,1};\\s{0,1}version=\\d+(\\.\\d+)?)?`;

export const parseContentTypeHeader = (resource:string, header:string) => {
  assert(typeof header === "string");

  // Create the validation regex
  const r = generateContentTypeRegex(resource);

  // Test the header
  const match = header.match(r);
  if (match === null) {
    return { valid: false };
  }

  return {
    valid: true,
    version: match[1]
  };
};

export const parseAcceptHeader = (resource:string, header:string) => {
  assert(typeof header === "string");

  // Create the validation regex
  const r = generateAcceptRegex(resource);

  // Test the header
  if (header.match(r) === null) {
    return { valid: false };
  }

  // The header contains a comma-delimited set of versions, extract these
  const versions = new Set(header
    .split(",")
    .map(verStr => {
      const versionMatch = verStr.match(generateSingleAcceptRegex(resource));
      return versionMatch === null ? undefined : versionMatch[1];
    })
    .map((match:any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      return match === undefined ? protocolVersions.anyVersion : match.split("=")[1];
    })
  );

  return {
    valid: true,
    versions
  };
};

/*
export const convertSupportedVersionToExtensionList = (supportedVersions:any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const supportedVersionsExtensionListMap = [];
  for (const version of supportedVersions) {
    const versionList = version.toString().split(".").filter((num:string) => num !== "");
    if (versionList != null && versionList.length === 2) {
      const versionMap:{[key: string]: string} = {};
      versionMap.key = versionList[0];
      versionMap.value = versionList[1];
      supportedVersionsExtensionListMap.push(versionMap);
    } else if (versionList != null && versionList.length === 1 && version !== protocolVersions.anyVersion) {
      const versionMap:{[key: string]: string} = {};
      versionMap.key = versionList[0];
      versionMap.value = "0";
      supportedVersionsExtensionListMap.push(versionMap);
    }
  }
  return _.uniqWith(supportedVersionsExtensionListMap, _.isEqual);
};
*/

export const FSPIOPErrorCodes = {
  "COMMUNICATION_ERROR": {
    "code": "1000",
    "message": "Communication error",
    "name": "COMMUNICATION_ERROR",
    "type": {
      "regex": "^10[0-9]{2}$",
      "description": "Generic Communication Error",
      "httpStatusCode": 503,
      "name": "GENERIC_COMMUNICATION_ERROR"
    },
    "httpStatusCode": 503
  },
  "DESTINATION_COMMUNICATION_ERROR": {
    "code": "1001",
    "message": "Destination communication error",
    "name": "DESTINATION_COMMUNICATION_ERROR",
    "type": {
      "regex": "^10[0-9]{2}$",
      "description": "Generic Communication Error",
      "httpStatusCode": 503,
      "name": "GENERIC_COMMUNICATION_ERROR"
    },
    "httpStatusCode": 503
  },
  "SERVER_ERROR": {
    "code": "2000",
    "message": "Generic server error",
    "name": "SERVER_ERROR",
    "type": {
      "regex": "^20[0-9]{2}$",
      "description": "Generic Server Error",
      "httpStatusCode": 500,
      "name": "GENERIC_SERVER_ERROR"
    },
    "httpStatusCode": 500
  },
  "INTERNAL_SERVER_ERROR": {
    "code": "2001",
    "message": "Internal server error",
    "name": "INTERNAL_SERVER_ERROR",
    "type": {
      "regex": "^20[0-9]{2}$",
      "description": "Generic Server Error",
      "httpStatusCode": 500,
      "name": "GENERIC_SERVER_ERROR"
    },
    "httpStatusCode": 500
  },
  "NOT_IMPLEMENTED": {
    "code": "2002",
    "message": "Not implemented",
    "httpStatusCode": 501,
    "name": "NOT_IMPLEMENTED",
    "type": {
      "regex": "^20[0-9]{2}$",
      "description": "Generic Server Error",
      "httpStatusCode": 500,
      "name": "GENERIC_SERVER_ERROR"
    }
  },
  "SERVICE_CURRENTLY_UNAVAILABLE": {
    "code": "2003",
    "message": "Service currently unavailable",
    "httpStatusCode": 503,
    "name": "SERVICE_CURRENTLY_UNAVAILABLE",
    "type": {
      "regex": "^20[0-9]{2}$",
      "description": "Generic Server Error",
      "httpStatusCode": 500,
      "name": "GENERIC_SERVER_ERROR"
    }
  },
  "SERVER_TIMED_OUT": {
    "code": "2004",
    "message": "Server timed out",
    "name": "SERVER_TIMED_OUT",
    "type": {
      "regex": "^20[0-9]{2}$",
      "description": "Generic Server Error",
      "httpStatusCode": 500,
      "name": "GENERIC_SERVER_ERROR"
    },
    "httpStatusCode": 500
  },
  "SERVER_BUSY": {
    "code": "2005",
    "message": "Server busy",
    "name": "SERVER_BUSY",
    "type": {
      "regex": "^20[0-9]{2}$",
      "description": "Generic Server Error",
      "httpStatusCode": 500,
      "name": "GENERIC_SERVER_ERROR"
    },
    "httpStatusCode": 500
  },
  "METHOD_NOT_ALLOWED": {
    "code": "3000",
    "message": "Generic client error - Method Not Allowed",
    "httpStatusCode": 405,
    "name": "METHOD_NOT_ALLOWED",
    "type": {
      "regex": "^30[0-9]{2}$",
      "description": "Generic Client Error",
      "httpStatusCode": 400,
      "name": "GENERIC_CLIENT_ERROR"
    }
  },
  "CLIENT_ERROR": {
    "code": "3000",
    "message": "Generic client error",
    "httpStatusCode": 400,
    "name": "CLIENT_ERROR",
    "type": {
      "regex": "^30[0-9]{2}$",
      "description": "Generic Client Error",
      "httpStatusCode": 400,
      "name": "GENERIC_CLIENT_ERROR"
    }
  },
  "UNACCEPTABLE_VERSION": {
    "code": "3001",
    "message": "Unacceptable version requested",
    "httpStatusCode": 406,
    "name": "UNACCEPTABLE_VERSION",
    "type": {
      "regex": "^30[0-9]{2}$",
      "description": "Generic Client Error",
      "httpStatusCode": 400,
      "name": "GENERIC_CLIENT_ERROR"
    }
  },
  "UNKNOWN_URI": {
    "code": "3002",
    "message": "Unknown URI",
    "httpStatusCode": 404,
    "name": "UNKNOWN_URI",
    "type": {
      "regex": "^30[0-9]{2}$",
      "description": "Generic Client Error",
      "httpStatusCode": 400,
      "name": "GENERIC_CLIENT_ERROR"
    }
  },
  "ADD_PARTY_INFO_ERROR": {
    "code": "3003",
    "message": "Add Party information error",
    "name": "ADD_PARTY_INFO_ERROR",
    "type": {
      "regex": "^30[0-9]{2}$",
      "description": "Generic Client Error",
      "httpStatusCode": 400,
      "name": "GENERIC_CLIENT_ERROR"
    },
    "httpStatusCode": 400
  },
  "DELETE_PARTY_INFO_ERROR": {
    "code": "3040",
    "message": "Delete Party information error",
    "name": "DELETE_PARTY_INFO_ERROR",
    "type": {
      "regex": "^30[0-9]{2}$",
      "description": "Generic Client Error",
      "httpStatusCode": 400,
      "name": "GENERIC_CLIENT_ERROR"
    },
    "httpStatusCode": 400
  },
  "VALIDATION_ERROR": {
    "code": "3100",
    "message": "Generic validation error",
    "httpStatusCode": 400,
    "name": "VALIDATION_ERROR",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "MALFORMED_SYNTAX": {
    "code": "3101",
    "message": "Malformed syntax",
    "httpStatusCode": 400,
    "name": "MALFORMED_SYNTAX",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "MISSING_ELEMENT": {
    "code": "3102",
    "message": "Missing mandatory element",
    "httpStatusCode": 400,
    "name": "MISSING_ELEMENT",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "TOO_MANY_ELEMENTS": {
    "code": "3103",
    "message": "Too many elements",
    "httpStatusCode": 400,
    "name": "TOO_MANY_ELEMENTS",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "TOO_LARGE_PAYLOAD": {
    "code": "3104",
    "message": "Too large payload",
    "httpStatusCode": 400,
    "name": "TOO_LARGE_PAYLOAD",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "INVALID_SIGNATURE": {
    "code": "3105",
    "message": "Invalid signature",
    "httpStatusCode": 400,
    "name": "INVALID_SIGNATURE",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "MODIFIED_REQUEST": {
    "code": "3106",
    "message": "Modified request",
    "httpStatusCode": 400,
    "name": "MODIFIED_REQUEST",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "MISSING_MANDATORY_EXTENSION": {
    "code": "3107",
    "message": "Missing mandatory extension parameter",
    "httpStatusCode": 400,
    "name": "MISSING_MANDATORY_EXTENSION",
    "type": {
      "regex": "^31[0-9]{2}$",
      "description": "Client Validation Error",
      "httpStatusCode": 400,
      "name": "CLIENT_VALIDATION_ERROR"
    }
  },
  "ID_NOT_FOUND": {
    "code": "3200",
    "message": "Generic ID not found",
    "name": "ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "DESTINATION_FSP_ERROR": {
    "code": "3201",
    "message": "Destination FSP Error",
    "name": "DESTINATION_FSP_ERROR",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_FSP_ID_NOT_FOUND": {
    "code": "3202",
    "message": "Payer FSP ID not found",
    "name": "PAYER_FSP_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_FSP_ID_NOT_FOUND": {
    "code": "3203",
    "message": "Payee FSP ID not found",
    "name": "PAYEE_FSP_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "PARTY_NOT_FOUND": {
    "code": "3204",
    "message": "Party not found",
    "name": "PARTY_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "QUOTE_ID_NOT_FOUND": {
    "code": "3205",
    "message": "Quote ID not found",
    "name": "QUOTE_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "TXN_REQUEST_ID_NOT_FOUND": {
    "code": "3206",
    "message": "Transaction request ID not found",
    "name": "TXN_REQUEST_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "TXN_ID_NOT_FOUND": {
    "code": "3207",
    "message": "Transaction ID not found",
    "name": "TXN_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "TRANSFER_ID_NOT_FOUND": {
    "code": "3208",
    "message": "Transfer ID not found",
    "name": "TRANSFER_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "BULK_QUOTE_ID_NOT_FOUND": {
    "code": "3209",
    "message": "Bulk quote ID not found",
    "name": "BULK_QUOTE_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "BULK_TRANSFER_ID_NOT_FOUND": {
    "code": "3210",
    "message": "Bulk transfer ID not found",
    "name": "BULK_TRANSFER_ID_NOT_FOUND",
    "type": {
      "regex": "^32[0-9]{2}$",
      "description": "Identifier Error",
      "httpStatusCode": 400,
      "name": "IDENTIFIER_ERROR"
    },
    "httpStatusCode": 400
  },
  "EXPIRED_ERROR": {
    "code": "3300",
    "message": "Generic expired error",
    "name": "EXPIRED_ERROR",
    "type": {
      "regex": "^33[0-9]{2}$",
      "description": "Expired Error",
      "httpStatusCode": 400,
      "name": "EXPIRED_ERROR"
    },
    "httpStatusCode": 400
  },
  "TXN_REQUEST_EXPIRED": {
    "code": "3301",
    "message": "Transaction request expired",
    "name": "TXN_REQUEST_EXPIRED",
    "type": {
      "regex": "^33[0-9]{2}$",
      "description": "Expired Error",
      "httpStatusCode": 400,
      "name": "EXPIRED_ERROR"
    },
    "httpStatusCode": 400
  },
  "QUOTE_EXPIRED": {
    "code": "3302",
    "message": "Quote expired",
    "name": "QUOTE_EXPIRED",
    "type": {
      "regex": "^33[0-9]{2}$",
      "description": "Expired Error",
      "httpStatusCode": 400,
      "name": "EXPIRED_ERROR"
    },
    "httpStatusCode": 400
  },
  "TRANSFER_EXPIRED": {
    "code": "3303",
    "message": "Transfer expired",
    "name": "TRANSFER_EXPIRED",
    "type": {
      "regex": "^33[0-9]{2}$",
      "description": "Expired Error",
      "httpStatusCode": 400,
      "name": "EXPIRED_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_ERROR": {
    "code": "4000",
    "message": "Generic Payer error",
    "name": "PAYER_ERROR",
    "type": {
      "regex": "^40[0-9]{2}$",
      "description": "Generic Payer Error",
      "httpStatusCode": 400,
      "name": "GENERIC_PAYER_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_FSP_INSUFFICIENT_LIQUIDITY": {
    "code": "4001",
    "message": "Payer FSP insufficient liquidity",
    "name": "PAYER_FSP_INSUFFICIENT_LIQUIDITY",
    "type": {
      "regex": "^40[0-9]{2}$",
      "description": "Generic Payer Error",
      "httpStatusCode": 400,
      "name": "GENERIC_PAYER_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_REJECTION": {
    "code": "4100",
    "message": "Generic Payer rejection",
    "name": "PAYER_REJECTION",
    "type": {
      "regex": "^41[0-9]{2}$",
      "description": "Payer Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYER_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_REJECTED_TXN_REQUEST": {
    "code": "4101",
    "message": "Payer rejected transaction request",
    "name": "PAYER_REJECTED_TXN_REQUEST",
    "type": {
      "regex": "^41[0-9]{2}$",
      "description": "Payer Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYER_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_FSP_UNSUPPORTED_TXN_TYPE": {
    "code": "4102",
    "message": "Payer FSP unsupported transaction type",
    "name": "PAYER_FSP_UNSUPPORTED_TXN_TYPE",
    "type": {
      "regex": "^41[0-9]{2}$",
      "description": "Payer Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYER_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_UNSUPPORTED_CURRENCY": {
    "code": "4103",
    "message": "Payer unsupported currency",
    "name": "PAYER_UNSUPPORTED_CURRENCY",
    "type": {
      "regex": "^41[0-9]{2}$",
      "description": "Payer Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYER_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_LIMIT_ERROR": {
    "code": "4200",
    "message": "Payer limit error",
    "name": "PAYER_LIMIT_ERROR",
    "type": {
      "regex": "^42[0-9]{2}$",
      "description": "Payer Limit Error",
      "httpStatusCode": 400,
      "name": "PAYER_LIMIT_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_PERMISSION_ERROR": {
    "code": "4300",
    "message": "Payer permission error",
    "name": "PAYER_PERMISSION_ERROR",
    "type": {
      "regex": "^43[0-9]{2}$",
      "description": "Payer Permission Error",
      "httpStatusCode": 400,
      "name": "PAYER_PERMISSION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYER_BLOCKED_ERROR": {
    "code": "4400",
    "message": "Generic Payer blocked error",
    "name": "PAYER_BLOCKED_ERROR",
    "type": {
      "regex": "^44[0-9]{2}$",
      "description": "Payer Blocker Error",
      "httpStatusCode": 400,
      "name": "PAYER_BLOCKED_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_ERROR": {
    "code": "5000",
    "message": "Generic Payee error",
    "name": "PAYEE_ERROR",
    "type": {
      "regex": "^50[0-9]{2}$",
      "description": "Generic Payee Error",
      "httpStatusCode": 400,
      "name": "GENERIC_PAYEE_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_FSP_INSUFFICIENT_LIQUIDITY": {
    "code": "5001",
    "message": "Payee FSP insufficient liquidity",
    "name": "PAYEE_FSP_INSUFFICIENT_LIQUIDITY",
    "type": {
      "regex": "^50[0-9]{2}$",
      "description": "Generic Payee Error",
      "httpStatusCode": 400,
      "name": "GENERIC_PAYEE_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_REJECTION": {
    "code": "5100",
    "message": "Generic Payee rejection",
    "name": "PAYEE_REJECTION",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_REJECTED_QUOTE": {
    "code": "5101",
    "message": "Payee rejected quote",
    "name": "PAYEE_REJECTED_QUOTE",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_FSP_UNSUPPORTED_TXN_TYPE": {
    "code": "5102",
    "message": "Payee FSP unsupported transaction type",
    "name": "PAYEE_FSP_UNSUPPORTED_TXN_TYPE",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_FSP_REJECTED_QUOTE": {
    "code": "5103",
    "message": "Payee FSP rejected quote",
    "name": "PAYEE_FSP_REJECTED_QUOTE",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_REJECTED_TXN": {
    "code": "5104",
    "message": "Payee rejected transaction",
    "name": "PAYEE_REJECTED_TXN",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_FSP_REJECTED_TXN": {
    "code": "5105",
    "message": "Payee FSP rejected transaction",
    "name": "PAYEE_FSP_REJECTED_TXN",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_UNSUPPORTED_CURRENCY": {
    "code": "5106",
    "message": "Payee unsupported currency",
    "name": "PAYEE_UNSUPPORTED_CURRENCY",
    "type": {
      "regex": "^51[0-9]{2}$",
      "description": "Payee Rejection Error",
      "httpStatusCode": 400,
      "name": "PAYEE_REJECTION_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_LIMIT_ERROR": {
    "code": "5200",
    "message": "Payee limit error",
    "name": "PAYEE_LIMIT_ERROR",
    "type": {
      "regex": "^52[0-9]{2}$",
      "description": "Payee Limit Error",
      "httpStatusCode": 400,
      "name": "PAYEE_LIMIT_ERROR"
    },
    "httpStatusCode": 400
  },
  "PAYEE_PERMISSION_ERROR": {
    "code": "5300",
    "message": "Payee permission error",
    "name": "PAYEE_PERMISSION_ERROR",
    "type": {
      "regex": "^53[0-9]{2}$",
      "description": "Payee Permission Error",
      "httpStatusCode": 400,
      "name": "PAYEE_PERMISSION_ERROR"
    },
    "httpStatusCode": 400
  },
  "GENERIC_PAYEE_BLOCKED_ERROR": {
    "code": "5400",
    "message": "Generic Payee blocked error",
    "name": "GENERIC_PAYEE_BLOCKED_ERROR",
    "type": {
      "regex": "^54[0-9]{2}$",
      "description": "Payee Blocker Error",
      "httpStatusCode": 400,
      "name": "PAYEE_BLOCKED_ERROR"
    },
    "httpStatusCode": 400
  },
  "GENERIC_SETTLEMENT_ERROR": {
    "code": "6000",
    "description": "Generic Settlement Error",
    "message": "Generic Settlement Error",
    "name": "GENERIC_SETTLEMENT_ERROR",
    "type": {
      "regex": "^60[0-9]{2}$",
      "description": "Settlement Related Error",
      "httpStatusCode": 400,
      "name": "GENERIC_SETTLEMENT_ERROR"
    },
    "httpStatusCode": 400
  }
};
