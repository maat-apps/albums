import "@maat-apps/ui/font";
import "./app/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerServiceWorker } from "./app/register-service-worker";
import { Root } from "./app/root";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
