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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
**/

"use strict";

import path from "path";
import { readFileSync } from "fs";
import {IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { FspiopJwsSignature } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {ConsoleLogger, ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";


type UnknownProperties = { [k: string]: string | null };

const removeEmpty = (obj: any) => {
	Object.entries(obj).forEach(([key, val]) =>
		(val && typeof val === 'object') && removeEmpty(val) ||
		(val === null || val === "") && delete obj[key]
	);
	return obj;
};

export const getJwsConfig = (): any => {
    const logger: ILogger = new ConsoleLogger();
    logger.setLogLevel(LogLevel.FATAL);

    const privKey = path.join(__dirname, "privatekey.pem");
    const pubKey = path.join(__dirname, "publickey.cer");
    const pubKeyCont = readFileSync(pubKey)
    const privKeyCont = readFileSync(privKey)
    const jwsConfig = {
        enabled: true,
        privateKey: privKeyCont,
        publicKeys: {
            "bluebank": pubKeyCont,
            "greenbank": pubKeyCont
        }
    }
    
    const jwsHelper = new FspiopJwsSignature(jwsConfig, logger);   
    return jwsHelper;
};


export const getHeaders = (entity: string, method: string, signature: string | null = null, remove?: string[], override?: UnknownProperties): UnknownProperties => {
    const minimalWorkingHeaders = {
        "accept": `application/vnd.interoperability.${entity}+json;version=1.1`,
        "content-type": `application/vnd.interoperability.${entity}+json;version=1.1`,
        "date": "Mon, 10 Apr 2023 04:04:04 GMT",
        "fspiop-http-method": method,
        "fspiop-uri": `/${entity}`,
        "fspiop-signature": signature,
        "fspiop-source": "bluebank",
        "fspiop-destination": "greenbank",
        "traceparent": "00-aabb8e170bb7474d09e73aebcdf0b293-0123456789abcdef0-00"
    };

    const result: UnknownProperties  = {
        ...removeEmpty(minimalWorkingHeaders),
        ...override
    };

    if(Array.isArray(remove) && remove.length > 0) {
        for (const key of remove) {
            delete result[key];
        }
    }
    return result;
};

export const getBody = (remove: string[], override: UnknownProperties): UnknownProperties => {
    const minimalWorkingHeaders = {
        "accept": "application/json",
        "content-type": "application/vnd.interoperability.parties+json;version=1.1",
        "date": "Tue Apr 04 2023 15:10:56 GMT+0100 (Western European Summer Time)",
        "fspiop-source": "bluebank",
    };

    const result: UnknownProperties  = {
        ...minimalWorkingHeaders,
        ...override
    };

    for (const [key] of Object.entries(remove)) {
        delete result[key];
    }

    return result;
};

export const badStatusResponse = (options: {
        code: string;
        description: string;
        extensionList: {
            key: string;
            value: string;
        }[]
}) => {
    return {
        "errorInformation":  {
            "errorCode": options.code,
            "errorDescription": options.description,
            "extensionList": {
                "extension": options.extensionList.map( extension => {
                    return {
                        "key": extension.key,
                        "value": extension.value,
                    };
                })
            }
        }
    };
};

export const missingPropertyResponse = (field: string, type: string) => {
    const result = badStatusResponse({
        "code": type === "body" ? "3100" :"3102",
        "description": field === "date" ? "Invalid date-type" : `must have required property '${field}' - path: /${type}`,
        "extensionList": [
            {
                "key": "keyword",
                "value": "required",
            },
            {
                "key": "instancePath",
                "value": `/${type}`,
            },
            {
                "key": "missingProperty",
                "value": field
            },
        ]
    });

    if(field === "date") {
        return {
            errorInformation: {
                "errorCode": result.errorInformation.errorCode,
                "errorDescription": result.errorInformation.errorDescription,
            }
        };
    }

    return result;
};

export const createMessage = (message: IMessage, entity: string, fspiopOpaqueState?: UnknownProperties): UnknownProperties => {
    message.fspiopOpaqueState = {
        "requesterFspId": "bluebank",
        "destinationFspId": null,
        "headers": {
            "host": "localhost:4000",
            "accept-encoding": "gzip, deflate",
            "accept": `application/vnd.interoperability.${entity}+json;version=1.1`,
            "content-type": `application/vnd.interoperability.${entity}+json;version=1.1`,
            "date": "Mon, 10 Apr 2023 04:04:04 GMT",
            "fspiop-source": "bluebank",
            "fspiop-destination": "bluebank",
            "traceparent": "00-aabb8e170bb7474d09e73aebcdf0b293-0123456789abcdef0-00",
            "connection": "close",
            "fspiop-uri": `/${entity}`,
        }
    };

    if(fspiopOpaqueState) {
        message.fspiopOpaqueState.headers = { 
            ...message.fspiopOpaqueState.headers,
            ...fspiopOpaqueState
        };
    }
    return message as unknown as UnknownProperties;
};




export const defaultEntryValidRequest = null;
