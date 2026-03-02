import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import AppProviders from "./providers/AppProviders";
import { NetworkStatusWrapper } from "./components/layout/NetworkStatusWrapper";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";
import { initStartupDiagnostics } from "./utils/startupDiagnostics";

// Run once on module load
initStartupDiagnostics();

export default function App() {
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
