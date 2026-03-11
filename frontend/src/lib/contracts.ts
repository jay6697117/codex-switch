export const supportedLocales = ["zh-CN", "en-US"] as const;

export type LocaleCode = (typeof supportedLocales)[number];

export interface AppInfo {
  name: string;
  version: string;
}

export interface AppMessage {
  code: string;
  args?: Record<string, string>;
}

export interface AppError {
  code: string;
  args?: Record<string, string>;
}

export interface BootstrapPayload {
  locale: LocaleCode;
  supportedLocales: LocaleCode[];
  hasManualOverride: boolean;
  app: AppInfo;
}

export interface StartOAuthLoginInput {
  accountName: string;
}

export interface OAuthLoginInfo {
  authUrl: string;
  callbackPort: number;
  pending: boolean;
}

export interface OAuthCancelResult {
  pending: boolean;
}

export interface RenameAccountInput {
  id: string;
  displayName: string;
}

export interface AccountSummary {
  id: string;
  displayName: string;
  email?: string;
  authKind: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface AccountsSnapshot {
  activeAccountId: string | null;
  accounts: AccountSummary[];
}

export interface ProcessStatus {
  foregroundCount: number;
  backgroundCount: number;
  canSwitch: boolean;
}

export interface SwitchAccountInput {
  accountId: string;
  confirmRestart: boolean;
}

export interface SwitchAccountResult {
  accounts: AccountsSnapshot;
  restartPerformed: boolean;
}

export interface EventEnvelope<T = unknown> {
  name: string;
  message?: AppMessage;
  data?: T;
}

export interface ResultEnvelope<T> {
  data?: T;
  message?: AppMessage;
  error?: AppError;
}
