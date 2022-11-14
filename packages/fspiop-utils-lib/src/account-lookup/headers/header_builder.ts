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

"use strict";

import { FSPIOP_HEADERS_SWITCH_REGEX } from '../../constants';
import Header, { IHeaderBuilder } from './base_header';
export default class HeaderBuilder implements IHeaderBuilder {
    headers: Header;

    constructor() {
        this.headers = new Header();
    }

    setAccept(accept: string): this {
        this.headers.accept = accept;

        return this;
    }
    setContentType(contentType: string): this {
        this.headers.contentType = contentType;

        return this;
    }
    setContentLength(contentLength: number): this {
        this.headers.contentLength = contentLength;

        return this;
    }

    setDate(date: string | Date): this {
        let formattedDate;

        if (
            typeof date === "object" && date instanceof Date
        ) {
            formattedDate = date.toUTCString();
        } else {
            try {
                formattedDate = new Date(date).toUTCString();
                if (formattedDate === "Invalid Date") {
                    throw Error("Invalid Date");
                }
            } catch (err) {
                formattedDate = date;
            }
        }

        this.headers.date = formattedDate;

        return this;
    }

    setXForwardedFor(xForwardedFor: string): this {
        this.headers.xForwardedFor = xForwardedFor;

        return this;
    }

    setFspiopDestination(fspiopDestination: string): this {
        this.headers.fspiopDestination = fspiopDestination;

        return this;
    }

    setFspiopEncryption(fspiopEncryption: string): this {
        this.headers.fspiopEncryption = fspiopEncryption;

        return this;
    }

    setFspiopSignature(fspiopSignature: string): this {
        this.headers.fspiopSignature = fspiopSignature;

        return this;
    }

    setFspiopUri(fspiopUri: string): this {
        this.headers.fspiopUri = fspiopUri;

        return this;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFspiopHttpMethod(httpMethod: string, config: any): this {
        // Check to see if we find a regex match the source header containing the switch name.
        // If so we include the signature otherwise we remove it.
        if(!httpMethod) {
            return this;
        }

        if (this.headers.fspiopSource.match(FSPIOP_HEADERS_SWITCH_REGEX) === null) {
            if (
                config.httpMethod.toLowerCase() === httpMethod.toLowerCase()
            ) {
                // HTTP Methods match, and thus no change is required
                this.headers.fspiopHttpMethod = httpMethod;
            } else {
                // HTTP Methods DO NOT match, and thus a change is required for target HTTP Method
                this.headers.fspiopHttpMethod = config.httpMethod;
            }
        }

        return this;
    }

    setFspiopSource(fspiopSource: string): this {
        this.headers.fspiopSource = fspiopSource;

        return this;
    }

    getResult(): Header {
        return this.headers;
    }

}