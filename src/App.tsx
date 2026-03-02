import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";
import AppProviders from "./providers/AppProviders";
import { NetworkStatusWrapper } from "./components/layout/NetworkStatusWrapper";
import { useEffect } from "react";
import { initStartupDiagnostics } from "./utils/startupDiagnostics";

export default function App() {
  useEffect(() => {
    initStartupDiagnostics();
  }, []);

  return (
    <AppErrorBoundary>
      <AppProviders>
        <NetworkStatusWrapper>
          <RouterProvider router={router} />
        </NetworkStatusWrapper>
      </AppProviders>
    </AppErrorBoundary>
  );
}
