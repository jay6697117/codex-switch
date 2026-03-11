import type { BootstrapPayload, EventEnvelope } from "../contracts";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          LoadBootstrap?: () => Promise<BootstrapPayload>;
        };
      };
    };
    runtime?: {
      EventsOn?: <T = unknown>(
        eventName: string,
        callback: (payload: EventEnvelope<T>) => void,
      ) => (() => void) | Promise<() => void>;
      EventsOff?: (eventName: string) => void;
    };
  }
}

export {};
