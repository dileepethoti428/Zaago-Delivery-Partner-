import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";
import { useEffect } from "react";
import { initStartupDiagnostics } from "./utils/startupDiagnostics";

export default function App() {
  useEffect(() => {
    initStartupDiagnostics();
  }, []);

  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}
