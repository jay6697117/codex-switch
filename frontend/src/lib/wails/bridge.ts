import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
  AppError,
  BackupImportSummary,
  ExportFullBackupInput,
  BootstrapPayload,
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

const fallbackBootstrapPayload: BootstrapPayload = {
  locale: "en-US",
  supportedLocales: ["zh-CN", "en-US"],
  hasManualOverride: false,
  app: {
    name: "Codex Switch",
    version: "0.1.0",
  },
};

const fallbackSettingsSnapshot: SettingsSnapshot = {
  localePreference: "system",
  effectiveLocale: "en-US",
  backupSecurityMode: "keychain",
};

export async function loadBootstrapViaWails(): Promise<BootstrapPayload> {
  const loadBootstrap = window.go?.main?.App?.LoadBootstrap;

  if (!loadBootstrap) {
    return fallbackBootstrapPayload;
  }

  return loadBootstrap();
}

export async function loadSettingsViaWails(): Promise<SettingsSnapshot> {
  const loadSettings = window.go?.main?.App?.LoadSettings;

  if (!loadSettings) {
    return fallbackSettingsSnapshot;
  }

  return unwrapEnvelope(await loadSettings(), "settings.save_failed");
}

export async function saveSettingsViaWails(
  input: SaveSettingsInput,
): Promise<SettingsSnapshot> {
  const saveSettings = window.go?.main?.App?.SaveSettings;

  if (!saveSettings) {
    throw { code: "settings.save_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await saveSettings(input), "settings.save_failed");
}

const fallbackAccountsSnapshot: AccountsSnapshot = {
  activeAccountId: null,
  accounts: [],
};

const fallbackProcessStatus: ProcessStatus = {
  foregroundCount: 0,
  backgroundCount: 0,
  canSwitch: true,
};

function unwrapEnvelope<T>(envelope: ResultEnvelope<T> | undefined, fallbackCode: string): T {
  if (envelope?.error) {
    throw envelope.error;
  }

  if (envelope?.data !== undefined) {
    return envelope.data;
  }

  throw { code: fallbackCode } satisfies AppError;
}

export async function loadAccountsViaWails(): Promise<AccountsSnapshot> {
  const loadAccounts = window.go?.main?.App?.LoadAccounts;

  if (!loadAccounts) {
    return fallbackAccountsSnapshot;
  }

  return unwrapEnvelope(await loadAccounts(), "account.load_failed");
}

export async function loadProcessStatusViaWails(): Promise<ProcessStatus> {
  const getProcessStatus = window.go?.main?.App?.GetProcessStatus;

  if (!getProcessStatus) {
    return fallbackProcessStatus;
  }

  return unwrapEnvelope(await getProcessStatus(), "process.detect_failed");
}

export async function renameAccountViaWails(
  input: RenameAccountInput,
): Promise<AccountsSnapshot> {
  const renameAccount = window.go?.main?.App?.RenameAccount;

  if (!renameAccount) {
    throw { code: "account.rename_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await renameAccount(input), "account.rename_failed");
}

export async function deleteAccountViaWails(
  accountId: string,
): Promise<AccountsSnapshot> {
  const deleteAccount = window.go?.main?.App?.DeleteAccount;

  if (!deleteAccount) {
    throw { code: "account.delete_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await deleteAccount(accountId), "account.delete_failed");
}

export async function switchAccountViaWails(
  input: SwitchAccountInput,
): Promise<SwitchAccountResult> {
  const switchAccount = window.go?.main?.App?.SwitchAccount;

  if (!switchAccount) {
    throw { code: "switch.active_update_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await switchAccount(input), "switch.active_update_failed");
}

export async function startOAuthLoginViaWails(
  input: StartOAuthLoginInput,
): Promise<OAuthLoginInfo> {
  const startOAuthLogin = window.go?.main?.App?.StartOAuthLogin;

  if (!startOAuthLogin) {
    throw { code: "oauth.start_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await startOAuthLogin(input), "oauth.start_failed");
}

export async function completeOAuthLoginViaWails(): Promise<AccountsSnapshot> {
  const completeOAuthLogin = window.go?.main?.App?.CompleteOAuthLogin;

  if (!completeOAuthLogin) {
    throw { code: "oauth.complete_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await completeOAuthLogin(), "oauth.complete_failed");
}

export async function cancelOAuthLoginViaWails(): Promise<OAuthCancelResult> {
  const cancelOAuthLogin = window.go?.main?.App?.CancelOAuthLogin;

  if (!cancelOAuthLogin) {
    throw { code: "oauth.cancel_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await cancelOAuthLogin(), "oauth.cancel_failed");
}

export async function getAccountUsageViaWails(
  accountId: string,
): Promise<AccountUsageSnapshot> {
  const getAccountUsage = window.go?.main?.App?.GetAccountUsage;

  if (!getAccountUsage) {
    throw { code: "usage.load_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await getAccountUsage(accountId), "usage.load_failed");
}

export async function refreshAllUsageViaWails(): Promise<UsageCollection> {
  const refreshAllUsage = window.go?.main?.App?.RefreshAllUsage;

  if (!refreshAllUsage) {
    throw { code: "usage.load_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await refreshAllUsage(), "usage.load_failed");
}

export async function warmupAccountViaWails(
  accountId: string,
): Promise<WarmupAccountResult> {
  const warmupAccount = window.go?.main?.App?.WarmupAccount;

  if (!warmupAccount) {
    throw { code: "warmup.execute_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await warmupAccount(accountId), "warmup.execute_failed");
}

export async function warmupAllAccountsViaWails(): Promise<WarmupAllResult> {
  const warmupAllAccounts = window.go?.main?.App?.WarmupAllAccounts;

  if (!warmupAllAccounts) {
    throw { code: "warmup.execute_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await warmupAllAccounts(), "warmup.execute_failed");
}

export async function loadWarmupScheduleStatusViaWails(): Promise<WarmupScheduleStatus> {
  const loadWarmupScheduleStatus = window.go?.main?.App?.LoadWarmupScheduleStatus;

  if (!loadWarmupScheduleStatus) {
    throw { code: "warmup.schedule_load_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await loadWarmupScheduleStatus(), "warmup.schedule_load_failed");
}

export async function saveWarmupScheduleViaWails(
  input: WarmupScheduleInput,
): Promise<WarmupScheduleStatus> {
  const saveWarmupSchedule = window.go?.main?.App?.SaveWarmupSchedule;

  if (!saveWarmupSchedule) {
    throw { code: "warmup.schedule_load_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await saveWarmupSchedule(input), "warmup.schedule_load_failed");
}

export async function dismissMissedRunTodayViaWails(): Promise<WarmupScheduleStatus> {
  const dismissMissedRunToday = window.go?.main?.App?.DismissMissedRunToday;

  if (!dismissMissedRunToday) {
    throw { code: "warmup.schedule_load_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await dismissMissedRunToday(), "warmup.schedule_load_failed");
}

export async function runMissedWarmupNowViaWails(): Promise<WarmupScheduleStatus> {
  const runMissedWarmupNow = window.go?.main?.App?.RunMissedWarmupNow;

  if (!runMissedWarmupNow) {
    throw { code: "warmup.execute_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await runMissedWarmupNow(), "warmup.execute_failed");
}

export async function exportSlimTextViaWails(): Promise<string> {
  const exportSlimText = window.go?.main?.App?.ExportSlimText;

  if (!exportSlimText) {
    throw { code: "backup.export_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await exportSlimText(), "backup.export_failed");
}

export async function importSlimTextViaWails(
  payload: string,
): Promise<BackupImportSummary> {
  const importSlimText = window.go?.main?.App?.ImportSlimText;

  if (!importSlimText) {
    throw { code: "backup.import_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await importSlimText(payload), "backup.import_failed");
}

export async function selectFullExportPathViaWails(): Promise<PathSelectionResult> {
  const selectFullExportPath = window.go?.main?.App?.SelectFullExportPath;

  if (!selectFullExportPath) {
    throw { code: "backup.export_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await selectFullExportPath(), "backup.export_failed");
}

export async function exportFullBackupViaWails(
  input: ExportFullBackupInput,
): Promise<boolean> {
  const exportFullBackup = window.go?.main?.App?.ExportFullBackup;

  if (!exportFullBackup) {
    throw { code: "backup.export_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await exportFullBackup(input), "backup.export_failed");
}

export async function selectFullImportPathViaWails(): Promise<PathSelectionResult> {
  const selectFullImportPath = window.go?.main?.App?.SelectFullImportPath;

  if (!selectFullImportPath) {
    throw { code: "backup.import_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await selectFullImportPath(), "backup.import_failed");
}

export async function importFullBackupViaWails(
  input: ImportFullBackupInput,
): Promise<BackupImportSummary> {
  const importFullBackup = window.go?.main?.App?.ImportFullBackup;

  if (!importFullBackup) {
    throw { code: "backup.import_failed" } satisfies AppError;
  }

  return unwrapEnvelope(await importFullBackup(input), "backup.import_failed");
}

export function subscribeToRuntimeEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
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
