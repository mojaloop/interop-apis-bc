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
 import express from "express";
 import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
 import {Constants} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
 import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
 import { IncomingHttpHeaders } from "http";
 
 const getEnabledHeaders = (headers: IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([headerKey]) => Constants.FSPIOP_REQUIRED_HEADERS_LIST.includes(headerKey)));
 
 export class BulkQuotesRoutes {
     private _logger: ILogger;
     private _producerOptions: MLKafkaJsonProducerOptions;
     private _kafkaProducer: MLKafkaJsonProducer;
     private _kafkaTopic: string;
 
     private _router = express.Router();
 
     constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
         this._logger = logger.createChild("ParticipantRoutesbk");
         this._producerOptions = producerOptions;
         this._kafkaTopic = kafkaTopic;
         this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);
 
         // bind routes
 
     }
 
     get Router(): express.Router {
         return this._router;
     }
 
     
     async init(): Promise<void>{
         await this._kafkaProducer.connect();
     }
 
     async destroy(): Promise<void>{
         await this._kafkaProducer.destroy();
     }
 }
 