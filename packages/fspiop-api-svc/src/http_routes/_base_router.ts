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
import { FspiopJwsSignature, FspiopValidator } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {IHistogram, IMetrics} from "@mojaloop/platform-shared-lib-observability-types-lib";

export abstract class BaseRoutes {
    private _logger: ILogger;
    private _kafkaProducer: IMessageProducer;
    private _router = express.Router();

    protected _validator: FspiopValidator;
    protected _jwsHelper: FspiopJwsSignature;

    constructor(
        producer: IMessageProducer,
        validator: FspiopValidator,
        jwsHelper: FspiopJwsSignature,
        logger: ILogger
    ) {
        this._kafkaProducer = producer;
        this._logger = logger.createChild(this.constructor.name);
        this._validator = validator;
        this._jwsHelper = jwsHelper;
    }

    get logger(): ILogger {
        return this._logger;
    }

    get kafkaProducer(): IMessageProducer {
        return this._kafkaProducer;
    }

    get router(): express.Router {
        return this._router;
    }

    async init(): Promise<void>{
        return Promise.resolve();
    }

    async destroy(): Promise<void>{
        return Promise.resolve();
    }

}
