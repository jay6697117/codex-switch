import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
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
  UsageCollection,
} from "../contracts";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          LoadBootstrap?: () => Promise<BootstrapPayload>;
          LoadAccounts?: () => Promise<ResultEnvelope<AccountsSnapshot>>;
          GetAccountUsage?: (
            accountId: string,
          ) => Promise<ResultEnvelope<AccountUsageSnapshot>>;
          GetProcessStatus?: () => Promise<ResultEnvelope<ProcessStatus>>;
          RefreshAllUsage?: () => Promise<ResultEnvelope<UsageCollection>>;
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
