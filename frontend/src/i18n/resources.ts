import { accounts as accountsEn } from "./resources/en-US/accounts";
import { auth as authEn } from "./resources/en-US/auth";
import { backup as backupEn } from "./resources/en-US/backup";
import { common as commonEn } from "./resources/en-US/common";
import { errors as errorsEn } from "./resources/en-US/errors";
import { settings as settingsEn } from "./resources/en-US/settings";
import { shell as shellEn } from "./resources/en-US/shell";
import { usage as usageEn } from "./resources/en-US/usage";
import { warmup as warmupEn } from "./resources/en-US/warmup";
import { accounts as accountsZh } from "./resources/zh-CN/accounts";
import { auth as authZh } from "./resources/zh-CN/auth";
import { backup as backupZh } from "./resources/zh-CN/backup";
import { common as commonZh } from "./resources/zh-CN/common";
import { errors as errorsZh } from "./resources/zh-CN/errors";
import { settings as settingsZh } from "./resources/zh-CN/settings";
import { shell as shellZh } from "./resources/zh-CN/shell";
import { usage as usageZh } from "./resources/zh-CN/usage";
import { warmup as warmupZh } from "./resources/zh-CN/warmup";

export const resources = {
  "en-US": {
    accounts: accountsEn,
    auth: authEn,
    backup: backupEn,
    common: commonEn,
    errors: errorsEn,
    settings: settingsEn,
    shell: shellEn,
    usage: usageEn,
    warmup: warmupEn,
  },
  "zh-CN": {
    accounts: accountsZh,
    auth: authZh,
    backup: backupZh,
    common: commonZh,
    errors: errorsZh,
    settings: settingsZh,
    shell: shellZh,
    usage: usageZh,
    warmup: warmupZh,
  },
} as const;
