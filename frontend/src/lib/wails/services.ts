import type {
  AccountsSnapshot,
  BootstrapPayload,
  EventEnvelope,
  OAuthCancelResult,
  OAuthLoginInfo,
  ProcessStatus,
  RenameAccountInput,
  StartOAuthLoginInput,
  SwitchAccountInput,
  SwitchAccountResult,
} from "../contracts";
import {
  cancelOAuthLoginViaWails,
  completeOAuthLoginViaWails,
  deleteAccountViaWails,
  loadAccountsViaWails,
  loadBootstrapViaWails,
  loadProcessStatusViaWails,
  renameAccountViaWails,
  startOAuthLoginViaWails,
  subscribeToRuntimeEvent,
  switchAccountViaWails,
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

export interface AppServices {
  bootstrap: BootstrapService;
  accounts: AccountsService;
  process: ProcessService;
  oauth: OAuthService;
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
    events: {
      subscribe: subscribeToRuntimeEvent,
    },
  };
}
