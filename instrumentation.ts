import { initLangfuseTracing } from './src/lib/observability/langfuse';

export function register() {
  initLangfuseTracing();
}
