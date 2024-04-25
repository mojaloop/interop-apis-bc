# FSPIOP API Service

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/interop-apis-bc.svg?style=flat)](https://github.com/mojaloop/interop-apis-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/interop-apis-bc.svg?style=flat)](https://github.com/mojaloop/interop-apis-bc/releases)
[![Npm Version](https://img.shields.io/npm/v/@mojaloop-poc/interop-apis-bc.svg?style=flat)](https://www.npmjs.com/package/@mojaloop-poc/interop-apis-bc)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@mojaloop/interop-apis-bc.svg?style=flat)](https://www.npmjs.com/package/@mojaloop-poc/interop-apis-bc)
[![CircleCI](https://circleci.com/gh/mojaloop/interop-apis-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/interop-apis-bc)

Mojaloop vNext FSPIOP API Service

## Usage

### Install Node version

More information on how to install NVM: https://github.com/nvm-sh/nvm

```bash
nvm install
nvm use
```

### Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

## Run

```bash
npm run start
```

## Unit Tests

```bash
npm run test:unit
```

## Configuration 

### Environment variables

| Environment Variable | Description    | Example Values         |
|---------------------|-----------------|-----------------------------------------|
| PRODUCTION_MODE      | Flag indicating production mode   | FALSE                  |
| LOG_LEVEL            | Logging level for the application                  | LogLevel.DEBUG        |
| SVC_DEFAULT_HTTP_PORT                 | Default HTTP port for the service                  | 4000  |
| KAFKA_URL       | Kafka broker URL     | localhost:9092          |
| KAFKA_AUDITS_TOPIC        | Kafka topic for audits              | audits                 |
| KAFKA_LOGS_TOPIC      | Kafka topic for logs          | logs    |
| AUDIT_KEY_FILE_PATH  | File path for audit key           | /app/data/audit_private_key.pem         |
| SVC_CLIENT_ID        | Service client ID                 | interop-api-bc-fspiop-api-svc               |
| SVC_CLIENT_SECRET    | Service client secret             | superServiceSecret     |
| AUTH_N_SVC_BASEURL | Authentication service base URL  |http://localhost:3201|
| PARTICIPANTS_SVC_URL  | Participants service base URL | http://localhost:3010 |
| PARTICIPANTS_CACHE_TIMEOUT_MS        | Timeout for participants cache in milliseconds   |    30000    |
| SERVICE_START_TIMEOUT_MS               | Timeout for service startup in milliseconds        | 60_000                 |
| JWS_FILES_PATH    | Files Path for JWS | /app/data/keys/ |
| JWS_DISABLED | Flag indicating the JWS disabled | true  |