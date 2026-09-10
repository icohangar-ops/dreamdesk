import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

function hasLangfuseEnv() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY?.trim() && process.env.LANGFUSE_SECRET_KEY?.trim());
}

type LangfuseState = {
  spanProcessor: LangfuseSpanProcessor;
  tracerProvider: NodeTracerProvider;
};

const g = globalThis as typeof globalThis & {
  __dreamdeskLangfuse?: LangfuseState;
};

export function initLangfuseTracing(): LangfuseState {
  if (!hasLangfuseEnv()) {
    return null as unknown as LangfuseState;
  }

  if (g.__dreamdeskLangfuse) return g.__dreamdeskLangfuse;

  const spanProcessor = new LangfuseSpanProcessor({ exportMode: 'immediate' });
  const tracerProvider = new NodeTracerProvider({ spanProcessors: [spanProcessor] });
  tracerProvider.register();

  g.__dreamdeskLangfuse = { spanProcessor, tracerProvider };
  return g.__dreamdeskLangfuse;
}

export const langfuseSpanProcessor = {
  async forceFlush() {
    return undefined;
  },
};

initLangfuseTracing();
