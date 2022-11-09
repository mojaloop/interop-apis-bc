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

 import {MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
 import { AccountLookupBCTopics, ParticipantAssociationCreatedEvt, ParticipantAssociationCreatedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
 import { SlowBuffer } from "buffer";
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
 
 // Sets the location of your OpenAPI Specification file
 // jestOpenAPI(path.join(__dirname, '../../src/api-specs/account-look-service/api-swagger.yaml'));
 
 const BC_NAME = "interop-apis-bc";
 const APP_NAME = "fspiop-api-svc";
 
 const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
 
 const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
     kafkaBrokerList: KAFKA_URL,
     producerClientId: `${BC_NAME}_${APP_NAME}`,
     skipAcknowledgements: true,
 };
 
 import * as kafka from "kafka-node";
 import kafkaProducer1 from "./kafkaproducer";
 
 const kafkaProducer = new kafkaProducer1()
 
 const kafkaHost = "localhost:9092";
 
 // const KAFKA_ACCOUNTS_LOOKUP_TOPIC = process.env["KAFKA_ACCOUNTS_LOOKUP_TOPIC"] || AccountLookupBCTopics.DomainEvents;
 const KAFKA_ACCOUNTS_LOOKUP_TOPIC = 'AccountLookupBcRequests';
 
 const getCurrentKafkaOffset = (topic: string): Promise<kafka.Message> => {
     const client = new kafka.KafkaClient({kafkaHost});
     const offset = new kafka.Offset(client);
     return new Promise((resolve, reject) => offset.fetchLatestOffsets([topic], (error: any, data: any) => {
         const offsetA = JSON.stringify(data[topic][0]) as unknown as number;
         console.log('offset Value:: '+offsetA);
         var consumer = new kafka.Consumer(
             client,
             [
                 {
                     topic: topic,
                     partition: 0,
                     offset: offsetA-1, // Offset value starts from 0
                 }
             ], {
                 autoCommit: false,
                 fromOffset: true,
             }
         );
         consumer.on('message', async function (message) {
             error? reject(error) : resolve(message);
 
             consumer.close(true, () => {});
         });
     }));
 };
 jest.setTimeout(100000);
 
 
 describe("placeholder", () => {
     // it("should send message to kafka", async () => {
     //     await kafkaProducer.init();
     //     const topic = KAFKA_ACCOUNTS_LOOKUP_TOPIC;
     //     const someMessage = "some message";
     //     const expectedOffset = await getCurrentKafkaOffset(topic) as number;
         
     //     kafkaProducer.sendMessage(topic, someMessage);
         
     //     const currentOffset = await getCurrentKafkaOffset(topic) as number;
     //     const sentMessagesCount = currentOffset - expectedOffset;
     //     expect(sentMessagesCount).toBe(1);
     //     console.log("!!!!!!!!!!!!!!!!!");
     //     console.log("!!!!!!!!!!!!!!!!!");
     //     console.log(sentMessagesCount);
     //     console.log("!!!!!!!!!!!!!!!!!");
     //     console.log("!!!!!!!!!!!!!!!!!");
     //     kafkaProducer.destroy();
     // });
 
     it('should successfully call getPartyQueryReceivedByTypeAndId endpoint', async () => {
         const res = await request(server)
         .post('/parties/MSISDN/123456789')
         .set(workingHeaders)
 
         expect(res.statusCode).toEqual(202)
         expect(res.body).toStrictEqual(goodStatusResponse)
 
         await kafkaProducer.init();
         const topic = KAFKA_ACCOUNTS_LOOKUP_TOPIC;
         const payload : ParticipantAssociationCreatedEvtPayload = {
             ownerFspId:"test-fspiop-source",
             partyId: '123456789',
             partyType: 'MSISDN',
             partySubType: null
         };
 
         const event = new ParticipantAssociationCreatedEvt(payload);
 
         event.fspiopOpaqueState = { 
             "requesterFspId":"test-fspiop-source",
             "destinationFspId": null,
             "headers":{
                 "accept":"application/vnd.interoperability.parties+json;version=1.0",
                 "content-type":"application/vnd.interoperability.parties+json;version=1.0",
                 "date":"randomdate",
                 "fspiop-source":"test-fspiop-source"
             }
         };
 
         const expectedOffset = await getCurrentKafkaOffset(topic);
         
         kafkaProducer.sendMessage('AccountLookupBcEvents', event);
 
         let sentMessagesCount = 0;
         const currentOffset = await getCurrentKafkaOffset(topic);
         
         console.log(expectedOffset);
         if (currentOffset.offset && expectedOffset.offset) {
             sentMessagesCount = currentOffset.offset - expectedOffset.offset;
         }
         console.log(currentOffset);
 
 
         // expect(sentMessagesCount).toBe(1);
         kafkaProducer.destroy();
     })

 });