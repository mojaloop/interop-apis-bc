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
import { FspiopError, PutParticipant, PutParty, transformHeaders } from './transformer';
import {ParticipantQueryResponseEvtPayload, PartyInfoRequestedEvtPayload, PartyQueryResponseEvtPayload, ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvt, AccountLookUperrorEvtPayload, AccountLookUperrorEvt} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { EntityTypeEnum, FspiopRequestMethodsEnum, ResponseTypeEnum } from './enums';
import HeaderBuilder from './account-lookup/headers/header_builder';
import AccountLookupHeaderDirector from './account-lookup/headers/account_lookup_director';

export interface FspiopHttpHeaders {
  [FSPIOP_HEADERS_ACCEPT]: string;
  [FSPIOP_HEADERS_CONTENT_TYPE]: string;
  [FSPIOP_HEADERS_SOURCE]: string;
  [FSPIOP_HEADERS_DESTINATION]: string;
  [FSPIOP_HEADERS_HTTP_METHOD]: string;
  [FSPIOP_HEADERS_SIGNATURE]: string;
  [FSPIOP_HEADERS_DATE]: string;

}

type EventPayload = AccountLookUperrorEvt | FspiopError | PutParticipant | ParticipantQueryResponseEvtPayload | PartyInfoRequestedEvtPayload | PartyQueryResponseEvtPayload  | ParticipantAssociationCreatedEvtPayload | ParticipantAssociationRemovedEvt | AccountLookUperrorEvtPayload | PutParty | Pick<PutParty, "party">;

type RequestOptions = {
  url: string, 
  headers: FspiopHttpHeaders, 
  source: string, 
  destination: string | null, 
  method: FspiopRequestMethodsEnum, 
  payload: EventPayload, 
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
}:RequestOptions):Promise<void> => {
  let requestOptions;
    // if (!url || !method || !headers || (method !== FspiopRequestMethodsEnum.GET && method !== FspiopRequestMethodsEnum.DELETE && !payload) || !source || !destination) {
    //   throw Error('Missing parameters for function');
    // }

    const config =  {
      httpMethod: method,
      sourceFsp: source,
      destinationFsp: destination as string,
      protocolVersions,
      headers
    };

    
    const builder = new HeaderBuilder();
    builder.setAccept(headers[FSPIOP_HEADERS_ACCEPT], config);
    builder.setContentType(headers[FSPIOP_HEADERS_CONTENT_TYPE], config);
    builder.setDate(headers[FSPIOP_HEADERS_DATE])
    builder.setFspiopSource(headers[FSPIOP_HEADERS_SOURCE]);

    const transformedHeaders = transformHeaders({ headers, config });

    // const transformedHeaders = builder.getResult().construction();
    // const director = new AccountLookupHeaderDirector();
    // director.setBuilder(builder);
    
    requestOptions = {
      url,
      method,
      headers: transformedHeaders,
      data: payload,
      responseType
    };

    await request(requestOptions);

    return;

};

export const buildEndpoint = (baseUrl: string, templateUrl: string) => {
  return `${baseUrl}${templateUrl}`;
};


type BuildRequestUrlOptions = {
  entity: EntityTypeEnum, 
  partyType: string,
  partyId: string,
  partySubType: string | null,
  error?: boolean
}

export const buildRequestUrl = (options: BuildRequestUrlOptions): string  => {   

	let partialUrl = `/${options.entity}/${options.partyType}/${options.partyId}`;

  if(options.partySubType) {
    partialUrl += `/${options.partySubType}`;
  } 

  if(options.error) {
    partialUrl += '/error';
  } 

	return partialUrl;
};