const usageResetFormat: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const warmupNextRunFormat: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

function formatDateTime(
  value: string | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  invalidFallback: string,
): string {
  if (!value) {
    return invalidFallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return invalidFallback === "" ? value : invalidFallback;
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatUsageResetTime(value: string | undefined, locale: string): string {
  return formatDateTime(value, locale, usageResetFormat, "");
}

export function formatWarmupNextRun(value: string | undefined, locale: string): string {
  return formatDateTime(value, locale, warmupNextRunFormat, "—");
}
