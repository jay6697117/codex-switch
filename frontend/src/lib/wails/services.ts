import type { BootstrapPayload, EventEnvelope } from "../contracts";
import { loadBootstrapViaWails, subscribeToRuntimeEvent } from "./bridge";

export interface BootstrapService {
  load(): Promise<BootstrapPayload>;
}

export interface RuntimeEventsService {
  subscribe<T>(
    eventName: string,
    handler: (payload: EventEnvelope<T>) => void,
  ): () => void;
}

export interface AppServices {
  bootstrap: BootstrapService;
  events?: RuntimeEventsService;
}

export function createAppServices(): AppServices {
  return {
    bootstrap: {
      load: loadBootstrapViaWails,
    },
    events: {
      subscribe: subscribeToRuntimeEvent,
    },
  };
}
