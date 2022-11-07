import * as kafka from "kafka-node";

const kafkaHost = "localhost:9092";

class KafkaProducer {
    private producer: kafka.Producer;

    public async init() {
        this.producer = await this.create();
    }

    public async destroy(): Promise<void> {
        this.producer.close()

    }

    public sendMessage(topic: string, message: any) {
        const payload = { topic, messages: [message], attributes: 0 };
        return new Promise((resolve, reject) => {
            this.producer.send([payload], function (err: any, data: kafka.Message) {
                (err) ? reject(err) : resolve(data);
            });
        });
    }

    private create(): Promise<kafka.Producer> {
        const client = new kafka.KafkaClient({kafkaHost});

        const producer = new kafka.Producer(client);

        return new Promise((resolve, reject) => {
            producer.on("ready", () => {
                resolve(producer)
            });
        });
    }

}

export default KafkaProducer;