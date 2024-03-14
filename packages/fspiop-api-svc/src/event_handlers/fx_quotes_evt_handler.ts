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

"use strict";

import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {
  DomainErrorEventMsg,
  IDomainMessage,
  IMessage,
} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
  MLKafkaJsonConsumerOptions,
  MLKafkaJsonProducerOptions,
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
  ForeignExchangeBCInvalidMessagePayloadErrorEvent,
  ForeignExchangeBCInvalidMessageTypeErrorEvent,
  ForeignExchangeBCInvalidRequesterParticipantErrorEvent,
  ForeignExchangeBCUnknownErrorEvent,
  FxQuoteQueryRespondedEvt,
  FxQuoteRejectRespondedEvt,
  FxQuoteRequestAcceptedEvt,
  FxQuoteResponseAcceptedEvt,
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {
  Constants,
  Request,
  Enums,
  FspiopJwsSignature,
} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { BaseEventHandler, HandlerNames } from "./base_event_handler";
import { IParticipantServiceAdapter } from "../interfaces/infrastructure";

export class ForeignExchangeQuotesEventHandler extends BaseEventHandler {
  constructor(
    logger: ILogger,
    consumerOptions: MLKafkaJsonConsumerOptions,
    producerOptions: MLKafkaJsonProducerOptions,
    kafkaTopics: string[],
    participantService: IParticipantServiceAdapter,
    jwsHelper: FspiopJwsSignature
  ) {
    super(
      logger,
      consumerOptions,
      producerOptions,
      kafkaTopics,
      participantService,
      HandlerNames.Transfers,
      jwsHelper
    );
  }

  async processMessage(sourceMessage: IMessage): Promise<void> {
    try {
      const message: IDomainMessage = sourceMessage as IDomainMessage;

      if (!message.fspiopOpaqueState || !message.fspiopOpaqueState.headers) {
        this._logger.error(
          `received message of type: ${message.msgName}, without fspiopOpaqueState or fspiopOpaqueState.headers, ignoring`
        );
        return;
      }

      switch (message.msgName) {
        case FxQuoteRequestAcceptedEvt.name:
          await this._handleFxQuoteRequestAcceptedEvt(
            new FxQuoteRequestAcceptedEvt(message.payload),
            message.fspiopOpaqueState.headers
          );
          break;
        case FxQuoteResponseAcceptedEvt.name:
          await this._handleFxQuoteResponseAcceptedEvt(
            new FxQuoteResponseAcceptedEvt(message.payload),
            message.fspiopOpaqueState.headers
          );
          break;
        case FxQuoteQueryRespondedEvt.name:
        case FxQuoteRejectRespondedEvt.name:
          await this._handleFxQuoteRejectRespondedEvt(
            new FxQuoteRejectRespondedEvt(message.payload),
            message.fspiopOpaqueState.headers
          );
          break;
        case ForeignExchangeBCInvalidMessageTypeErrorEvent.name:
        case ForeignExchangeBCInvalidRequesterParticipantErrorEvent.name:
        case ForeignExchangeBCUnknownErrorEvent.name:
        case ForeignExchangeBCInvalidMessagePayloadErrorEvent.name:
          await this._handleErrorReceivedEvt(
            message as DomainErrorEventMsg,
            message.fspiopOpaqueState.headers
          );
          break;
        default:
          this._logger.warn(
            `Cannot handle message of type: ${message.msgName}, ignoring`
          );
          break;
      }
    } catch (error: unknown) {
      const message: IDomainMessage = sourceMessage as IDomainMessage;

      const clonedHeaders = message.fspiopOpaqueState.headers;
      const requesterFspId = clonedHeaders[
        Constants.FSPIOP_HEADERS_SOURCE
      ] as string;

      await this._sendErrorFeedbackToFsp({
        message: message,
        headers: message.fspiopOpaqueState.headers,
        id: [requesterFspId],
        errorResponse: {
          errorCode: Enums.ServerErrors.GENERIC_SERVER_ERROR.code,
          errorDescription: Enums.ServerErrors.GENERIC_SERVER_ERROR.name,
          sourceFspId: requesterFspId,
          destinationFspId: null,
        },
      });
    }

    // make sure we only return from the processMessage/handler after completing the request,
    // otherwise this will commit the event and will be lost
    return;
  }

