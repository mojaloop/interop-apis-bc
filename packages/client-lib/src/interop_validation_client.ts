/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License")

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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { UnableToValidateFulfilment,} from "./errors";
import { fulfilmentToCondition } from "./utils";

export class InteropValidationClient {
    private readonly _logger: ILogger;

    constructor(
        logger: ILogger,
    ) {
        this._logger = logger.createChild(this.constructor.name);
    }

    validateFulfilmentOpaqueState(inboundProtocolOpaqueState: any, transferOpaqueState: any): boolean {

        try {
            // TODO: use transfer's inboundProtocolType when we have access to the the updated published transfer public types
            if(inboundProtocolOpaqueState && inboundProtocolOpaqueState.fspiopOpaqueState) {
                const { fulfilment } = inboundProtocolOpaqueState.fspiopOpaqueState;
                const { condition } = transferOpaqueState.fspiopOpaqueState;

                if(fulfilment) {
                    const calculatedCondition = fulfilmentToCondition(fulfilment);
                    return calculatedCondition === condition;
                }
            }
            return true;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;

            throw new UnableToValidateFulfilment("Unable to validate fulfilment");
        }
    }

}
