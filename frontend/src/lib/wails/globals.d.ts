import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
  BootstrapPayload,
  OAuthCancelResult,
  OAuthLoginInfo,
  ProcessStatus,
  RenameAccountInput,
  ResultEnvelope,
  StartOAuthLoginInput,
  SwitchAccountInput,
  SwitchAccountResult,
  UsageCollection,
  WarmupAccountResult,
  WarmupAllResult,
  WarmupScheduleInput,
  WarmupScheduleStatus,
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
          WarmupAccount?: (
            accountId: string,
          ) => Promise<ResultEnvelope<WarmupAccountResult>>;
          WarmupAllAccounts?: () => Promise<ResultEnvelope<WarmupAllResult>>;
          LoadWarmupScheduleStatus?: () => Promise<ResultEnvelope<WarmupScheduleStatus>>;
          SaveWarmupSchedule?: (
            input: WarmupScheduleInput,
          ) => Promise<ResultEnvelope<WarmupScheduleStatus>>;
          DismissMissedRunToday?: () => Promise<ResultEnvelope<WarmupScheduleStatus>>;
          RunMissedWarmupNow?: () => Promise<ResultEnvelope<WarmupScheduleStatus>>;
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
      BrowserOpenURL?: (url: string) => void;
      EventsOn?: <T = unknown>(
        eventName: string,
        callback: (payload: T) => void,
      ) => (() => void) | Promise<() => void>;
      EventsOff?: (eventName: string) => void;
    };
  }
}

export {};
