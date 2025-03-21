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

import {IMessage} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {FspiopJwsSignature, FspiopValidator, JwsConfig} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {ConsoleLogger, ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";


type UnknownProperties = { [k: string]: string | undefined };

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const removeEmpty = (obj: any) => {
	Object.entries(obj).forEach(([key, val]) =>
		(val && typeof val === "object") && removeEmpty(val) ||
		(val === null || val === "") && delete obj[key]
	);
	return obj;
};

export const getHeaders = (entity: string, method: string, signature: string | null = null, remove?: string[], override?: UnknownProperties): UnknownProperties => {
    const minimalWorkingHeaders: { [key: string]: string | undefined | null } = {
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

    const result: UnknownProperties = {
        ...removeEmpty(minimalWorkingHeaders),
        ...override
    };

    if(Array.isArray(remove) && remove.length > 0) {
        for (const key of remove) {
            delete result[key];
        }
    }

    for (const key in result) {
        if (result[key] === null) {
            result[key] = undefined; // Explicitly convert nulls to undefined
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

export const createMessage = (message: IMessage, entity: string, fspiopOpaqueState?: UnknownProperties): IMessage => {
    message.inboundProtocolType = "FSPIOP_v1_1";
    message.inboundProtocolOpaqueState = {
        fspiopOpaqueState: {
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
        }
    };

    if(fspiopOpaqueState) {
        message.inboundProtocolOpaqueState = {
            fspiopOpaqueState: {
                headers: {
                    ...message.inboundProtocolOpaqueState.fspiopOpaqueState.headers,
                    ...fspiopOpaqueState
                }
            }
        };
    }
    return message;
};

export const defaultEntryValidRequest = null;

export const getRouteValidator = (): FspiopValidator => {
    const routeValidator = FspiopValidator.getInstance();
    routeValidator.addCurrencyList([{
        code: "USD",
        num: "840",
        decimals: 2
    }]);

    return routeValidator;
};

// JWS Signature
export const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEAwczEjlUeOPutgPRlpZSbcbJJwsmmxsBfoPDw1sjBiR7L6Doh
VqKd810+TmiDRYgCzOLabje/mtLiDC95MtuPF5yUiVE04ar6Ny5pZLxJEnbDEOAE
TxOn1gzCKeRHYOcgybDi6TLhnvyFyIaXKzyBhEYvxI8VvRV11UawLqvpgVrdsbZy
1FQOMLq7OB+J6qC7fhR61F6Wu45RZlZMB482c658P7dCQCdQtEMEF5kuBNB/JuUR
e0qKjl2udKVL3wgBC7J7o7Tx8kY5T63q/ZC3TfoTclFeXtIePt8Eu74u3d6WpSWb
Z12mewRBVPtmbGHgEXpih3uayaqIeC8Dc4zO5QIDAQABAoIBAQCPMGJR36YS6DGL
xAeOTbyERvykxSVKWDzPxvXLXE1SqMRz8u9K+Z/GfjBY8nN7XkDjbQGCygHxvLpz
0me0IfEZuwEsbCmsSw3Q06PfYBaFY+ZAg6PrYVRynL6hAR+UA3GAVAdz0bpOI7od
LQRoV65CMzF8A1RGfqKvUClAcph2j4lbjjRZ1OExDdcbRCI4h9qgGOMo9o9OEB1X
HHiPhtS1ZwjczqCyJHkkHbOgYNPN7SDy8vHFOVjMDIADF+S/NLrxGUUIUDvNMnGV
D4G8thQD2zSatMjlbJJ+oNt++T/SJMSIiuQTB5zy/KpiMPUN+AXhq5h/dHDcFXhA
ng2deEcJAoGBAOQr1g/s/3V32tQpYloTMOPqIJoVnZnlcXbKy3nWLuOrkVlM0x3V
AEwC7ntb2eOSQ331AvBd/EESgtZr1jvxfsHG+MjwEylcOE33g4MqCKthGcnFA8zG
Z5h6OqTtHdY1bmuiisPvBA4/x2o7mWJz35vT0Sny3cci3f2D6pmPpuq3AoGBANlv
wjWgeDQSR8nTdM1P7zepVdN51f8Fl3r49kMhceVHdwL5iL7q4GkxUgpCyBkFoElW
vmsLgR1fnb+qBtF2kvljQtlRrlgwz1GgYNhp+aAgcAjvQ9fQcvCLr1leXzf6VBHx
jXEIUAlAJVlJ5gWKlDNK9ytjurOvOXipRC4GQKdDAoGBALNOt6RATOjVTYSZGQ9M
MYmKPiCYiAeexbHi4FBYvvRvqYOR2f6BmwAg9aS/o9Uw5hUf7DVUxp2knGlAyVTG
DSTe5jeSYpyIOj8bGaCD8dgsMIXda4ULDfJHa7qcFGx4BNRVIdOkC33fJSkYuQsj
oD/nD2J1109c2TMW7c/LkhK1AoGAUD8xws7tbfJNMkxrMBbPJ5DETx8I/myW4lid
slrWiRLd9mgXsrZGiiwcphLNfIaaCFcOQb1mMmwGcSUUDRwg1A9xLXk6yeuBqBNz
iotaCGHQV0vOkwioUuSKm4X7yFIH0vN+CvhRaYiWACUI0oS5e1CwdgABeK0znbeC
pSXDmLcCgYEA1ls595Ue5cUCmFDvpCIifsATNOMPguKeFuPbYSItQod3P3Bj6txV
phe0jUtWPhIF3I0XOtea2Usvbrj64GMNWLaeK2pdsbIWBlsu2tuqaAfKYiGpGCAh
QWGAPwZ4w7Z3nmA6IhaD6zUnzBGserHv59XttKK0AiQwYMn6UvUIq0M=
-----END RSA PRIVATE KEY-----
`;

export const publicKey = `-----BEGIN CERTIFICATE-----
MIIDbjCCAlYCCQDudXfDH36/JjANBgkqhkiG9w0BAQsFADB5MRswGQYDVQQDDBJ0
ZXN0aW5ndG9vbGtpdGRmc3AxCzAJBgNVBAYTAlVTMQ0wCwYDVQQIDARPaGlvMREw
DwYDVQQHDAhDb2x1bWJ1czEYMBYGA1UECgwPVGVzdGluZyBUb29sa2l0MREwDwYD
VQQLDAhQYXltZW50czAeFw0yMDAzMjQxNzU1MjZaFw0yNTAzMjMxNzU1MjZaMHkx
GzAZBgNVBAMMEnRlc3Rpbmd0b29sa2l0ZGZzcDELMAkGA1UEBhMCVVMxDTALBgNV
BAgMBE9oaW8xETAPBgNVBAcMCENvbHVtYnVzMRgwFgYDVQQKDA9UZXN0aW5nIFRv
b2xraXQxETAPBgNVBAsMCFBheW1lbnRzMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAwczEjlUeOPutgPRlpZSbcbJJwsmmxsBfoPDw1sjBiR7L6DohVqKd
810+TmiDRYgCzOLabje/mtLiDC95MtuPF5yUiVE04ar6Ny5pZLxJEnbDEOAETxOn
1gzCKeRHYOcgybDi6TLhnvyFyIaXKzyBhEYvxI8VvRV11UawLqvpgVrdsbZy1FQO
MLq7OB+J6qC7fhR61F6Wu45RZlZMB482c658P7dCQCdQtEMEF5kuBNB/JuURe0qK
jl2udKVL3wgBC7J7o7Tx8kY5T63q/ZC3TfoTclFeXtIePt8Eu74u3d6WpSWbZ12m
ewRBVPtmbGHgEXpih3uayaqIeC8Dc4zO5QIDAQABMA0GCSqGSIb3DQEBCwUAA4IB
AQAZ1lQ/KcSGwy/jQUIGF87JugLU17nnIEG2TrkC5n+fZDQqs8QqU6itbkdGQyNj
F5aLoPEdrKzevnBztlAEq0bofR0uDnQPN74A/NwOUfWds0hq5elZnO9Uq0G15Go4
pfqLbSjHxSu6LZaHP6f9+WvMqNbGr3kipz8GSIQWixzdKBnNxCwWjZmk4gD5cahU
XIpMAZumsnKk6pWilmuMIxC579CyLkGdVze3Kj6GunUJ1pieZzv4+RUJz8NgXxjW
ZRwqCkEqPe/8S1X9srtcrdbHryDdC18Ldu/rADEKbSqy0BhQdKYDcxulaQuqibwD
i0dWSdTWoseAbUqp2ACc6aF/
-----END CERTIFICATE-----
`;

export const getJwsConfig = (): FspiopJwsSignature => {
    const logger: ILogger = new ConsoleLogger();
    logger.setLogLevel(LogLevel.FATAL);

    const privKeyBuffer = Buffer.from(privateKey);
    const publicKeyBuffer = Buffer.from(publicKey);

    const jwsConfig:JwsConfig = {
        enabled: false,
        privateKey: privKeyBuffer,
        publicKeys: {
            "bluebank": privKeyBuffer,
            "greenbank": publicKeyBuffer
        }
    };

    const jwsHelper = FspiopJwsSignature.getInstance();
    jwsHelper.addLogger(logger);
    jwsHelper.enableJws(jwsConfig.enabled);
    jwsHelper.addPublicKeys(jwsConfig.publicKeys);
    jwsHelper.addPrivateKey(jwsConfig.privateKey);

    return jwsHelper;
};
