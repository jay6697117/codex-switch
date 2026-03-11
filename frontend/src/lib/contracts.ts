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
