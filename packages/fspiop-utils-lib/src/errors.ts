/**
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

 --------------
 **/

 "use strict";

 type ErrorInformation = {
	errorInformation: {
		errorCode: string;
		errorDescription: string;
		extensionList: {
			extension: {
				key: string;
				value: string | string[];
			}[]
		} | null;
	}
}

export class InvalidJWSKeysError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class ValidationdError extends Error {
	public errorInformation: ErrorInformation | null = null;

    constructor(errorInformation: ErrorInformation) {
        super(errorInformation.errorInformation.errorDescription);

		this.errorInformation = errorInformation;
    }
}

export class InvalidFSPIOPPayloadError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class InvalidFSPIOPHttpSourceHeaderError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class PublicKeyNotAvailableForDFSPError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingRequiredJWSFSPIOPHeaders extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingAlgHeaderInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}


export class InvalidAlgHeaderInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPURIHeaderInDecodedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPURIHeaderInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class NonMatchingFSPIOPURIJWSHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPHttpMethodHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPHttpMethodHeaderInDecodedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPHttpMethodHeaderInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class NonMatchingFSPIOPHttpMethodJWSHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPSourceHeaderInDecodedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPSourceHeaderInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class NonMatchingFSPIOPSourceJWSHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPDateHeaderInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class NonMatchingFSPIOPDateJWSHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPDestinationHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class MissingFSPIOPDestinationInProtectedHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class NonMatchingFSPIOPDestinationJWSHeader extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class InvalidFSPIOPURIHeaderError extends Error {
    constructor(message: string) {
        super(message);
    }
}
