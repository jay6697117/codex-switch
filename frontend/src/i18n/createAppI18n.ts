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
    ns: ["accounts", "auth", "backup", "common", "errors", "settings", "shell", "usage", "warmup"],
    resources,
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

  const observedFallbacks = new Set<string>();
  const originalTranslate = instance.t.bind(instance);

  instance.t = ((...args: Parameters<typeof instance.t>) => {
    const [key, options] = args;
    const requestedKey = Array.isArray(key) ? key[0] : key;
    const resolvedLanguage =
      typeof options === "object" && options !== null && "lng" in options
        ? String(options.lng)
        : instance.language;

    if (typeof requestedKey === "string" && resolvedLanguage !== "en-US") {
      const cacheKey = `${resolvedLanguage}:${requestedKey}`;
      const existsInCurrentLocale = instance.exists(requestedKey, {
        lng: resolvedLanguage,
        fallbackLng: false,
      });
      const existsInEnglish = instance.exists(requestedKey, {
        lng: "en-US",
        fallbackLng: false,
      });

      if (!existsInCurrentLocale && existsInEnglish && !observedFallbacks.has(cacheKey)) {
        observedFallbacks.add(cacheKey);
        console.warn(
          `[i18n] Missing translation in active locale fallback: ${requestedKey} (${resolvedLanguage} -> en-US)`,
        );
      }
    }

    return originalTranslate(...args);
  }) as typeof instance.t;

  return instance;
}

export async function applyBootstrapLocale(
  instance: i18n,
  payload: BootstrapPayload,
): Promise<void> {
  await instance.changeLanguage(payload.locale);
}
