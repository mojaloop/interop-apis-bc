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

import util from 'util';
import base64url from 'base64url';
import { JsonWebSignatureHelper, AllowedSigningAlgorithms } from "@mojaloop/security-bc-client-lib";
import express from "express";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { FSPIOP_HEADERS_DATE, FSPIOP_HEADERS_DESTINATION, FSPIOP_HEADERS_HTTP_METHOD, FSPIOP_HEADERS_SIGNATURE, FSPIOP_HEADERS_SOURCE, FSPIOP_HEADERS_URI } from './constants';

// a regular expression to extract the Mojaloop API spec compliant HTTP-URI header value
const uriRegex = /(?:^.*)(\/(participants|parties|quotes|bulkQuotes|transfers|bulkTransfers|transactionRequests|thirdpartyRequests|authorizations|consents|consentRequests|)(\/.*)*)$/;

const ALLOWED_SIGNATURE_ALGORITHMS = ["RS256"];

export type JwsConfig = {
    privateKey: Buffer;
    publicKeys: {
        [key:string]: Buffer
    }
};

type FspiopSignatureFormat = {
    protectedHeader: string,
    signature: string
}

export class FspiopJwsSignature {
    private _logger: ILogger;
    private _privateKey: Buffer;
	private _publicKeys: any;
    constructor(config:JwsConfig, logger: ILogger) {
        if(!config.publicKeys) {
            throw new Error('Validation keys must be supplied as config argument');
        }

        this._publicKeys = config.publicKeys;
        this._privateKey = config.privateKey;
        this._logger = logger;
    }

    public validate(headers: any, payload: any) {
        try {
            if(!payload) {
                throw new Error('Cannot validate JWS without a payload');
            }

            // first check we have a public (validation) key for the request source
            if(!headers['fspiop-source']) {
                throw new Error('FSPIOP-Source HTTP header not in request headers. Unable to verify JWS');
            }

            const pubKey = this._publicKeys[headers['fspiop-source'] as string];

            if(!pubKey) {
                throw new Error(`JWS public key for '${headers['fspiop-source']}' not available. Unable to verify JWS. Only have keys for: ${util.inspect(Object.keys(this._publicKeys))}`);
            }

            // first we check the required headers are present 
            if(!headers['fspiop-uri'] || !headers['fspiop-http-method'] || !headers['fspiop-signature']) {
                throw new Error(`fspiop-uri, fspiop-http-method and fspiop-signature HTTP headers are all required for JWS. Only got ${util.inspect(headers)}`);
            }

            // if all required headers are present we start by extracting the components of the signature header 
            const { protectedHeader, signature } = JSON.parse(headers[FSPIOP_HEADERS_SIGNATURE] as string);

            const token = `${protectedHeader}.${base64url(JSON.stringify(payload))}.${signature}`; 
            
            const result = JsonWebSignatureHelper.verify(Buffer.from(pubKey).toString(), token, AllowedSigningAlgorithms.RS256);
            // check protected header has all required fields and matches actual incoming headers
            this._validateProtectedHeader(headers, result.header);

            this._logger.debug(`JWS verify result: ${util.inspect(result)}`);

            // all ok if we got here
            this._logger.debug(`JWS valid for request ${util.inspect(headers)} - ${util.inspect(payload)}`);
        }
        catch(err: unknown) {
            this._logger.error(`Error validating JWS: ${err || util.inspect(err)}`);
            throw err;
        }
    }

