export function openBrowserUrl(url: string): void {
  window.runtime?.BrowserOpenURL?.(url);
}
