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
 import { RestMethods } from "@mojaloop/interop-apis-bc-fspiop-utils-lib/dist/constants";
import { transformHeaders } from './transformer';

 
 const MISSING_FUNCTION_PARAMETERS = 'Missing parameters for function'
 
 // Delete the default headers that the `axios` module inserts as they can brake our conventions.
 // By default it would insert `"Accept":"application/json, text/plain, */*"`.
 delete request.defaults.headers.common.Accept
 
 export const sendRequest = async (url: any, headers: any, source: any, destination: any, method = RestMethods.GET, payload = undefined, responseType = 'json', span = undefined, jwsSigner = undefined, protocolVersions = undefined) => {

   let requestOptions
   if (!url || !method || !headers || (method !== RestMethods.GET && method !== RestMethods.DELETE && !payload) || !source || !destination) {
     throw ErrorHandler.Factory.createInternalServerFSPIOPError(MISSING_FUNCTION_PARAMETERS)
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
     // if jwsSigner is passed then sign the request
    //  if (jwsSigner != null && typeof (jwsSigner) === 'object') {
    //    requestOptions.headers['fspiop-signature'] = jwsSigner.getSignature(requestOptions)
    //  }
 
     const response = await request(requestOptions)

     return response
   } catch (error) {
    const extensionArray = [
       { key: 'url', value: url },
       { key: 'sourceFsp', value: source },
       { key: 'destinationFsp', value: destination },
       { key: 'method', value: method },
       { key: 'request', value: JSON.stringify(requestOptions) },
       { key: 'errorMessage', value: error.message }
     ]
     const extensions = []
     if (error.response) {
       extensionArray.push({ key: 'status', value: error.response && error.response.status })
       extensionArray.push({ key: 'response', value: error.response && error.response.data })
       extensions.push({ key: 'status', value: error.response && error.response.status })
     }
     const cause = JSON.stringify(extensionArray)
     extensions.push({ key: 'cause', value: cause })
     const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Failed to send HTTP request to host', error, source, extensions)

     throw fspiopError
   }
 }
 
 