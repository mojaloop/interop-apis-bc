/**
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

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

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>
 
 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
**/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
	Context,
	ContextAPI,
    ITracing,
    PropagationAPI,
    Span,
    TraceAPI,
    Tracer
} from "@mojaloop/platform-shared-lib-observability-types-lib";
import { AttributeValue, Attributes, Exception, SpanContext, SpanKind, SpanOptions, SpanStatus, TimeInput, TraceState, TracerOptions, TracerProvider } from "@opentelemetry/api";


export class MemorySpan implements Span {
	spanContext(): SpanContext {
		return {} as SpanContext;
	}
	setAttribute(key: string, value: AttributeValue): this {
		return this;
	}
	setAttributes(attributes: Attributes): this {
		return this;
	}
	addEvent(name: string, attributesOrStartTime?: Attributes | TimeInput | undefined, startTime?: TimeInput | undefined): this {
		return this;
	}
	setStatus(status: SpanStatus): this {
		return this;
	}
	updateName(name: string): this {
		return this;
	}
	end(endTime?: TimeInput | undefined): void {
		return;
	}
	isRecording(): boolean {
		return true;
	}
	recordException(exception: Exception, time?: TimeInput | undefined): void {
		return;
	}

}


export class MemoryContext implements Context {
	getValue(key: symbol): unknown {
		return;
	}
	setValue(key: symbol, value: unknown): Context {
		return {} as Context;
	}
	deleteValue(key: symbol): Context {
		return {} as Context;
	}
}

export class MemoryTracer implements Tracer {
	startSpan(name: string, options?: SpanOptions, context?: Context): Span {
		// Return an instance of MemorySpan
		return new MemorySpan();
	}
  
	startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F>;
	startActiveSpan<F extends (span: Span) => unknown>(name: string, options: SpanOptions, fn: F): ReturnType<F>;
	startActiveSpan<F extends (span: Span) => unknown>(name: string, options: SpanOptions, context: Context, fn: F): ReturnType<F>;
	startActiveSpan<F extends (span: Span) => unknown>(
		name: string,
		optionsOrFn: SpanOptions | F,
		contextOrFn?: Context | F,
		fn?: F
	): ReturnType<F> {
		// Implement the method as needed, this is a simple example
		const span = this.startSpan(name);
		if (typeof optionsOrFn === "function") {
			return (optionsOrFn as F)(span) as ReturnType<F>;
		} else if (typeof contextOrFn === "function") {
			return (contextOrFn as F)(span) as ReturnType<F>;
		} else if (fn) {
			return fn(span) as ReturnType<F>;
		}
		throw new Error("Method not implemented.");
	}
}

export class MemoryTracerProvider implements TracerProvider {
	getTracer(name: string, version?: string | undefined, options?: TracerOptions | undefined): Tracer {
		return new MemoryTracer();
	}
}

export class MemoryTraceAPI {
	private _proxyTracerProvider:any = { 
		getTracer: () => {
			return {
				startSpan: () => {
					return {
						setAttributes: () => {
							return {
								end: jest.fn()
							};
						},
						end: jest.fn(),
					};
				} 
			};
		}
	};
  
	setGlobalTracerProvider(provider: TracerProvider): boolean {
		this._proxyTracerProvider = provider;
		return true;
	}
  
	getTracerProvider(): TracerProvider {
		return this._proxyTracerProvider;
	}
  
	getTracer(name: string, version?: string): Tracer {
		return this._proxyTracerProvider.getTracer(name, version);
	}
  
	disable(): void {
		this._proxyTracerProvider = undefined;
	}
}

export class MemoryTracing implements ITracing {
	context: ContextAPI;
	public trace: any = new MemoryTraceAPI() as unknown as MemoryTraceAPI; // TODO: Fix this issue with the private trace
	propagation: PropagationAPI;

	startChildSpan(tracer: Tracer, spanName: string, parentSpan: Span, spanKind?: SpanKind | undefined): Span {
		return new MemorySpan();
	}

	propagationInject(output: any): void {
		return;
	}

	propagationInjectFromSpan(span: Span, output: any): void {
		return;
	}

	propagationExtract(input: any): Context {
		return new MemoryContext();
	}

}
