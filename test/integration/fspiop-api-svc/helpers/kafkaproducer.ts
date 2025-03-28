/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict"

 import { MLKafkaJsonConsumer, MLKafkaJsonConsumerOptions, MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
 import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
 const packageJSON = require("../../../../package.json");
 import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const BC_NAME = "interop-apis-bc";
const APP_NAME = "fspiop-api-svc";
const APP_VERSION = packageJSON.version;
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const LOGLEVEL:LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;


class KafkaConsumer {
    private _consumer: any;
    private _producer: any;
    private _events:any[] = [];
    private _topics:any[] = [];

    constructor(topics:string[]) {
        this._topics = topics;
        this._events = [];
    }

    public async init() {
        const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
            kafkaBrokerList: KAFKA_URL,
            producerClientId: `${BC_NAME}_${APP_NAME}`,
            skipAcknowledgements: false
        };

        const logger = new KafkaLogger(
            BC_NAME,
            APP_NAME,
            APP_VERSION,
            kafkaJsonProducerOptions,
            KAFKA_LOGS_TOPIC,
            LOGLEVEL
        );
        await (logger as KafkaLogger).init();
        const handlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_test`,
        };


        this._consumer = new MLKafkaJsonConsumer(handlerConsumerOptions, logger);
        this._producer = new MLKafkaJsonProducer(kafkaJsonProducerOptions);

        this._consumer.setTopics(this._topics);
        this._consumer.setCallbackFn(this.handler.bind(this));

        await this._consumer.connect();
        await this._consumer.startAndWaitForRebalance();
        await this._producer.connect();

    }

    private async handler(message: any): Promise<void> {
        console.log(`Got message in handler: ${JSON.stringify(message, null, 2)}`);
        this._events.push(message);
        return;
    }

    public async destroy(): Promise<void> {
        await this._consumer.destroy(true)
        await this._producer.destroy();
        return;
    }

    public async clearEvents(): Promise<void> {
        this._events = [];
        return;
    }

    protected addEvent(message: any): void {
        this._events.push(message);
    }

    public getEvents(): any {
        return this._events;
    }

    public async sendMessage(message: any) {
        await this._producer.send(message);
    }
}

export default KafkaConsumer;
