import type {
  AccountsSnapshot,
  BootstrapPayload,
  EventEnvelope,
  OAuthCancelResult,
  OAuthLoginInfo,
  ProcessStatus,
  RenameAccountInput,
  ResultEnvelope,
  StartOAuthLoginInput,
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
          StartOAuthLogin?: (
            input: StartOAuthLoginInput,
          ) => Promise<ResultEnvelope<OAuthLoginInfo>>;
          CompleteOAuthLogin?: () => Promise<ResultEnvelope<AccountsSnapshot>>;
          CancelOAuthLogin?: () => Promise<ResultEnvelope<OAuthCancelResult>>;
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
