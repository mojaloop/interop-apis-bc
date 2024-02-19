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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

"use strict";
import {
  Constants,
  FspiopJwsSignature,
  FspiopValidator,
  Transformer,
  ValidationdError,
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
  FxQueryReceivedEvt,
  FxQueryReceivedEvtPayload,
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import express from "express";
import { FSPIOPErrorCodes } from "../../validation";
import { BaseRoutes } from "../_base_router";

export class ForeignExchangeRoutes extends BaseRoutes {
  constructor(
    producer: IMessageProducer,
    validator: FspiopValidator,
    jwsHelper: FspiopJwsSignature,
    logger: ILogger
  ) {
    super(producer, validator, jwsHelper, logger);

    // bind routes

    this.router.get("/fxp", this.fxpServicesReceived.bind(this));
  }

  get Router(): express.Router {
    return this.router;
  }

  private async fxpServicesReceived(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> {
    this.logger.debug("Got getFXPServices request");

    try {
      const clonedHeaders = { ...req.headers };
      const sourceCurrency = (req.query["sourceCurrency"] as string) || null;
      const targetCurrency = (req.query["targetCurrency"] as string) || null;
      const requesterFspId =
        (req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string) || null;

      if (!requesterFspId) {
        const transformError = Transformer.transformPayloadError({
          errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
          errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
          extensionList: null,
        });

        res.status(400).json(transformError);
        return next();
      }

      const msgPayload: FxQueryReceivedEvtPayload = {
        requesterFspId,
        sourceCurrency,
        targetCurrency,
      };

      const msg = new FxQueryReceivedEvt(msgPayload);

      // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
      msg.fspiopOpaqueState = {
        requesterFspId: requesterFspId,
        headers: clonedHeaders,
      };

      await this.kafkaProducer.send(msg);

      this.logger.debug("getFXPServices sent message");

      res.status(202).json(null);

      this.logger.debug("getFXPServices responded");
      return;
    } catch (error: unknown) {
      if (error instanceof ValidationdError) {
        res.status(400).json((error as ValidationdError).errorInformation);
      } else {
        const transformError = Transformer.transformPayloadError({
          errorCode: FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code,
          errorDescription: (error as Error).message,
          extensionList: null,
        });
        res.status(500).json(transformError);
      }
      return;
    }
  }
}
