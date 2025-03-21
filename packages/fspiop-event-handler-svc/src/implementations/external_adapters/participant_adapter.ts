/**
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

 --------------
 **/

 "use strict";

/* eslint-disable @typescript-eslint/no-unused-vars */
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantsHttpClient} from "@mojaloop/participants-bc-client-lib";
import { IParticipant } from "@mojaloop/participant-bc-public-types-lib";
import { IAuthenticatedHttpRequester } from "@mojaloop/security-bc-public-types-lib";
import { IParticipantService } from "../../interfaces/infrastructure";

export class ParticipantAdapter implements IParticipantService {
	private readonly _logger: ILogger;
	private readonly _clientBaseUrl: string;
	private readonly _externalParticipantClient :ParticipantsHttpClient;
	private readonly _authRequester :IAuthenticatedHttpRequester;
	private readonly _timeoutMs :number;

	constructor(
		logger: ILogger,
		clientBaseUrl: string,
		authRequester: IAuthenticatedHttpRequester,
		cacheTimeoutMs: number
	) {
		this._logger = logger;
		this._clientBaseUrl = clientBaseUrl;
		this._authRequester = authRequester;
		this._timeoutMs = cacheTimeoutMs;
		this._externalParticipantClient = new ParticipantsHttpClient(this._logger, this._clientBaseUrl, this._authRequester, this._timeoutMs);
	}

	async getParticipantInfo(fspId: string): Promise<IParticipant| null> {
		try {
			const result = await this._externalParticipantClient.getParticipantById(fspId);
			return result;
		} catch (e: unknown) {
			this._logger.error(`getParticipantInfo: error getting participant info for fspId: ${fspId} - ${e}`);
			return null;
		}
	}

	async getParticipantsInfo(fspIds: string[]): Promise<IParticipant[]|null> {
		const result: IParticipant[] = [];
		try {
			const participants = await this._externalParticipantClient.getParticipantsByIds(fspIds);
			return participants;

		} catch (e: unknown) {
			this._logger.error(`getParticipantInfo: error getting participants info for fspIds: ${fspIds} - ${e}`);
			return null;
		}
	}
}
