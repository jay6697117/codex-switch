import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";

import type { BootstrapPayload, LocaleCode } from "../lib/contracts";
import { supportedLocales } from "../lib/contracts";
import { resources } from "./resources";

export async function createAppI18n(initialLocale: LocaleCode = "en-US"): Promise<i18n> {
  const instance = i18next.createInstance();

  await instance.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: "en-US",
    supportedLngs: [...supportedLocales],
    defaultNS: "shell",
    ns: ["common", "errors", "shell"],
    resources,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

  return instance;
}

export async function applyBootstrapLocale(
  instance: i18n,
  payload: BootstrapPayload,
): Promise<void> {
  await instance.changeLanguage(payload.locale);
}
