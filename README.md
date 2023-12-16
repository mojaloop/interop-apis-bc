# interop-apis-bc
**EXPERIMENTAL** vNext FSP Interoperability APIs Bounded Context Mono Repository

# Install
1. Install `npm`

# Build

Run:
```shell
npm install
```
Then:
```shell
npm run build
```

# Run Unit Tests

```shell
npm run test:unit
```

# Run Integration Tests

Make sure you have the following services up and running (available in platform-shared-tools docker-compose files):

- infra
    - mongo
    - kafka
    - redis
    - prometheus
    - zoo

- cross-cutting
	- auditing-svc
	- authentication-svc
	- authorization-svc
	- identity-svc
	- platform-configuration-svc
- apps
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

**Important:** please make sure you follow the steps available through the **admin-ui** demonstrated in the sections [here](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-apps#participants) (you can ignore the Account-Lookup part). There is required data to already exist such as **participants** endpoints exists and its accounts have funds available, otherwise the integrations will fail.

# Collect coverage (from both unit and integration test types)

After running the unit and/or integration tests:

```shell
npm run posttest
```

You can then consult the html report in:

```shell
coverage/lcov-report/index.html
```

# Run all tests at once
Requires integration tests pre-requisites
```shell
npm run test
```
