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

* Crosslake
- Pedro Sousa Barreto <pedrob@crosslaketech.com>

--------------
******/

"use strict";
import express from "express";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { deserializeIlpPacket } from 'ilp-packet';
import {Currency, IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import { FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";

export abstract class BaseRoutes {
    private _logger: ILogger;
    private _producerOptions: MLKafkaJsonProducerOptions;
    private _kafkaProducer: MLKafkaJsonProducer;
    private _kafkaTopic: string;
    private _configClient: IConfigurationClient;
    
    private _router = express.Router();
    
    protected _currencyList: Currency[];
    protected _validator: FspiopValidator;

    constructor(
        configClient: IConfigurationClient,
        producerOptions: MLKafkaJsonProducerOptions,
        kafkaTopic: string,
        logger: ILogger
    ) {
        this._configClient = configClient;
        this._producerOptions = producerOptions;
        this._kafkaTopic = kafkaTopic;
        this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);
        this._logger = logger;
        this._currencyList = this._configClient.globalConfigs.getCurrencies();
        this._validator = new FspiopValidator(this._currencyList);
    }

    get logger(): ILogger {
        return this._logger;
    }

    get kafkaProducer(): MLKafkaJsonProducer {
        return this._kafkaProducer;
    }

    get router(): express.Router {
        return this._router;
    }

    async init(): Promise<void>{
        await this._kafkaProducer.connect();
    }

    async destroy(): Promise<void>{
        await this._kafkaProducer.destroy();
    }

    async decodeIlpPacket (base64IlpPacket:string): Promise<object> {
        let decodedIlpPacketDataJsonString = null;
        try {
            const ilpPacketBuffer:any = Buffer.from(base64IlpPacket, "base64");
            const decodedIlpPacket:any = deserializeIlpPacket(ilpPacketBuffer);
            decodedIlpPacketDataJsonString = await JSON.parse(
                Buffer.from(decodedIlpPacket.data.data.toString("utf8"), "base64").toString("utf8")
            );
        } catch (error: unknown) {
            console.error("Unable to decode ILP Packet", (error as Error).message);
        }

        return decodedIlpPacketDataJsonString;
    }
}
