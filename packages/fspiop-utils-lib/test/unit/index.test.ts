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
 
 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 **/

 "use strict";


import { FSPIOP_HEADERS_ACCEPT, FSPIOP_HEADERS_CONTENT_TYPE, FSPIOP_HEADERS_DATE, FSPIOP_HEADERS_DESTINATION, FSPIOP_HEADERS_HTTP_METHOD, FSPIOP_HEADERS_SIGNATURE, FSPIOP_HEADERS_SOURCE } from "../../src/constants";
import { EntityTypeEnum, FspiopRequestMethodsEnum } from "../../src/enums";
import { buildRequestUrl, sendRequest } from "../../src/request";
import axios from "axios";

jest.mock('axios');

describe("FSPIOP Utils Lib", () => {
       
    afterEach(async () => {
        jest.resetAllMocks();
    });

    //#region Request
    test("sendRequest should be able to send a request", async()=>{
        // Arrange 
        const partyType = 'MSISDN';
        const partyId = '123456789';
        const partySubType = 'randomsubtype';

        const response = [
            { test: "random response" },
        ];
        
        (axios as unknown as jest.Mock).mockResolvedValueOnce(response)       
        
        // Act
        await sendRequest({
            url: 'testurl', 
            headers: {
                [FSPIOP_HEADERS_CONTENT_TYPE]: '1', 
                [FSPIOP_HEADERS_SOURCE]: '1', 
                [FSPIOP_HEADERS_DESTINATION]: '1',
                [FSPIOP_HEADERS_ACCEPT]: '1',
                [FSPIOP_HEADERS_HTTP_METHOD]: '1',
                [FSPIOP_HEADERS_SIGNATURE]: '1',
                [FSPIOP_HEADERS_DATE]: '1'
            }, 
            source: '1', 
            destination: '2',
            method: FspiopRequestMethodsEnum.PUT,
            payload: {
                fspId: '1',
            },            
        });


        // Assert
        expect(axios).toBeCalledWith({
            "data": {
             "fspId": "1",
            },
            "headers": {
             "content-type": "1",
             "date": "Mon, 01 Jan 2001 00:00:00 GMT",
             "fspiop-destination": "2",
             "fspiop-http-method": "PUT",
             "fspiop-signature": "1",
             "fspiop-source": "1",
            },
            "method": "PUT",
           "responseType": "json",
           "url": "testurl",
          });
        });


    test("request", async()=>{
        // Arrange 
        const partyType = 'MSISDN';
        const partyId = '123456789';
        const partySubType = 'randomsubtype';

        // Act
        const result = buildRequestUrl ({
            entity: EntityTypeEnum.PARTICIPANTS,
            partyType, 
            partyId, 
            partySubType,
            error: false
        });


        // Assert
        expect(result).toBe(`/${EntityTypeEnum.PARTICIPANTS}/${partyType}/${partyId}/${partySubType}`);
    });

   
    //#endregion

        //#region Transformer
        test("transformer", async()=>{
            
        });
    
       
    //#endregion

});

