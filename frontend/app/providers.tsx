"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";

/**
 * Root client-side providers. React Query owns server-state caching for
 * every API call made through `lib/api.ts`; Zustand stores (see
 * `lib/store/`) handle local UI state and don't need a provider.
 * `AuthProvider` is mounted here (above every route, public and admin) so
 * `/login` and `/admin/*` share one auth session instance.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {pathname.startsWith("/order/") ? children : <AuthProvider>{children}</AuthProvider>}
    </QueryClientProvider>
  );
}
