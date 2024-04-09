export interface SimpleConsumer {
    connect(): Promise<void>;
    handle(message: any): Promise<void>
    disconnect(): Promise<void>;
  }
  
  export class MyConsumer implements SimpleConsumer {
    private readonly consumer: any;
  
    connect(): Promise<void> {
      return this.consumer.connect()
        .then(() => this.consumer.subscribe({ topic: "this.config.topic" }))
        .then(() => this.consumer.run({ eachMessage: payload => this.handle(payload) }))
        .catch(e => console.log(`Can't connect ${e}`));
    }
    
    async handle({ topic, partition, message }: any): Promise<void> {
      // handling of received message
    }
  
    disconnect(): Promise<void> {
      return this.consumer.disconnect()
        .catch(e => console.log(`Error on disconnect ${e}`));
    }
  }