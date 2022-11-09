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

import { start } from "../../src/service";

 const jestOpenAPI = require('jest-openapi');
 const request = require('supertest');
 const path = require('path');
 // const server = require('./server');
 const server = "http://localhost:4000";
 const workingHeaders = { 
   'accept': 'application/vnd.interoperability.parties+json;version=1.0',
   'content-type': 'application/vnd.interoperability.parties+json;version=1.0',
   'date': 'randomdate',
   'fspiop-source': 'test-fspiop-source',
 }
 
 const missingHeaders = { 
   'accept': 'application/vnd.interoperability.parties+json;version=1.0',
   'content-type': 'application/vnd.interoperability.parties+json;version=1.0',
 }
 
 const goodStatusResponse = {
   "status": "ok"
 }
 
 const badStatusResponse = {
   "status": "not ok"
 }
 
 jest.mock('../../src/http_routes/party_routes');
 
 jestOpenAPI(path.join(__dirname, '../../src/api-specs/account-look-service/api-swagger.yaml'));
 
describe("FSPIOP API Service Participant Routes", () => {
  beforeAll(async () => {
      await start();
  });
  
  it('should successfully call getPartyQueryReceivedByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should successfully call getPartyQueryReceivedByTypeAndIdSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
    })
 
   it('should successfully call getPartyInfoAvailableByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should successfully call getPartyInfoAvailableByTypeAndIdAndSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should successfully call associatePartyByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should successfully call associatePartyByTypeAndIdAndSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should successfully call disassociatePartyByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should successfully call disassociatePartyByTypeAndIdAndSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(workingHeaders)
 
     expect(res.statusCode).toEqual(202)
     expect(res.body).toStrictEqual(goodStatusResponse)
   })
 
   it('should give a bad request calling getPartyQueryReceivedByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 
   it('should give a bad request calling getPartyQueryReceivedByTypeAndIdSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
 
    //  expect(res).toSatisfyApiSpec();
 
   })
 
   it('should give a bad request calling getPartyInfoAvailableByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 
   it('should give a bad request calling getPartyInfoAvailableByTypeAndIdAndSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 
   it('should give a bad request calling associatePartyByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 
   it('should give a bad request calling associatePartyByTypeAndIdAndSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 
   it('should give a bad request calling disassociatePartyByTypeAndId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 
   it('should give a bad request calling disassociatePartyByTypeAndIdAndSubId endpoint', async () => {
     const res = await request(server)
       .post('/parties/MSISDN/123456789/randomsubtype')
       .set(missingHeaders)
 
     expect(res.statusCode).toEqual(400)
     expect(res.body).toStrictEqual(badStatusResponse)
   })
 });