    _validateProtectedHeader(headers:any, decodedProtectedHeader:any) {
        // check alg is present and is the single permitted value
        if(!decodedProtectedHeader['alg']) {
            throw new Error(`Decoded protected header does not contain required alg element: ${util.inspect(decodedProtectedHeader)}`);
        }
        if(!ALLOWED_SIGNATURE_ALGORITHMS.includes(decodedProtectedHeader.alg)) {
            throw new Error(`Invalid protected header alg '${decodedProtectedHeader.alg}' should be one of the following values: '${ALLOWED_SIGNATURE_ALGORITHMS}'`);
        }

        // check FSPIOP-URI is present and matches
        if(!decodedProtectedHeader['FSPIOP-URI']) {
            throw new Error(`Decoded protected header does not contain required FSPIOP-URI element: ${util.inspect(decodedProtectedHeader)}`);
        }
        if(!headers['fspiop-uri']) {
            throw new Error(`FSPIOP-URI HTTP header not present in request headers: ${util.inspect(headers)}`);
        }
        if(decodedProtectedHeader['FSPIOP-URI'] !== headers['fspiop-uri']) {
            throw new Error(`FSPIOP-URI HTTP request header value: ${headers['fspiop-uri']} does not match protected header value: ${decodedProtectedHeader['FSPIOP-URI']}`);
        }
    

        // check FSPIOP-HTTP-Method is present and matches
        if(!decodedProtectedHeader['FSPIOP-HTTP-Method']) {
            throw new Error(`Decoded protected header does not contain required FSPIOP-HTTP-Method element: ${util.inspect(decodedProtectedHeader)}`);
        }
        if(!headers['fspiop-http-method']) {
            throw new Error(`FSPIOP-HTTP-Method HTTP header not present in request headers: ${util.inspect(headers)}`);
        }
        if(decodedProtectedHeader['FSPIOP-HTTP-Method'] !== headers['fspiop-http-method']) {
            throw new Error(`FSPIOP-HTTP-Method HTTP request header value: ${headers['fspiop-http-method']} does not match protected header value: ${decodedProtectedHeader['FSPIOP-HTTP-Method']}`);
        }


        // check FSPIOP-Source is present and matches
        if(!decodedProtectedHeader['FSPIOP-Source']) {
            throw new Error(`Decoded protected header does not contain required FSPIOP-Source element: ${util.inspect(decodedProtectedHeader)}`);
        }
        if(!headers['fspiop-source']) {
            throw new Error(`FSPIOP-Source HTTP header not present in request headers: ${util.inspect(headers)}`);
        }
        if(decodedProtectedHeader['FSPIOP-Source'] !== headers['fspiop-source']) {
            throw new Error(`FSPIOP-Source HTTP request header value: ${headers['fspiop-source']} does not match protected header value: ${decodedProtectedHeader['FSPIOP-Source']}`);
        }


        // if we have a Date field in the protected header it must be present in the HTTP header and the values should match exactly
        if(decodedProtectedHeader['Date'] && !headers['date']) {
            throw new Error(`Date header is present in protected header but not in HTTP request: ${util.inspect(headers)}`);
        }
        if(decodedProtectedHeader['Date'] && (headers['date'] !== decodedProtectedHeader['Date'])) {
            throw new Error(`HTTP date header: ${headers['date']} does not match protected header Date value: ${decodedProtectedHeader['Date']}`);
        }

        // if we have an HTTP fspiop-destination header it should also be in the protected header and the values should match exactly
        if(headers['fspiop-destination'] && !decodedProtectedHeader['FSPIOP-Destination']) {
            throw new Error(`HTTP fspiop-destination header is present but is not present in protected header: ${util.inspect(decodedProtectedHeader)}`); 
        }
        if(decodedProtectedHeader['FSPIOP-Destination'] && !headers['fspiop-destination']) {
            throw new Error(`FSPIOP-Destination header is present in protected header but not in HTTP request: ${util.inspect(headers)}`);
        }
        if(headers['fspiop-destination'] && (headers['fspiop-destination'] !== decodedProtectedHeader['FSPIOP-Destination'])) {
            throw new Error(`HTTP FSPIOP-Destination header: ${headers['fspiop-destination']} does not match protected header FSPIOP-Destination value: ${decodedProtectedHeader['FSPIOP-Destination']}`);
        }
    }


    sign(headers: any, payload: any): string {
        this._logger.info(`JWS Signing request: ${util.inspect(headers)} - ${util.inspect(payload)}`);
        const uri = headers[FSPIOP_HEADERS_URI];

        if(!payload) {
            throw new Error('Cannot sign with no payload');
        }

        const uriMatches = uriRegex.exec(uri);
        if(!uriMatches || uriMatches.length < 2) {
            throw new Error(`URI not valid for protected header: ${uri}`);
        }

        // add required JWS headers to the request options
        headers[FSPIOP_HEADERS_HTTP_METHOD] = headers[FSPIOP_HEADERS_HTTP_METHOD].toUpperCase();
        headers[FSPIOP_HEADERS_URI] = uriMatches[1];

        // get the signature
        return this.getSignature(headers, payload);
    }

    getSignature(headers: any, payload: any): string {
        this._logger.info(`Get JWS Signature: ${util.inspect(headers)} - ${util.inspect(payload)}`);
        const uri = headers[FSPIOP_HEADERS_URI];

        if(!payload) {
            throw new Error('Cannot sign with no body');
        }

        const uriMatches = uriRegex.exec(uri);
        if(!uriMatches || uriMatches.length < 2) {
            throw new Error(`URI not valid for protected header: ${uri}`);
        }

        // generate the protected header as base64url encoding of UTF-8 encoding of JSON string

        // Note: Property names are case sensitive in the protected header object even though they are
        // not case sensitive in the actual HTTP headers
        const protectedHeaderObject = {
            "alg": AllowedSigningAlgorithms.RS256,
            "FSPIOP-URI": headers["fspiop-uri"],
            "FSPIOP-HTTP-Method": headers[FSPIOP_HEADERS_HTTP_METHOD].toUpperCase(),
            "FSPIOP-Source": headers["fspiop-source"]
        } as any;

        // set destination in the protected header object if it is present in the request headers
        if (headers[FSPIOP_HEADERS_DESTINATION]) {
            protectedHeaderObject['FSPIOP-Destination'] = headers[FSPIOP_HEADERS_DESTINATION];
        }

        // set date in the protected header object if it is present in the request headers
        if (headers[FSPIOP_HEADERS_DATE]) {
            protectedHeaderObject["Date"] = headers[FSPIOP_HEADERS_DATE];
        }

        // now we sign
        const privKey = this._privateKey;

        const token = JsonWebSignatureHelper.sign(Buffer.from(privKey).toString(), 
            {
                "alg": "RS256",
                "FSPIOP-URI": headers[FSPIOP_HEADERS_URI],
                "FSPIOP-HTTP-Method": headers[FSPIOP_HEADERS_HTTP_METHOD],
                "FSPIOP-Source": headers[FSPIOP_HEADERS_SOURCE],
                "FSPIOP-Destination": headers[FSPIOP_HEADERS_DESTINATION],
            },
            JSON.stringify(payload), 
            AllowedSigningAlgorithms.RS256
        );

        // now set the signature header as JSON encoding of the signature and protected header as per mojaloop spec
        const [ protectedHeaderBase64, , signature ] = token.split('.');

        const signatureObject = {
            signature: signature,
            protectedHeader: protectedHeaderBase64
        };

        return JSON.stringify(signatureObject);
    }
}