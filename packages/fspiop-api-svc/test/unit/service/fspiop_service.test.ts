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

process.env.JWS_DISABLED = "true";

import { ConsoleLogger, ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import { Service } from "../../../src/index";

const messageConsumerStartRebalanceSpy = jest.fn();
const messageConsumerDestroySpy = jest.fn();
const messageProducerConnectSpy = jest.fn();
const messageProducerDestroySpy = jest.fn();

jest.mock("@mojaloop/platform-configuration-bc-client-lib", () => {
        return {
            ConfigurationClient: jest.fn().mockImplementation(() => {
                return {
                    init: jest.fn(),
                    fetch: jest.fn(),
                    bootstrap: jest.fn(),
                    globalConfigs: {
                        getCurrencies: jest.fn()
                    }
                }
            }),
            DefaultConfigProvider: jest.fn()
    }
});

jest.mock("@mojaloop/logging-bc-client-lib", () => {
    const original = jest.requireActual("@mojaloop/logging-bc-client-lib");
    return {
        ...original,
        KafkaLogger: jest.fn().mockImplementation(() => {
            return {
                init: jest.fn(),
                createChild: () => new ConsoleLogger(),
                info: jest.fn(),
                destroy: jest.fn()
            }
        }),
    }
});

jest.mock("@mojaloop/platform-shared-lib-nodejs-kafka-client-lib", () => {
    const original = jest.requireActual("@mojaloop/platform-shared-lib-nodejs-kafka-client-lib");
    return {
        ...original,
        MLKafkaJsonConsumer: jest.fn().mockImplementation(() => {
            return {
                setTopics: jest.fn(),
                setCallbackFn: jest.fn(),
                setBatchCallbackFn : jest.fn(),
                connect: jest.fn(),
                startAndWaitForRebalance: messageConsumerStartRebalanceSpy,
                destroy: messageConsumerDestroySpy
            }
        }),
        MLKafkaJsonProducer: jest.fn().mockImplementation(() => {
            return {
                connect: messageProducerConnectSpy,
                destroy: messageProducerDestroySpy
            }
        })
    }
});



jest.mock("@mojaloop/auditing-bc-client-lib");

const logger: ILogger = new ConsoleLogger();
logger.setLogLevel(LogLevel.FATAL);

describe("FSPIOP Service", () => {

    afterEach(async () => {
        jest.resetAllMocks();
    });

    afterAll(async () => {
        jest.clearAllMocks();

        await Service.stop();
    });

    test("should be able to run start the service successfully", async () => {
        // Arrange && Act
        await Service.start();

        // Assert
        expect(messageConsumerStartRebalanceSpy).toHaveBeenCalledTimes(3); 
        expect(messageProducerConnectSpy).toHaveBeenCalledTimes(4); 

    });

     test("should teardown instances successfully", async ()=> {
        // Arrange && Act
        await Service.stop();

        // Assert
        expect(messageConsumerDestroySpy).toHaveBeenCalledTimes(3); 
        expect(messageProducerDestroySpy).toHaveBeenCalledTimes(4); 
     });

     
 });