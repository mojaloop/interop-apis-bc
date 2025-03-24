/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>
*****/

"use strict";

import {ConfigurationClient, IConfigProvider} from "@mojaloop/platform-configuration-bc-client-lib";
import {ConfigParameterTypes} from "@mojaloop/platform-configuration-bc-public-types-lib";

// configs - constants / code dependent
const CONFIGSET_VERSION = "0.0.3";

export function GetBoundedContextsConfigSet(
    bcName: string,
    configProvider?: IConfigProvider,
): ConfigurationClient {
    const configClient = new ConfigurationClient(
        bcName, CONFIGSET_VERSION, configProvider
    );

    /*
    * Add specific application parameters here
    * */
    configClient.bcConfigs.addParam({
        type: ConfigParameterTypes.INT_NUMBER,
        name: "TransferTimeToLiveMinSecs",
        description: "Minimum time in seconds for a transfer expiration date to be considered valid. Ex: setting it to 5 seconds means the switch will reject transfers with an expiration time for less than five seconds in the future. Default of 0 (Zero) disables this check, only checks that expiration time is in the future.",
        currentValue: 0,
        defaultValue: 0
    });

    configClient.bcConfigs.addParam({
        type: ConfigParameterTypes.INT_NUMBER,
        name: "TransferTimeToLiveMaxSecs",
        description: "Maximum time in seconds for a transfer expiration date to be considered valid. Ex: setting it to 3600 seconds means the switch will reject transfers with an expiration time for more than one hour in the future. Default of 0 (Zero) disables this check.",
        currentValue: 0,
        defaultValue: 0
    });

    return configClient;
}
