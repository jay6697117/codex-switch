import type {
  AccountsSnapshot,
  AppError,
  BootstrapPayload,
  EventEnvelope,
  ProcessStatus,
  RenameAccountInput,
  ResultEnvelope,
  SwitchAccountInput,
  SwitchAccountResult,
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
