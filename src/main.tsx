import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import AppProviders from "./providers/AppProviders";
import { NetworkStatusWrapper } from "./components/layout/NetworkStatusWrapper";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <AppProviders>
    <NetworkStatusWrapper>
      <RouterProvider router={router} />
    </NetworkStatusWrapper>
  </AppProviders>,
);
