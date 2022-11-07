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

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 * Gonçalo Garcia <goncalogarcia99@gmail.com>
 
 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 **/

 "use strict";


 // Logger.
 import {ConsoleLogger, ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
 import { IMessage, IMessageProducer, MessageTypes } from "@mojaloop/platform-shared-lib-messaging-types-lib";
 import {Party} from "../../src/entities/party";
 import {Participant} from "../../src/entities/partipant";
 import {
     AccountLookupAggregate,
     InvalidMessagePayloadError,
     InvalidMessageTypeError,
     InvalidParticipantIdError,
     InvalidParticipantTypeError,
     InvalidPartyIdError,
     InvalidPartyTypeError,
     IOracleFinder,
     IOracleProvider,
     IParticipant,
     IParticipantService,
     NoSuchOracleProviderError,
     NoSuchParticipantError,
     NoSuchParticipantFspIdError,
     RequiredParticipantIsNotActive,
     UnableToAssociatePartyError,
     UnableToDisassociatePartyError,
     UnableToGetOracleError,
 } from "../../src";
import { MemoryOracleFinder } from "./mocks/memory_oracle_finder";
import { MemoryMessageProducer } from "./mocks/memory_message_producer";
import { mockedOracleList, mockedParticipantIds, mockedPartyIds, mockedPartyTypes } from "./mocks/data";
import { MemoryOracleProvider } from "./mocks/memory_oracle_providers";
import { MemoryParticipantService } from "./mocks/memory_participant_service";
import { AccountLookUperrorEvtPayload, ParticipantAssociationCreatedEvtPayload, ParticipantAssociationRemovedEvtPayload, ParticipantAssociationRequestReceivedEvt, ParticipantAssociationRequestReceivedEvtPayload, ParticipantDisassociateRequestReceivedEvt, ParticipantDisassociateRequestReceivedEvtPayload, ParticipantQueryReceivedEvt, ParticipantQueryReceivedEvtPayload, ParticipantQueryResponseEvtPayload, PartyInfoAvailableEvt, PartyInfoAvailableEvtPayload, PartyInfoRequestedEvt, PartyInfoRequestedEvtPayload, PartyQueryReceivedEvt, PartyQueryReceivedEvtPayload, PartyQueryResponseEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { MLKafkaJsonConsumerOptions, MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { AccountLookupEventHandler } from "../../src/event_handlers/account_lookup_evt_handler";
import { ParticipantsHttpClient } from "@mojaloop/participants-bc-client-lib";

const logger: ILogger = new ConsoleLogger();
logger.setLogLevel(LogLevel.FATAL);

const KAFKA_URL = "test";

const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const APP_VERSION = "0.0.1";

const kafkaJsonConsumerOptions: MLKafkaJsonConsumerOptions = {
  kafkaBrokerList: KAFKA_URL,
  kafkaGroupId: `${BC_NAME}_${APP_NAME}`,
};

const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
  kafkaBrokerList: KAFKA_URL,
  producerClientId: `${BC_NAME}_${APP_NAME}`,
  skipAcknowledgements: true,
};


const PARTICIPANT_SVC_BASEURL = process.env["PARTICIPANT_SVC_BASEURL"] || "http://127.0.0.1:3010";
const fixedToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InVVbFFjbkpJUk93dDIxYXFJRGpRdnVnZERvUlYzMzEzcTJtVllEQndDbWMifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwYXJ0aWNpcGFudHMtc3ZjIiwicm9sZXMiOlsiNTI0YTQ1Y2QtNGIwOS00NmVjLThlNGEtMzMxYTVkOTcyNmVhIl0sImlhdCI6MTY2Njc3MTgyOSwiZXhwIjoxNjY3Mzc2NjI5LCJhdWQiOiJtb2phbG9vcC52bmV4dC5kZWZhdWx0X2F1ZGllbmNlIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDozMjAxLyIsInN1YiI6ImFwcDo6cGFydGljaXBhbnRzLXN2YyIsImp0aSI6IjMzNDUyODFiLThlYzktNDcyOC1hZGVkLTdlNGJmMzkyMGZjMSJ9.s2US9fEAE3SDdAtxxttkPIyxmNcACexW3Z-8T61w96iji9muF_Zdj2koKvf9tICd25rhtCkolI03hBky3mFNe4c7U1sV4YUtCNNRgReMZ69rS9xdfquO_gIaABIQFsu1WTc7xLkAccPhTHorartdQe7jvGp-tOSkqA-azj0yGjwUccFhX3Bgg3rWasmJDbbblIMih4SJuWE7MGHQxMzhX6c9l1TI-NpFRRFDTYTg1H6gXhBvtHMXnC9PPbc9x_RxAPBqmMcleIJZiMZ8Cn805OL9Wt_sMFfGPdAQm0l4cdjdesgfQahsrtCOAcp5l7NKmehY0pbLmjvP6zlrDM_D3A";

let participantServiceClient: ParticipantsHttpClient;

participantServiceClient = new ParticipantsHttpClient(logger, PARTICIPANT_SVC_BASEURL, fixedToken, 5000);

const accountEvtHandler: AccountLookupAggregate = new AccountLookupEventHandler(
  logger,
  kafkaJsonConsumerOptions,
  kafkaJsonProducerOptions,
  [],
  participantServiceClient
);

describe("Account Lookup Domain", () => {
       
    afterEach(async () => {
        jest.resetAllMocks();
    });

    //#region Party entity
    test("should create a new party entity", async()=>{
        // Arrange 
        const id="fakeId";
	    const type="fake type";
        const currency= "fake currency";
	    const subId="fake sub id";

        // Act
        accountEvtHandler.processMessage()
        accountEvtHandler._handleErrorReceivedEvt()

        // Assert
        // expect(party.id).toBe(id);
        // expect(party.type).toBe(type);
        // expect(party.currency).toBe(currency);
        // expect(party.subId).toBe(subId);
        
    });

    test("should throw error if party id is not valid", async()=>{
      // Arrange 
      const id="";
      const type="fake type";
      const currency= "fake currency";
      const subId="fake sub id";

      // Act
      const party = new Party(id, type, currency, subId);


      // Assert
      expect(() => {
          Party.validateParty(party);
      }).toThrowError(InvalidPartyIdError);


    });

    //#endregion

});

