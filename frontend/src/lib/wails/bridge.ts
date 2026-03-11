import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
  AppError,
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
  WarmupAccountResult,
  WarmupAllResult,
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

export async function loadBootstrapViaWails(): Promise<BootstrapPayload> {
  const loadBootstrap = window.go?.main?.App?.LoadBootstrap;

  if (!loadBootstrap) {
    return fallbackBootstrapPayload;
  }

  return loadBootstrap();
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
