import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
  BackupImportSummary,
  BootstrapPayload,
  ExportFullBackupInput,
  ImportFromFileInput,
  ImportFullBackupInput,
  MessageResult,
  PathSelectionResult,
  OAuthCancelResult,
  OAuthLoginInfo,
  ProcessStatus,
  RenameAccountInput,
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
import {
  cancelOAuthLoginViaWails,
  completeOAuthLoginViaWails,
  deleteAccountViaWails,
  dismissMissedRunTodayViaWails,
  exportFullBackupViaWails,
  exportSlimTextViaWails,
  getAccountUsageViaWails,
  importAccountFromFileViaWails,
  importFullBackupViaWails,
  importSlimTextViaWails,
  loadSettingsViaWails,
  loadWarmupScheduleStatusViaWails,
  loadAccountsViaWails,
  loadBootstrapViaWails,
  loadProcessStatusViaWails,
  refreshAllUsageViaWails,
  renameAccountViaWails,
  saveWarmupScheduleViaWails,
  saveSettingsViaWails,
  selectAuthFilePathViaWails,
  selectFullExportPathViaWails,
  selectFullImportPathViaWails,
  startOAuthLoginViaWails,
  subscribeToRuntimeEvent,
  switchAccountViaWails,
  runMissedWarmupNowViaWails,
  warmupAccountViaWails,
  warmupAllAccountsViaWails,
} from "./bridge";

export interface BootstrapService {
  load(): Promise<BootstrapPayload>;
}

export interface SettingsService {
  load(): Promise<SettingsSnapshot>;
  save(input: SaveSettingsInput): Promise<SettingsSnapshot>;
}

export interface RuntimeEventsService {
  subscribe<T>(eventName: string, handler: (payload: T) => void): () => void;
}

export interface AccountsService {
  load(): Promise<AccountsSnapshot>;
  rename(input: RenameAccountInput): Promise<AccountsSnapshot>;
  remove(accountId: string): Promise<AccountsSnapshot>;
  switch(input: SwitchAccountInput): Promise<MessageResult<SwitchAccountResult>>;
}

export interface ProcessService {
  getStatus(): Promise<ProcessStatus>;
}

export interface OAuthService {
  start(input: StartOAuthLoginInput): Promise<OAuthLoginInfo>;
  complete(): Promise<MessageResult<AccountsSnapshot>>;
  cancel(): Promise<OAuthCancelResult>;
  selectAuthFilePath(): Promise<PathSelectionResult>;
  importFromFile(input: ImportFromFileInput): Promise<MessageResult<AccountsSnapshot>>;
}

export interface UsageService {
  get(accountId: string): Promise<AccountUsageSnapshot>;
  refreshAll(): Promise<UsageCollection>;
}

export interface WarmupService {
  run(accountId: string): Promise<WarmupAccountResult>;
  runAll(): Promise<WarmupAllResult>;
  loadScheduleStatus(): Promise<WarmupScheduleStatus>;
  saveSchedule(input: WarmupScheduleInput): Promise<WarmupScheduleStatus>;
  dismissMissedRunToday(): Promise<WarmupScheduleStatus>;
  runMissedWarmupNow(): Promise<WarmupScheduleStatus>;
}

export interface BackupService {
  exportSlimText(): Promise<string>;
  importSlimText(payload: string): Promise<BackupImportSummary>;
  selectFullExportPath(): Promise<PathSelectionResult>;
  exportFull(input: ExportFullBackupInput): Promise<boolean>;
  selectFullImportPath(): Promise<PathSelectionResult>;
  importFull(input: ImportFullBackupInput): Promise<BackupImportSummary>;
}

export interface AppServices {
  bootstrap: BootstrapService;
  settings: SettingsService;
  accounts: AccountsService;
  process: ProcessService;
  oauth: OAuthService;
  usage: UsageService;
  warmup: WarmupService;
  backup: BackupService;
  events?: RuntimeEventsService;
}

export function createAppServices(): AppServices {
  return {
    bootstrap: {
      load: loadBootstrapViaWails,
    },
    settings: {
      load: loadSettingsViaWails,
      save: saveSettingsViaWails,
    },
    accounts: {
      load: loadAccountsViaWails,
      rename: renameAccountViaWails,
      remove: deleteAccountViaWails,
      switch: switchAccountViaWails,
    },
    process: {
      getStatus: loadProcessStatusViaWails,
    },
    oauth: {
      start: startOAuthLoginViaWails,
      complete: completeOAuthLoginViaWails,
      cancel: cancelOAuthLoginViaWails,
      selectAuthFilePath: selectAuthFilePathViaWails,
      importFromFile: importAccountFromFileViaWails,
    },
    usage: {
      get: getAccountUsageViaWails,
      refreshAll: refreshAllUsageViaWails,
    },
    warmup: {
      run: warmupAccountViaWails,
      runAll: warmupAllAccountsViaWails,
      loadScheduleStatus: loadWarmupScheduleStatusViaWails,
      saveSchedule: saveWarmupScheduleViaWails,
      dismissMissedRunToday: dismissMissedRunTodayViaWails,
      runMissedWarmupNow: runMissedWarmupNowViaWails,
    },
    backup: {
      exportSlimText: exportSlimTextViaWails,
      importSlimText: importSlimTextViaWails,
      selectFullExportPath: selectFullExportPathViaWails,
      exportFull: exportFullBackupViaWails,
      selectFullImportPath: selectFullImportPathViaWails,
      importFull: importFullBackupViaWails,
    },
    events: {
      subscribe: subscribeToRuntimeEvent,
    },
  };
}
