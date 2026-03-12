import type {
  AccountsSnapshot,
  AccountUsageSnapshot,
  BootstrapPayload,
  EventEnvelope,
  OAuthCancelResult,
  OAuthLoginInfo,
  ProcessStatus,
  RenameAccountInput,
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
  getAccountUsageViaWails,
  loadWarmupScheduleStatusViaWails,
  loadAccountsViaWails,
  loadBootstrapViaWails,
  loadProcessStatusViaWails,
  refreshAllUsageViaWails,
  renameAccountViaWails,
  saveWarmupScheduleViaWails,
  startOAuthLoginViaWails,
  subscribeToRuntimeEvent,
  switchAccountViaWails,
  warmupAccountViaWails,
  warmupAllAccountsViaWails,
} from "./bridge";

export interface BootstrapService {
  load(): Promise<BootstrapPayload>;
}

export interface RuntimeEventsService {
  subscribe<T>(
    eventName: string,
    handler: (payload: EventEnvelope<T>) => void,
  ): () => void;
}

export interface AccountsService {
  load(): Promise<AccountsSnapshot>;
  rename(input: RenameAccountInput): Promise<AccountsSnapshot>;
  remove(accountId: string): Promise<AccountsSnapshot>;
  switch(input: SwitchAccountInput): Promise<SwitchAccountResult>;
}

export interface ProcessService {
  getStatus(): Promise<ProcessStatus>;
}

export interface OAuthService {
  start(input: StartOAuthLoginInput): Promise<OAuthLoginInfo>;
  complete(): Promise<AccountsSnapshot>;
  cancel(): Promise<OAuthCancelResult>;
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
}

export interface AppServices {
  bootstrap: BootstrapService;
  accounts: AccountsService;
  process: ProcessService;
  oauth: OAuthService;
  usage: UsageService;
  warmup: WarmupService;
  events?: RuntimeEventsService;
}

export function createAppServices(): AppServices {
  return {
    bootstrap: {
      load: loadBootstrapViaWails,
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
    },
    events: {
      subscribe: subscribeToRuntimeEvent,
    },
  };
}
