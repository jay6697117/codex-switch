import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { createAppI18n } from "./i18n/createAppI18n";
import { createAppServices } from "./lib/wails/services";
import "./styles/tokens.css";
import "./styles/global.css";

async function bootstrap() {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element not found");
  }

  const [i18n, services] = await Promise.all([
    createAppI18n(),
    Promise.resolve(createAppServices()),
  ]);

  startTransition(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <App i18n={i18n} services={services} />
      </StrictMode>,
    );
  });
}

void bootstrap();
