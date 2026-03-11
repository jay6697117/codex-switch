import type { BootstrapPayload, EventEnvelope } from "../contracts";

const fallbackBootstrapPayload: BootstrapPayload = {
  locale: "en-US",
  supportedLocales: ["zh-CN", "en-US"],
  hasManualOverride: false,
  app: {
    name: "Codex Switch",
    version: "0.1.0",
  },
};

export async function loadBootstrapViaWails(): Promise<BootstrapPayload> {
  const loadBootstrap = window.go?.main?.App?.LoadBootstrap;

  if (!loadBootstrap) {
    return fallbackBootstrapPayload;
  }

  return loadBootstrap();
}

export function subscribeToRuntimeEvent<T>(
  eventName: string,
  handler: (payload: EventEnvelope<T>) => void,
): () => void {
  const subscribe = window.runtime?.EventsOn;

  if (!subscribe) {
    return () => undefined;
  }

  let disposed = false;
  const cleanup = subscribe<T>(eventName, handler);

  if (cleanup instanceof Promise) {
    cleanup.catch(() => undefined);
    return () => {
      disposed = true;
    };
  }

  return () => {
    if (disposed) {
      return;
    }
    cleanup?.();
  };
}
