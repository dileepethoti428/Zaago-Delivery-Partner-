import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { Toaster } from "@/components/ui/toaster";

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
