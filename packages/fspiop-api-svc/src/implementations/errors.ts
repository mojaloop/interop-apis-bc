/**
 License
 --------------
 Copyright © 2021 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License.

 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 * Gonçalo Garcia <goncalogarcia99@gmail.com>
 
 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 **/

 "use strict";

// Quotes
export class QuoteTypeNotSupportedError extends Error {
  constructor(message?: string) {
    super(message || "Quote type not supported");
  }
}
export class UnableToAddQuoteError extends Error {
    constructor(message?: string) {
        super(message || "Unable to add quote");
    }
}

export class UnableToUpdateQuoteError extends Error {
    constructor(message?: string) {
        super(message || "Unable to update quote");
    }
}
export class NoSuchQuoteError extends Error {
    constructor(message?: string) {
        super(message||"No such quote");
    }
}
export class UnableToGetQuoteError extends Error {
    constructor(message?: string) {
        super(message || 'Unable to get quote');
    }
}   
export class QuoteAlreadyExistsError extends Error {
    constructor(message?:string) {
        super(message || 'Quote already registered');
    }
}
export class UnableToDeleteQuoteError extends Error {
    constructor(message?:string) {
        super(message || 'Unable to delete quote');
    }
}

// Bulk Quotes
export class BulkQuoteTypeNotSupportedError extends Error {
constructor(message?: string) {
    super(message || "BulkQuote type not supported");
}
}
export class UnableToAddBulkQuoteError extends Error {
    constructor(message?: string) {
        super(message || "Unable to add bulk quote");
    }
}

export class UnableToUpdateBulkQuoteError extends Error {
    constructor(message?: string) {
        super(message || "Unable to update bulk quote");
    }
}
export class NoSuchBulkQuoteError extends Error {
    constructor(message?: string) {
        super(message||"No such bulk quote");
    }
}
export class UnableToGetBulkQuoteError extends Error {
    constructor(message?: string) {
        super(message || 'Unable to get bulk quote');
    }
}   
export class BulkQuoteAlreadyExistsError extends Error {
    constructor(message?:string) {
        super(message || 'BulkQuote already registered');
    }
}
export class UnableToDeleteBulkQuoteError extends Error {
    constructor(message?:string) {
        super(message || 'Unable to delete bulk quote');
    }
}

// Cache
export class LocalCacheError extends Error {
    constructor(message?: string) {
        super(message || 'Unable to get local cache');
    }
}

// Database
export class UnableToCloseDatabaseConnectionError extends Error{
    constructor(message?: string) {
        super(message || 'Unable to close database connection');
    }
}

export class UnableToInitQuoteRegistryError extends Error {
    constructor(message?: string) {
        super(message || 'Unable to initialize quote registry');
    }
}
export class UnableToInitBulkQuoteRegistryError extends Error {
    constructor(message?: string) {
        super(message || 'Unable to initialize quote registry');
    }
}