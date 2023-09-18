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
import { AccountLookupBCTopics, PartyInfoAvailableEvt, PartyQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";


export const getCurrentKafkaOffset = async (topic: string): Promise<any> => {
    // const kafkaJsonProducerOptions: MLKafkaJsonProducerOptions = {
    //     kafkaBrokerList: KAFKA_URL,
    //     producerClientId: `${BC_NAME}_${APP_NAME}`,
    //     skipAcknowledgements: false, // never change this to true without understanding what it does
    // };

    // const logger = new KafkaLogger(
    //     BC_NAME,
    //     APP_NAME,
    //     APP_VERSION,
    //     kafkaJsonProducerOptions,
    //     KAFKA_LOGS_TOPIC,
    //     LOGLEVEL
    // );
    // await (logger as KafkaLogger).init();
    // const accountEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
    //     kafkaBrokerList: KAFKA_URL,
    //     kafkaGroupId: `${BC_NAME}_${APP_NAME}_AccountLookupEventHandler`,
    // };
    
    // const _logger = logger.createChild("this.constructor.name");


    // const kafkaConsumer = new MLKafkaJsonConsumer(accountEvtHandlerConsumerOptions, _logger);
    // // const kafkaProducer = new MLKafkaJsonProducer(kafkaJsonProducerOptions);

    // await kafkaConsumer.connect();

    // // kafkaProducer.setDeliveryReportFn((topic: string, partition: number, offset: number) => {
    // //     console.log(`Delivery report event - topic: ${topic}, partition: ${partition}, offset: ${offset}`);
    // //     return;
    // // });

    // async function handler(message: any): Promise<void> {
    //     logger.debug(`Got message in handler: ${JSON.stringify(message, null, 2)}`);
    //     return;
    // }
    
    // kafkaConsumer.setCallbackFn(handler);
    // kafkaConsumer.setTopics([AccountLookupBCTopics.DomainEvents,AccountLookupBCTopics.DomainRequests]);
    // await kafkaConsumer.connect();
    
    // // Start consuming to handler - waiting for the consumer to be fully rebalanced before proceeding
    // await kafkaConsumer.startAndWaitForRebalance();

    // return;
    // const offset = new kafka.Offset(client);

    // return new Promise((resolve, reject) => offset.fetchLatestOffsets([topic], (error: any, data: any) => {
    //     const offsetA = JSON.stringify(data[topic][0]) as unknown as number;

    //     let consumer = new kafka.Consumer(
    //         client,
    //         [
    //             {
    //                 topic: topic,
    //                 partition: 0,
    //                 offset: offsetA-1, // Offset value starts from 0
    //             }
    //         ], {
    //             autoCommit: false,
    //             fromOffset: true,
    //         }
    //     );
    //     consumer.on('message', async function (message) {
    //         error? reject(error) : resolve(message);

    //         consumer.close(false, () => {
    //             client.close();
    //         });
    //     });

    //     return;
    // }));
};

class KafkaConsumer {
    private _consumer: any;
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
        const accountEvtHandlerConsumerOptions: MLKafkaJsonConsumerOptions = {
            kafkaBrokerList: KAFKA_URL,
            kafkaGroupId: `${BC_NAME}_${APP_NAME}_test`,
        };
        

        this._consumer = new MLKafkaJsonConsumer(accountEvtHandlerConsumerOptions, logger);
 
        this._consumer.setTopics(this._topics);
        this._consumer.setCallbackFn(this.handler.bind(this));

        await this._consumer.connect();
        await this._consumer.startAndWaitForRebalance();

        // this._consumer.on("data", async (message:any) => {
        //     const messageJSON = JSON.parse(Buffer.from(message.value).toString());
        //     this.addEvent(messageJSON)
        // });
    }

    private async handler(message: any): Promise<void> {
        console.log(`Got message in handler: ${JSON.stringify(message, null, 2)}`);
        this._events.push(message);
        return;
    }

    public async destroy(): Promise<void> {
        await this._consumer.destroy(true)
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
}

export default KafkaConsumer;
