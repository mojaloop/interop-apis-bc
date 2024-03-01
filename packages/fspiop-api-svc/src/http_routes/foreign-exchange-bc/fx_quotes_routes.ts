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
  FxQuoteRejectReceivedEvt,
  FxQuoteRejectReceivedEvtPayload,
  FxQuoteRequestReceivedEvt,
  FxQuoteRequestReceivedEvtPayload,
  FxQuoteResponseReceivedEvt,
  FxQuoteResponseReceivedEvtPayload,
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import express from "express";
import { FSPIOPErrorCodes } from "../../validation";
import { BaseRoutes } from "../_base_router";

export class ForeignExchangeQuotesRoutes extends BaseRoutes {
  constructor(
    producer: IMessageProducer,
    validator: FspiopValidator,
    jwsHelper: FspiopJwsSignature,
    logger: ILogger
  ) {
    super(producer, validator, jwsHelper, logger);

    // bind routes

    this.router.post("/", this.fxQuotesReceived.bind(this));

    this.router.put(
      "/:conversionRequestId",
      this.fxQuotesResponseReceived.bind(this)
    );

    this.router.put(
      "/:conversionRequestId/error",
      this.fxQuotesRejectRequest.bind(this)
    );
  }

  get Router(): express.Router {
    return this.router;
  }

  private async fxQuotesReceived(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    this.logger.debug("Got fxQuotesReceived request");

    try {
      const clonedHeaders = { ...req.headers };
      const conversionRequestId =
        (req.body.conversionRequestId as string) || null;
      const conversionTerms = req.body.conversionTerms || null;

      const requesterFspId =
        (clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string) || null;
      const destinationFspId =
        (clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string) || null;

      if (
        !requesterFspId ||
        !destinationFspId ||
        !conversionRequestId ||
        !conversionTerms
      ) {
        const transformError = Transformer.transformPayloadError({
          errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
          errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
          extensionList: null,
        });

        res.status(400).json(transformError);
        return;
      }

      const msgPayload: FxQuoteRequestReceivedEvtPayload = {
        conversionRequestId,
        conversionTerms,
      };

      const msg = new FxQuoteRequestReceivedEvt(msgPayload);

      // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
      msg.fspiopOpaqueState = {
        requesterFspId: requesterFspId,
        destinationFspId: destinationFspId,
        headers: clonedHeaders,
      };

      await this.kafkaProducer.send(msg);

      this.logger.debug("postFXQuotes sent message");

      res.status(202).json(null);

      this.logger.debug("postFXQuotes responded");
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

  private async fxQuotesResponseReceived(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    this.logger.debug("Got fxQuotesResponseReceived request");

    try {
      const clonedHeaders = { ...req.headers };
      const conversionRequestId =
        (req.params.conversionRequestId as string) || null;
      const condition = (req.body.condition as string) || null;
      const conversionTerms = req.body.conversionTerms || null;
      const requesterFspId =
        (clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string) || null;
      const destinationFspId =
        (clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string) || null;

      if (
        !requesterFspId ||
        !destinationFspId ||
        !conversionRequestId ||
        !condition
      ) {
        const transformError = Transformer.transformPayloadError({
          errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
          errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
          extensionList: null,
        });

        res.status(400).json(transformError);
        return;
      }

      const msgPayload: FxQuoteResponseReceivedEvtPayload = {
        conversionRequestId,
        condition,
        conversionTerms,
      };

      const msg = new FxQuoteResponseReceivedEvt(msgPayload);

      // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
      msg.fspiopOpaqueState = {
        requesterFspId: requesterFspId,
        destinationFspId: destinationFspId,
        headers: clonedHeaders,
      };

      await this.kafkaProducer.send(msg);

      this.logger.debug("putFXQuotes sent message");

      res.status(202).json(null);

      this.logger.debug("putFXQuotes responded");
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

  private async fxQuotesRejectRequest(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    this.logger.debug("Got fxQuotesRejectRequest request");

    try {
      const clonedHeaders = { ...req.headers };
      const conversionRequestId =
        (req.params.conversionRequestId as string) || null;
      const errorInformation = req.body.errorInformation || null;

      const requesterFspId =
        (clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string) || null;
      const destinationFspId =
        (clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string) || null;

      if (
        !requesterFspId ||
        !destinationFspId ||
        !conversionRequestId ||
        !errorInformation
      ) {
        const transformError = Transformer.transformPayloadError({
          errorCode: FSPIOPErrorCodes.MALFORMED_SYNTAX.code,
          errorDescription: FSPIOPErrorCodes.MALFORMED_SYNTAX.message,
          extensionList: null,
        });

        res.status(400).json(transformError);
        return;
      }

      const msgPayload: FxQuoteRejectReceivedEvtPayload = {
        conversionRequestId,
        errorInformation,
      };

      const msg = new FxQuoteRejectReceivedEvt(msgPayload);

      // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
      msg.fspiopOpaqueState = {
        requesterFspId: requesterFspId,
        destinationFspId: destinationFspId,
        headers: clonedHeaders,
      };

      await this.kafkaProducer.send(msg);

      this.logger.debug("putFXQuotes sent message");

      res.status(202).json(null);

      this.logger.debug("putFXQuotes responded");
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
