import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
  BackupImportSummary,
  BootstrapPayload,
  ExportFullBackupInput,
  ImportFromFileInput,
  ImportFullBackupInput,
  OAuthCancelResult,
  OAuthLoginInfo,
  PathSelectionResult,
  ProcessStatus,
  RenameAccountInput,
  ResultEnvelope,
  SaveSettingsInput,
  SettingsSnapshot,
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
          LoadSettings?: () => Promise<ResultEnvelope<SettingsSnapshot>>;
          SaveSettings?: (
            input: SaveSettingsInput,
          ) => Promise<ResultEnvelope<SettingsSnapshot>>;
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
          ExportSlimText?: () => Promise<ResultEnvelope<string>>;
          ImportSlimText?: (
            payload: string,
          ) => Promise<ResultEnvelope<BackupImportSummary>>;
          SelectFullExportPath?: () => Promise<ResultEnvelope<PathSelectionResult>>;
          ExportFullBackup?: (
            input: ExportFullBackupInput,
          ) => Promise<ResultEnvelope<boolean>>;
          SelectFullImportPath?: () => Promise<ResultEnvelope<PathSelectionResult>>;
          ImportFullBackup?: (
            input: ImportFullBackupInput,
          ) => Promise<ResultEnvelope<BackupImportSummary>>;
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
          SelectAuthFilePath?: () => Promise<ResultEnvelope<PathSelectionResult>>;
          ImportAccountFromFile?: (
            input: ImportFromFileInput,
          ) => Promise<ResultEnvelope<AccountsSnapshot>>;
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
