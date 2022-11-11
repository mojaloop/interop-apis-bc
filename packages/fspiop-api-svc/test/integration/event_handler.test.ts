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

 import { Request } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
 import { AccountLookupEventHandler } from "../../src/event_handlers/account_lookup_evt_handler";
 import {MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
 import { AccountLookUperrorEvt, AccountLookUperrorEvtPayload, ParticipantAssociationCreatedEvt, ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvt, ParticipantQueryResponseEvt, ParticipantQueryResponseEvtPayload, PartyInfoRequestedEvt, PartyInfoRequestedEvtPayload, PartyQueryReceivedEvt, PartyQueryResponseEvt, PartyQueryResponseEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";

import jestOpenAPI from 'jest-openapi';

 // Sets the location of your OpenAPI Specification file
 jestOpenAPI('C:/Users/dinacellfx/Documents/Development/interop-apis-bc/packages/fspiop-api-svc/api-specs/account-lookup-service/api-swagger.yaml');
 
 const BC_NAME = "interop-apis-bc";
 const APP_NAME = "fspiop-api-svc";
 
 const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
 
 const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
     kafkaBrokerList: KAFKA_URL,
     producerClientId: `${BC_NAME}_${APP_NAME}`,
     skipAcknowledgements: true,
 };

 import * as kafka from "kafka-node";
import { start, stop } from "../../src/service";
 import KafkaProducer from "./helpers/kafkaproducer";
 
 const kafkaProducer = new KafkaProducer()
 
 const kafkaHost = "localhost:9092";
 const localhostUrl = 'http://127.0.0.1:4040';
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
 jest.setTimeout(65000);
 
 describe("placeholder", () => {

    beforeAll(async () => {
        await start();
        await kafkaProducer.init();
    });
    
    afterAll(async () => {
        await stop();
        kafkaProducer.destroy();
    });
    
    it('successful AccountLookUperrorEvt', async () => {
        // Arrange
        const payload : AccountLookUperrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            partyId: '123456789',
            partyType: 'MSISDN',
            partySubType: null,
            errorMsg: 'test error message',
            sourceEvent: PartyQueryReceivedEvt.name,
        };

        const event = new AccountLookUperrorEvt(payload);

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
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
         
        await new Promise((r) => setTimeout(r, 55000));
         
        // Assert
        expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
            url: `${localhostUrl}/parties/MSISDN/123456789/error`
        }));

        expect(await res()).toSatisfyApiSpec();
    })

    it('error AccountLookUperrorEvt', async () => {
        // Arrange
        const payload : AccountLookUperrorEvtPayload = {
            requesterFspId: "test-fspiop-source",
            partyId: '123456789',
            partyType: 'MSISDN',
            partySubType: null,
            errorMsg: 'test error message',
            sourceEvent: 'non-existing-source-event',
        };

        const event = new AccountLookUperrorEvt(payload);

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
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');
         
        await new Promise((r) => setTimeout(r, 55000));
         
        // Assert
         expect(Request.sendRequest).toHaveBeenCalledTimes(0);

    })

    it('ParticipantAssociationCreatedEvt', async () => {
        // Arrange
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
        
        if (currentOffset.offset && expectedOffset.offset) {
            sentMessagesCount = currentOffset.offset - expectedOffset.offset;
        }

        jest.spyOn(Request, 'sendRequest');

        const apiSpy = jest.spyOn(Request, 'sendRequest');
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[0].value;
        }
         await new Promise((r) => setTimeout(r, 55000));
         
         expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
            url: `${localhostUrl}/parties/MSISDN/123456789`
        }));


        expect(await res()).toSatisfyApiSpec();

    })

    it('should throw error ParticipantAssociationCreatedEvt due to missing payload', async () => {
        // Arrange
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
                "fspiop-source":"test-fspiop-source"
            }
        };
        
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const apiSpy = jest.spyOn(Request, 'sendRequest');
        const res = async (): Promise<any> => {
            return await apiSpy.mock.results[0].value;
        }
         await new Promise((r) => setTimeout(r, 55000));
         
         expect(Request.sendRequest).toHaveBeenCalled();


        expect(await res()).toSatisfyApiSpec();

    })

    it('ParticipantAssociationCreatedEvt', async () => {
        // Arrange
         const topic = KAFKA_ACCOUNTS_LOOKUP_TOPIC;
         const payload : ParticipantAssociationCreatedEvtPayload = {
             ownerFspId:"test-fspiop-source",
             partyId: '123456789',
             partyType: 'MSISDN',
             partySubType: null
         };
 
         const event = new ParticipantAssociationRemovedEvt(payload);
 
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
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
         
        await new Promise((r) => setTimeout(r, 55000));
         
        // Assert
         expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
            url: `${localhostUrl}/parties/MSISDN/123456789`
        }));

        expect(await res()).toSatisfyApiSpec();
    })

    it('successful PartyInfoRequestedEvt', async () => {
        // Arrange
        const payload : PartyInfoRequestedEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: 'test-fspiop-destination',
            partyId: '123456789',
            partyType: 'MSISDN',
            partySubType: null,
            currency: null
        };

        const event = new PartyInfoRequestedEvt(payload);

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
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
         
        await new Promise((r) => setTimeout(r, 55000));
         
        // Assert
         expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
            url: `${localhostUrl}/parties/MSISDN/123456789`
        }));

        expect(await res()).toSatisfyApiSpec();
    })

    it('successful PartyQueryResponseEvt', async () => {
        // Arrange
        const payload : PartyQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            destinationFspId: 'test-fspiop-destination',
            ownerFspId: 'test-fspiop-owner',
            partyId: '123456789',
            partyType: 'MSISDN',
            partyName: 'test-party-name',
            partyDoB: new Date(),
            partySubType: null,
            currency: null
        };

        const event = new PartyQueryResponseEvt(payload);

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
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
         
        await new Promise((r) => setTimeout(r, 55000));
         
        // Assert
         expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
            url: `${localhostUrl}/parties/MSISDN/123456789`
        }));

        expect(await res()).toSatisfyApiSpec();
    })

    it('successful ParticipantQueryResponseEvt', async () => {
        // Arrange
        const payload : ParticipantQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            ownerFspId: 'test-fspiop-owner',
            partyId: '123456789',
            partyType: 'MSISDN',
            partySubType: null,
            currency: null
        };

        const event = new ParticipantQueryResponseEvt(payload);

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
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
         
        await new Promise((r) => setTimeout(r, 55000));
         
        // Assert
         expect(Request.sendRequest).toHaveBeenCalledWith(expect.objectContaining({
            url: `${localhostUrl}/participants/MSISDN/123456789`
        }));

        expect(await res()).toSatisfyApiSpec();
    })

    it('should throw error ParticipantQueryResponseEvt due to missing payload', async () => {
        // Arrange
        const payload : ParticipantQueryResponseEvtPayload = {
            requesterFspId: "test-fspiop-source",
            ownerFspId: 'test-fspiop-owner',
            partyId: '123456789',
            partyType: 'MSISDN',
            partySubType: null,
            currency: null
        };

        const event = new ParticipantQueryResponseEvt(payload);

        event.fspiopOpaqueState = { 
            "requesterFspId":"test-fspiop-source",
            "destinationFspId": null,
            "headers":{
                "accept":"application/vnd.interoperability.undefined+json;version=1.0",
                "content-type":"application/vnd.interoperability.undefined+json;version=1.0",
                "fspiop-source":"test-fspiop-source",
                "date": "randomdate"
            }
        };
          
        const requestSpy = jest.spyOn(Request, 'sendRequest');

        // Act
        kafkaProducer.sendMessage('AccountLookupBcEvents', event);

        jest.spyOn(Request, 'sendRequest');

        const res = async (): Promise<any> => {
            return await requestSpy.mock.results[0].value;
        }
         
        await new Promise((r) => setTimeout(r, 45000));
         
        // Assert
        expect(Request.sendRequest).toHaveBeenCalledWith({"destination": "test-fspiop-source", "headers": {"accept": "application/vnd.interoperability.undefined+json;version=1.0", "content-type": "application/vnd.interoperability.undefined+json;version=1.0", "date": "randomdate", "fspiop-destination": "test-fspiop-source", "fspiop-source": "switch"}, "method": "PUT", "payload": {"fspId": "test-fspiop-owner"}, "source": "test-fspiop-source", "url": "http://127.0.0.1:4040/participants/MSISDN/123456789"});

        expect(await res()).toSatisfyApiSpec();
    })
 });