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

 "use strict"

import request from 'axios'
import { FSPIOP_REQUEST_METHODS, FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION,FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { transformHeaders } from './transformer';

 

// Keep the following description since it's hard to detect
// Delete the default headers that the `axios` module inserts as they can break our conventions.
// By default it would insert `"Accept":"application/json, text/plain, */*"`.
delete request.defaults.headers.common.Accept
type RequestOptions = {
  url: string, 
  headers: any, 
  source: any, 
  destination: any, 
  method: FSPIOP_REQUEST_METHODS, 
  payload: any, 
  responseType?: 'json', 
  protocolVersions?: { 
    accept: any; 
    content: any; 
  }
}
export const sendRequest = async ({
  url, 
  headers, 
  source, 
  destination, 
  method = FSPIOP_REQUEST_METHODS.GET, 
  payload = undefined, 
  responseType = 'json', 
  protocolVersions = {
    content: FSPIOP_HEADERS_DEFAULT_CONTENT_PROTOCOL_VERSION,
    accept: FSPIOP_HEADERS_DEFAULT_ACCEPT_PROTOCOL_VERSION
  }
}:RequestOptions):Promise<void> => {
  let requestOptions
  if (!url || !method || !headers || (method !== FSPIOP_REQUEST_METHODS.GET && method !== FSPIOP_REQUEST_METHODS.DELETE && !payload) || !source || !destination) {
    throw Error('Missing parameters for function')
  }
  try {
    const transformedHeaders = transformHeaders(headers, {
      httpMethod: method,
      sourceFsp: source,
      destinationFsp: destination,
      protocolVersions
    })
    requestOptions = {
      url,
      method,
      headers: transformedHeaders,
      data: payload,
      responseType
    }

    await request(requestOptions)

    return;
  } catch (error) {
    // In production, a list of errors is added
    throw Error('Failed to send HTTP request to host')
  }
}
 
 