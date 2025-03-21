/*****
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
*****/

"use strict";

export type HeaderResult = {
    "accept": string,
    "content-length"?: number,
    "content-type": string,
    "date": string,
    "x-forwarded-for"?: string,
    "fspiop-source": string,
    "fspiop-destination"?: string,
    "fspiop-encryption"?: string,
    "fspiop-signature"?: string,
    "fspiop-uri": string,
    "fspiop-http-method": string,
    "alg": string,
}

export default class Header {
    accept!: string;
    contentType!: string;
    contentLength!: number;
    date!: string;
    xForwardedFor!: string;
    fspiopSource: string;
    fspiopDestination!: string;
    fspiopEncryption!: string;
    fspiopSignature!: string;
    fspiopUri!: string;
    fspiopHttpMethod!: string;
    algorithm!: string;

    build(): HeaderResult {
        const headers: HeaderResult = {
            "accept": this.accept,
            "content-type": this.contentType,
            "content-length": this.contentLength,
            "date": this.date,
            "x-forwarded-for": this.xForwardedFor,
            "fspiop-source": this.fspiopSource,
            "fspiop-destination": this.fspiopDestination,
            "fspiop-encryption": this.fspiopEncryption,
            "fspiop-signature": this.fspiopSignature,
            "fspiop-uri": this.fspiopUri,
            "fspiop-http-method": this.fspiopHttpMethod,
            "alg": this.algorithm
        };

        return headers;
    }
}

export interface IHeaderBuilder {
    headers: Header
    setAccept(accept: string): this
    setContentType(contentType: string): this
    setContentLength(contentLength: number): this
    setDate(date: string | Date): this
    setXForwardedFor(xForwardedFor: string): this
    setFspiopSource(fspiopSource: string): this
    setFspiopDestination(fspiopDestination: string): this
    setFspiopEncryption(fspiopEncryption: string): this
    setFspiopSignature(fspiopSignature: string): this
    setFspiopUri(fspiopUri: string): this
    setFspiopHttpMethod(fspiopHttpMethod: string, config: any): this // eslint-disable-line @typescript-eslint/no-explicit-any
    getResult(): Header
}
