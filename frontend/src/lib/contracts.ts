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

export interface UsageWindowSnapshot {
  usedPercent?: number;
  windowMinutes: number;
  resetsAt?: string;
}

export interface AccountUsageSnapshot {
  accountId: string;
  planType?: string;
  status: string;
  reasonCode?: string;
  fiveHour?: UsageWindowSnapshot;
  weekly?: UsageWindowSnapshot;
  refreshedAt: string;
}

export interface UsageCollection {
  items: AccountUsageSnapshot[];
}

export interface WarmupAvailability {
  isAvailable: boolean;
  reasonCode?: string;
}

export interface WarmupAccountResult {
  accountId: string;
  availability: WarmupAvailability;
  status: string;
  failureCode?: string;
  completedAt: string;
}

export interface WarmupSummary {
  totalAccounts: number;
  eligibleAccounts: number;
  successfulAccounts: number;
  failedAccounts: number;
  skippedAccounts: number;
}

export interface WarmupAllResult {
  items: WarmupAccountResult[];
  summary: WarmupSummary;
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
  warmupAvailability: WarmupAvailability;
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