  async _handleErrorReceivedEvt(
    message: DomainErrorEventMsg,
    fspiopOpaqueState: Request.FspiopHttpHeaders
  ): Promise<void> {
    this._logger.info("_handleFXErrorReceivedEvt -> start");

    const clonedHeaders = fspiopOpaqueState;
    const sourceFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_SOURCE
    ] as string;
    const destinationFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_DESTINATION
    ] as string;

    // TODO validate vars above

    const errorResponse = this.buildErrorResponseBasedOnErrorEvent(
      message,
      sourceFspId,
      destinationFspId
    );

    await this._sendErrorFeedbackToFsp({
      message: message,
      headers: clonedHeaders,
      id: [sourceFspId],
      errorResponse: errorResponse,
    });

    this._logger.info("_handleFXErrorReceivedEvt -> end");

    return;
  }

  private buildErrorResponseBasedOnErrorEvent(
    message: DomainErrorEventMsg,
    sourceFspId: string,
    destinationFspId: string
  ): {
    errorCode: string;
    errorDescription: string;
    sourceFspId: string;
    destinationFspId: string | null;
  } {
    const errorResponse: {
      errorCode: string;
      errorDescription: string;
      sourceFspId: string;
      destinationFspId: string | null;
    } = {
      errorCode: Enums.CommunicationErrors.COMMUNCATION_ERROR.code,
      errorDescription: Enums.CommunicationErrors.COMMUNCATION_ERROR.name,
      sourceFspId: sourceFspId,
      destinationFspId: destinationFspId,
    };

    return errorResponse;
  }

  private async _handleFxQuoteRequestAcceptedEvt(
    message: FxQuoteRequestAcceptedEvt,
    fspiopOpaqueState: Request.FspiopHttpHeaders
  ): Promise<void> {
    const { payload } = message;

    const clonedHeaders = fspiopOpaqueState;
    const requesterFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_SOURCE
    ] as string;
    const destinationFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_DESTINATION
    ] as string;

    // TODO validate vars above

    try {
      this._logger.info("_handleFxQuoteRequestAcceptedEvt -> start");
      const requestedEndpoint = await this._validateParticipantAndGetEndpoint(
        destinationFspId
      );

      // Always validate the payload and headers received
      message.validatePayload();

      const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
      urlBuilder.setEntity(Enums.EntityTypeEnum.FX_QUOTES);

      await Request.sendRequest({
        url: urlBuilder.build(),
        headers: clonedHeaders,
        source: requesterFspId,
        destination: destinationFspId,
        method: Enums.FspiopRequestMethodsEnum.POST,
        payload: payload,
      });

      this._logger.info("_handleFxQuoteRequestAcceptedEvt -> end");
    } catch (error: unknown) {
      this._logger.error(error, "_handleFxQuoteRequestAcceptedEvt -> error");
      throw Error("_handleFxQuoteRequestAcceptedEvt -> error");
    }

    return;
  }
  private async _handleFxQuoteResponseAcceptedEvt(
    message: FxQuoteResponseAcceptedEvt,
    fspiopOpaqueState: Request.FspiopHttpHeaders
  ): Promise<void> {
    const { payload } = message;

    const clonedHeaders = fspiopOpaqueState;
    const requesterFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_SOURCE
    ] as string;
    const destinationFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_DESTINATION
    ] as string;

    // TODO validate vars above

    try {
      this._logger.info("_handleFxQuoteResponseAcceptedEvt -> start");
      const requestedEndpoint = await this._validateParticipantAndGetEndpoint(
        destinationFspId
      );

      // Always validate the payload and headers received
      message.validatePayload();

      const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
      urlBuilder.setEntity(Enums.EntityTypeEnum.FX_QUOTES);
      urlBuilder.setLocation([payload.conversionRequestId]);

      await Request.sendRequest({
        url: urlBuilder.build(),
        headers: clonedHeaders,
        source: requesterFspId,
        destination: destinationFspId,
        method: Enums.FspiopRequestMethodsEnum.PUT,
        payload: payload,
      });

      this._logger.info("_handleFxQuoteResponseAcceptedEvt -> end");
    } catch (error: unknown) {
      this._logger.error(error, "_handleFxQuoteResponseAcceptedEvt -> error");
      throw Error("_handleFxQuoteResponseAcceptedEvt -> error");
    }

    return;
  }
  private async _handleFxQuoteRejectRespondedEvt(
    message: FxQuoteRejectRespondedEvt,
    fspiopOpaqueState: Request.FspiopHttpHeaders
  ): Promise<void> {
    const { payload } = message;

    const clonedHeaders = fspiopOpaqueState;
    const requesterFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_SOURCE
    ] as string;
    const destinationFspId = clonedHeaders[
      Constants.FSPIOP_HEADERS_DESTINATION
    ] as string;

    // TODO validate vars above

    try {
      this._logger.info("_handleFxQuoteRejectRespondedEvt -> start");
      const requestedEndpoint = await this._validateParticipantAndGetEndpoint(
        requesterFspId
      );

      // Always validate the payload and headers received
      message.validatePayload();

      const urlBuilder = new Request.URLBuilder(requestedEndpoint.value);
      urlBuilder.setEntity(Enums.EntityTypeEnum.FX_SERVICES);

      await Request.sendRequest({
        url: urlBuilder.build(),
        headers: clonedHeaders,
        source: requesterFspId,
        destination: destinationFspId,
        method: Enums.FspiopRequestMethodsEnum.PUT,
        payload: payload,
      });

      this._logger.info("_handleFxQuoteRejectRespondedEvt -> end");
    } catch (error: unknown) {
      this._logger.error(error, "_handleFxQuoteRejectRespondedEvt -> error");
      throw Error("_handleFxQuoteRejectRespondedEvt -> error");
    }

    return;
  }
}
