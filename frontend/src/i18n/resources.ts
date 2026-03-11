import { accounts as accountsEn } from "./resources/en-US/accounts";
import { common as commonEn } from "./resources/en-US/common";
import { errors as errorsEn } from "./resources/en-US/errors";
import { shell as shellEn } from "./resources/en-US/shell";
import { accounts as accountsZh } from "./resources/zh-CN/accounts";
import { common as commonZh } from "./resources/zh-CN/common";
import { errors as errorsZh } from "./resources/zh-CN/errors";
import { shell as shellZh } from "./resources/zh-CN/shell";

export const resources = {
  "en-US": {
    accounts: accountsEn,
    common: commonEn,
    errors: errorsEn,
    shell: shellEn,
  },
  "zh-CN": {
    accounts: accountsZh,
    common: commonZh,
    errors: errorsZh,
    shell: shellZh,
  },
} as const;
