import type {
  AccountsSnapshot,
  BootstrapPayload,
  EventEnvelope,
  ProcessStatus,
  RenameAccountInput,
  SwitchAccountInput,
  SwitchAccountResult,
} from "../contracts";
import {
  deleteAccountViaWails,
  loadAccountsViaWails,
  loadBootstrapViaWails,
  loadProcessStatusViaWails,
  renameAccountViaWails,
  switchAccountViaWails,
  subscribeToRuntimeEvent,
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

export interface AppServices {
  bootstrap: BootstrapService;
  accounts: AccountsService;
  process: ProcessService;
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
    events: {
      subscribe: subscribeToRuntimeEvent,
    },
  };
}
