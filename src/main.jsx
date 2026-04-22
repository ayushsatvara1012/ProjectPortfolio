import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import router from "./router";
import { useAuth } from "@clerk/clerk-react";
import "./index.css";
import { UserProvider } from "./context/UserContext";
import useLenis from "./hooks/useLenis";

// ── TanStack Query client (module-scope singleton) ──────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 min — reasonable for dashboard data
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Global fetch interceptor: emit a custom event on 402 so App.jsx can show an upgrade modal
const _originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await _originalFetch(...args);
  if (response.status === 402) {
    const cloned = response.clone();
    cloned.json().then(data => {
      if (data?.detail?.code) {
        window.dispatchEvent(new CustomEvent('sapybase:upgrade-required', { detail: data.detail }));
      }
    }).catch(() => { });
  }
  return response;
};

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const Root = () => {
  const { isLoaded: isAuthLoaded } = useAuth();
  useLenis();

  useEffect(() => {
    if (isAuthLoaded) {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }
    }
  }, [isAuthLoaded]);

  return <RouterProvider router={router} />;
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
          layout: {
            socialButtonsVariant: 'iconButton',
            shimmer: true
          },
          variables: {
            colorPrimary: '#4f46e5', // Indigo 600
            colorTextOnPrimaryBackground: 'white',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '1rem',
          }
        }}
      >
        <UserProvider>
          <QueryClientProvider client={queryClient}>
            <Root />
          </QueryClientProvider>
        </UserProvider>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>
);

