import type { i18n } from "i18next";

import type { AppServices } from "./lib/wails/services";
import { AppShell } from "./app/AppShell";

interface AppProps {
  i18n: i18n;
  services: AppServices;
}

export function App({ i18n, services }: AppProps) {
  return <AppShell i18n={i18n} services={services} />;
}

export default App;
