"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,          // 1 minute — don't refetch stable data
          gcTime: 5 * 60 * 1000,         // 5 minutes cache
          retry: (failureCount, error: any) => {
            // Don't retry on 401/403/404
            if ([401, 403, 404].includes(error?.statusCode)) return false;
            return failureCount < 2;
          },
          refetchOnWindowFocus: false,    // Don't refetch on every tab switch
        },
        mutations: {
          retry: false,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
