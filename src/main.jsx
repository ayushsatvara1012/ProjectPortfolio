import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ClerkProvider } from "@clerk/clerk-react";
import router from "./router";
import { useAuth } from "@clerk/clerk-react";
import "./index.css";
import { UserProvider } from "./context/UserContext";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const Root = () => {
  const { isLoaded: isAuthLoaded } = useAuth();

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
          <Root />
        </UserProvider>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>
);

