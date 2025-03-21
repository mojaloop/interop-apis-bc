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

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-public-types-lib";

export class MemoryAuthenticatedHttpRequesterMock implements IAuthenticatedHttpRequester {
    private readonly logger: ILogger;
    private readonly authTokenUrl: string;

    private client_id: string | null = null;
    private client_secret: string | null = null;
	private username: string | null = null;
	private password: string | null = null;

	constructor(
		logger: ILogger,
		authTokenUrl: string,
	) {
		this.logger = logger;
		this.authTokenUrl = authTokenUrl;
	}

    initialised: boolean;

    setUserCredentials(client_id: string, username: string, password: string): void {
		this.client_id = client_id;
		this.username = username;
		this.password = password;
    }

    setAppCredentials(client_id: string, client_secret: string): void {
		this.client_id = client_id;
		this.client_secret = client_secret;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
	fetch(_requestInfo: RequestInfo, _timeoutMs?: number | undefined): Promise<Response> {
        return new Promise<Response>((_resolve, _reject) => {
			const mockResponse = <Response>{
                body: {}
            };

            return Promise.resolve(mockResponse);
		});
    }

}
