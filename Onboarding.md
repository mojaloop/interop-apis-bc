# Onboarding

>*Note:* Before completing this guide, make sure you have completed the _general_ onboarding guide in the [base mojaloop repository](https://github.com/mojaloop/mojaloop/blob/main/onboarding.md#mojaloop-onboarding).

## Contents

<!-- vscode-markdown-toc -->
1. [Prerequisites](#1-prerequisites)
2. [Service Overview](#2-service-overview)
3. [Installing and Building](#3-installing-and-building)
4. [Running Locally](#4-running-locally-dependencies-inside-of-docker)
5. [Running Inside Docker](#5-running-inside-docker)
6. [Testing](#6-testing)
7. [Common Errors/FAQs](#7-common-errorsfaqs)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->
##  1. Prerequisites

If you have followed the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/main/onboarding.md#mojaloop-onboarding), you should already have the following cli tools installed:

* `brew` (macOS), [todo: windows package manager]
* `curl`, `wget`
* `docker` + `docker-compose`
* `node`, `npm` and (optionally) `nvm`

## 2. Service Overview 
The Interop APIs BC consists of the following packages;

`fspiop-api-svc`
FSPIOP API Service.
[README](./packages/fspiop-api-svc/README.md)
 
`fspiop-utils-lib`
FSPIOP Utils Library.
[README](packages/fspiop-utils-lib/README.md) 

`shared-mocks-lib`
Mock implementation used for testing.
[README](./packages/shared-mocks-lib/README.md)


## 3. <a name='InstallingandBuilding'></a>Installing and Building

Firstly, clone your fork of the `interop-apis-bc` onto your local machine:
```bash
git clone https://github.com/<your_username>/interop-apis-bc.git
```

Then `cd` into the directory and install the node modules:
```bash
cd interop-apis-bc
```

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

#### Build

```bash
npm run build
``` 

## 4. Running Locally (dependencies inside of docker)

In this method, we will run all of the core dependencies inside of docker containers, while running the `fspiop-api-svc` server on your local machine.

### Startup supporting services

### 4.1 Run all back-end dependencies as part of the Docker Compose

Use [platform-shared-tools docker-compose files](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/): 
Follow instructions in the `README.md` files to run the supporting services. Make sure you have the following services up and running:

- infra services : [docker-compose-infra](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-infra)
	- mongo
	- kafka
	- zoo
	- prometheus
    - zoo
- cross-cutting services : [docker-compose-cross-cutting](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-cross-cutting)
	- auditing-svc
	- authentication-svc
	- authorization-svc
	- identity-svc
	- platform-configuration-svc
- apps services : [docker-compose-apps](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-apps)
    - account-lookup-svc
    - accounts_and_balances_builtin-ledger-grpc-svc
    - accounts_and_balances_coa-grpc-svc
	- participants-svc
    - quoting-svc
    - scheduling-command-handler-svc
    - settlements-command-handler-svc
    - settlements-event-handler-svc
    - transfers-command-handler
    - transfers-event-handler
    - ttk-1
    - ttk-2
    - ttk-ui-1
    - ttk-ui-2

This will do the following:
* `docker pull` down any dependencies defined in each `docker-compose.yml` file, and the services.
* run all of the containers together
* ensure that all dependencies have started for each services.

**Important:** please make sure you follow the steps available through the **admin-ui** demonstrated in the sections [here](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-apps#participants) (you can ignore the Account-Lookup part). There is required data to already exist such as **participants** endpoints exists and its accounts have funds available, otherwise the integrations will fail.

### 4.2 Run the server

```bash
npm run start:fspiop-api-svc
```

## 5. Running Inside Docker


## 6. Testing
We use `npm` scripts as a common entrypoint for running the tests. Tests include unit, functional, and integration.

```bash
# unit tests:
npm run test:unit

# check test coverage
npm run test:coverage

# integration tests
npm run test:integration
```

### 6.1 Testing the `interop-apis-bc` API with Postman

[Here](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/postman) you can find a complete Postman collection, in a json file, ready to be imported to Postman.


## Common Errors/FAQs 

### Unable to load dlfcn_load
```bash
error:25066067:DSO support routines:dlfcn_load:could not load the shared library
```
Fix: https://github.com/mojaloop/security-bc.git  `export OPENSSL_CONF=/dev/null`