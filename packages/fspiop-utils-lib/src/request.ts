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

import request from 'axios';
import { FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION,FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION, FSPIOP_HEADERS_SOURCE, FSPIOP_HEADERS_DESTINATION, FSPIOP_HEADERS_HTTP_METHOD, FSPIOP_HEADERS_SIGNATURE, FSPIOP_HEADERS_CONTENT_TYPE, FSPIOP_HEADERS_ACCEPT, FSPIOP_HEADERS_DATE } from './constants';
import { FspiopError, PutParticipant, PutParty } from './transformer';
import {ParticipantQueryResponseEvtPayload, PartyInfoRequestedEvtPayload, PartyQueryResponseEvtPayload, ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvt, AccountLookUpUnknownErrorPayload, AccountLookUpUnknownErrorEvent} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { FspiopRequestMethodsEnum, ResponseTypeEnum } from './enums';
import HeaderBuilder from './headers/header_builder';

export interface FspiopHttpHeaders {
  [FSPIOP_HEADERS_ACCEPT]: string;
  [FSPIOP_HEADERS_CONTENT_TYPE]: string;
  [FSPIOP_HEADERS_SOURCE]: string;
  [FSPIOP_HEADERS_DESTINATION]: string;
  [FSPIOP_HEADERS_HTTP_METHOD]: string;
  [FSPIOP_HEADERS_SIGNATURE]: string;
  [FSPIOP_HEADERS_DATE]: string;

}

// eslint-disable-next-line
type EventPayload = AccountLookUpUnknownErrorEvent | FspiopError | PutParticipant | ParticipantQueryResponseEvtPayload | PartyInfoRequestedEvtPayload | PartyQueryResponseEvtPayload  | ParticipantAssociationCreatedEvtPayload | ParticipantAssociationRemovedEvt | AccountLookUpUnknownErrorPayload | PutParty | Pick<PutParty, "party"> | null;

type RequestOptions = {
  url: string, 
  headers: FspiopHttpHeaders, 
  source: string, 
  destination: string | null, 
  method: FspiopRequestMethodsEnum, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any, 
  responseType?: ResponseTypeEnum, 
  protocolVersions?: { 
    content: typeof FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION; 
    accept: typeof FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION; 
  }
}

// Keep the following description since it's hard to detect
// Delete the default headers that the `axios` module inserts as they can break our conventions.
// By default it would insert `"Accept":"application/json, text/plain, */*"`.
delete request.defaults.headers.common.Accept;


export const sendRequest = async ({
  url, 
  headers, 
  source, 
  destination, 
  method = FspiopRequestMethodsEnum.GET, 
  payload, 
  responseType = ResponseTypeEnum.JSON, 
  protocolVersions = {
    content: FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION,
    accept: FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION
  }
}:RequestOptions) => {
    const config =  {
      httpMethod: method,
      sourceFsp: source,
      destinationFsp: destination as string,
      protocolVersions,
      headers
    };

    
    const builder = new HeaderBuilder();
    builder.setAccept(headers[FSPIOP_HEADERS_ACCEPT]);
    builder.setContentType(headers[FSPIOP_HEADERS_CONTENT_TYPE]);
    builder.setDate(headers[FSPIOP_HEADERS_DATE]);
    builder.setFspiopSource(headers[FSPIOP_HEADERS_SOURCE]);
    builder.setFspiopDestination(headers[FSPIOP_HEADERS_DESTINATION]);
    builder.setFspiopHttpMethod(headers[FSPIOP_HEADERS_HTTP_METHOD], config);

    const transformedHeaders = builder.getResult().build();

    
    const requestOptions = {
      url,
      method,
      headers: transformedHeaders,
      data: payload,
      responseType
    };

    const response = await request(requestOptions);

    return response;

};

export const buildEndpoint = (baseUrl: string, templateUrl: string) => {
  return `${baseUrl}${templateUrl}`;
};


export class URLBuilder {

    private readonly _base: URL;
    private _params: URLSearchParams;
    private _entity!: string;
    private _id!: string;
    private _location!: string;
    private _withError = false;

    constructor(url: string) {
        try {
            this._base = new URL(url);
            this._params = new URLSearchParams(this._base.search.slice(1));
        } catch (e: unknown) {
            throw Error('Not able to build url' + e);
        }
    }

    appendQueryParam(name: string, value: string) {
        this._params.append(name, value ? value.toString() : '');
    }

    clearQueryParams(): URLBuilder {
        this._params = new URLSearchParams();
        return this;
    }

    deleteQueryParam(name: string) {
        this._params.delete(name);
    }

    getBase(): URL {
        return this._base;
    }

    getPath(): string {
        return this._base.pathname;
    }

    getHostname(): string {
        return this._base.hostname;
    }

    getParams() {
        return this._params;
    }

    getQueryParam(name: string): string | void {
        if (!this._params) {
            return '';
        }

        const value = this._params.get(name);
        return (!value || value === 'undefined' || value === 'null') ? undefined : value;
    }

    getQueryString(): string {
        return this._params.toString();
    }

    setPath(path: string): URLBuilder {
        this._base.pathname = path;
        return this;
    }

    setEntity(value: string) {
        this._entity = value; 
    }

    setId(value: string) {
        this._id = value; 
    }

    setLocation(values: string[]) {
        const filtered = values.filter(x => x != null);
        
        this._location = filtered.join("/");
    }

    setQueryParam(name: string, value: string | number): URLBuilder {
        this._params.set(name, value ? value.toString() : '');
        return this;
    }

    setQueryString(value: string): URLBuilder | void {
        if (!value) {
            return;
        }

        if (value[0] === '?') {
            value = value.slice(1);
        }

        this._params = new URLSearchParams(value);
        return this;
    }

    hasError(value = true): URLBuilder | void {
        this._withError = value;
        
        return this;
    }

    build(): string {
        let url = this._base.toString().replace(/\/$/, ''); // This regular expression removes the '/' in case it exists in the last character
        const query = this._params.toString();

        if(this._entity) {
            url += `/${this._entity}`;
        }

        if(this._location) {
            url += `/${this._location}`;
        }

        if(this._id) {
            url += `/${this._id}`;
        }
        
        if(this._withError) {
            url += `/error`;
        }

        if (query !== '') {
            url = '?' + query;
        }

        return url;
    }
}