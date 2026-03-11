import type {
  AccountsSnapshot,
  BootstrapPayload,
  EventEnvelope,
  ProcessStatus,
  RenameAccountInput,
  ResultEnvelope,
  SwitchAccountInput,
  SwitchAccountResult,
} from "../contracts";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          LoadBootstrap?: () => Promise<BootstrapPayload>;
          LoadAccounts?: () => Promise<ResultEnvelope<AccountsSnapshot>>;
          GetProcessStatus?: () => Promise<ResultEnvelope<ProcessStatus>>;
          RenameAccount?: (
            input: RenameAccountInput,
          ) => Promise<ResultEnvelope<AccountsSnapshot>>;
          DeleteAccount?: (
            accountId: string,
          ) => Promise<ResultEnvelope<AccountsSnapshot>>;
          SwitchAccount?: (
            input: SwitchAccountInput,
          ) => Promise<ResultEnvelope<SwitchAccountResult>>;
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
