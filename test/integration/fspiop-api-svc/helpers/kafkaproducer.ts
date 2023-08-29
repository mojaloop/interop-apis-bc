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

import * as kafka from "kafka-node";

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";

export const getCurrentKafkaOffset = (topic: string): Promise<kafka.Message> => {
    const client = new kafka.KafkaClient({
        kafkaHost: KAFKA_URL
    });

    const offset = new kafka.Offset(client);

    return new Promise((resolve, reject) => offset.fetchLatestOffsets([topic], (error: any, data: any) => {
        const offsetA = JSON.stringify(data[topic][0]) as unknown as number;

        let consumer = new kafka.Consumer(
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

            consumer.close(false, () => {
                client.close();
            });
        });

        return;
    }));
};
//
// class KafkaProducer {
//     private producer: kafka.Producer;
//
//     public async init() {
//         this.producer = await this.create();
//     }
//
//     public async destroy(): Promise<void> {
//         this.producer.close()
//         this.producer
//
//     }
//
//     public sendMessage(topic: string, message: any) {
//         const payload = { topic, messages: Buffer.from(JSON.stringify(message)), attributes: 0, partition: 0, key: message.partyId };
//         return new Promise((resolve, reject) => {
//             this.producer.send([payload], function (err: any, data: kafka.Message) {
//                 (err) ? reject(err) : resolve(data);
//             });
//         });
//     }
//
//     private create(): Promise<kafka.Producer> {
//         const client = new kafka.KafkaClient({
//             kafkaHost: KAFKA_URL
//         });
//
//         const producer = new kafka.Producer(client);
//
//         return new Promise((resolve, reject) => {
//             producer.on("ready", () => {
//                 resolve(producer)
//             });
//         });
//     }
//
// }

// export default KafkaProducer;
