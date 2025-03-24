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

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {ICounter, IGauge, IHistogram, IMetrics, ISummary} from "@mojaloop/platform-shared-lib-observability-types-lib";


class Histogram implements IHistogram {
    constructor(private logger: ILogger) {}

    observe(labelsOrValue: any, value?: number): void {
        return;
    }

    startTimer(labels?: any): (labels?: any) => number {
        const start = Date.now();
        return (endLabels?: any) => {
            const end = Date.now();
            const duration = end - start;
            this.observe({ ...labels, ...endLabels }, duration);
            return duration;
        };
    }
}

class MemorySummary implements ISummary {
    constructor(private logger: ILogger) {}

    observe(labelsOrValue: any, value?: number): void {
        return;
    }

    startTimer(labels?: any): any {
        return;
    }
}

class MemoryGauge implements IGauge {
    constructor(private logger: ILogger) {}

    set(labelsOrValue: any, value?: number): void {
        return;
    }

    inc(labelsOrAmount: any, amount = 1): void {
        return;
    }

    dec(labelsOrValue: any, value = 1): void {
        return;
    }
}

class MemoryCounter implements ICounter {
    constructor(private logger: ILogger) {}

    inc(labelsOrAmount: any, value = 1, amount?: number): void {
		return;
    }
}

export class MemoryMetric implements IMetrics {
    private readonly logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    getHistogram(name: string, help?: string, labelNames?: string[], buckets?: number[]): IHistogram {
        return new Histogram(this.logger);
    }

    getSummary(name: string, help?: string, labelNames?: string[], percentiles?: number[], maxAgeSeconds?: number, ageBuckets?: number): ISummary {
        return new MemorySummary(this.logger);
    }

    getGauge(name: string, help?: string, labelNames?: string[]): IGauge {
        return new MemoryGauge(this.logger);
    }

    getCounter(name: string, help?: string, labelNames?: string[]): ICounter {
        return new MemoryCounter(this.logger);
    }
}
