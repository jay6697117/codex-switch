import { accounts as accountsEn } from "./resources/en-US/accounts";
import { auth as authEn } from "./resources/en-US/auth";
import { common as commonEn } from "./resources/en-US/common";
import { errors as errorsEn } from "./resources/en-US/errors";
import { shell as shellEn } from "./resources/en-US/shell";
import { usage as usageEn } from "./resources/en-US/usage";
import { warmup as warmupEn } from "./resources/en-US/warmup";
import { accounts as accountsZh } from "./resources/zh-CN/accounts";
import { auth as authZh } from "./resources/zh-CN/auth";
import { common as commonZh } from "./resources/zh-CN/common";
import { errors as errorsZh } from "./resources/zh-CN/errors";
import { shell as shellZh } from "./resources/zh-CN/shell";
import { usage as usageZh } from "./resources/zh-CN/usage";
import { warmup as warmupZh } from "./resources/zh-CN/warmup";

export const resources = {
  "en-US": {
    accounts: accountsEn,
    auth: authEn,
    common: commonEn,
    errors: errorsEn,
    shell: shellEn,
    usage: usageEn,
    warmup: warmupEn,
  },
  "zh-CN": {
    accounts: accountsZh,
    auth: authZh,
    common: commonZh,
    errors: errorsZh,
    shell: shellZh,
    usage: usageZh,
    warmup: warmupZh,
  },
} as const;
