// Startup diagnostics — run once at app boot
let initialized = false;

export function initStartupDiagnostics() {
  if (initialized) return;
  initialized = true;

  console.log('[Boot] App starting at', new Date().toISOString());

  window.onerror = (message, source, lineno, colno, error) => {
    console.error('[GlobalError]', message, { source, lineno, colno, error });
  };

  window.onunhandledrejection = (event) => {
    console.error('[UnhandledRejection]', event.reason);
  };
}
