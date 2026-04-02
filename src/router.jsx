/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";
const Homepage = lazy(() => import("./pages/homepage"));
const About = lazy(() => import("./pages/aboutpage"));
const Contactpage = lazy(() => import("./pages/contactpage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const ServicesCatalog = lazy(() => import("./pages/ServicesCatalog"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

// ── App Layout pages ───────────────────────────────────────────────────────────
const AppLayout = lazy(() => import("./components/AppLayout"));
const AppBotManager = lazy(() => import("./pages/AppBotManager"));
const AppTrainAI = lazy(() => import("./pages/AppTrainAI"));
const AppRegistration = lazy(() => import("./pages/AppRegistration"));
const AppPricing = lazy(() => import("./pages/AppPricing"));
const AppSettings = lazy(() => import("./pages/AppSettings"));

// Settings sub-sections (named exports)
const AppSettingsAccount = lazy(() => import("./pages/AppSettings").then(m => ({ default: m.AccountSection })));
const AppSettingsBilling = lazy(() => import("./pages/AppSettings").then(m => ({ default: m.BillingSection })));
const AppSettingsCustomize = lazy(() => import("./pages/AppSettings").then(m => ({ default: m.CustomizeSection })));
const AppSettingsApiKeys = lazy(() => import("./pages/AppSettings").then(m => ({ default: m.ApiKeysSection })));

import ErrorPage from "./pages/ErrorPage";
import ProtectedRoute from "./components/ProtectedRoute";
// Minimal fallback for public routes — avoids a skeleton flash inside the navbar layout
const PageLoader = () => <div className="min-h-[60vh]" />;

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <Suspense fallback={<PageLoader />}><Homepage /></Suspense> },
      { path: "/contact", element: <Suspense fallback={<PageLoader />}><Contactpage /></Suspense> },
      { path: "/about", element: <Suspense fallback={<PageLoader />}><About /></Suspense> },
      { path: "/privacy-policy", element: <Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense> },
      { path: "/terms-and-conditions", element: <Suspense fallback={<PageLoader />}><TermsAndConditions /></Suspense> },
      { path: "/services", element: <Suspense fallback={<PageLoader />}><ServicesCatalog /></Suspense> },
      // Legacy routes — redirect to AppLayout equivalents
      { path: "/pricing", element: <Navigate to="/app/pricing" replace /> },
      {
        path: "/admin",
        element: <Navigate to="/app/settings/admin" replace />,
      },
    ],
  },
  // ── Application Shell ────────────────────────────────────────────────────────
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <Suspense fallback={null}>
          <AppLayout />
        </Suspense>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/app/bots" replace /> },
      { path: "bots", element: <AppBotManager /> },
      { path: "train", element: <AppTrainAI /> },
      { path: "register", element: <AppRegistration /> },
      { path: "pricing", element: <AppPricing /> },
      {
        path: "settings",
        element: <AppSettings />,
        children: [
          { index: true, element: <Navigate to="account" replace /> },
          { path: "account", element: <AppSettingsAccount /> },
          { path: "billing", element: <AppSettingsBilling /> },
          { path: "customize", element: <AppSettingsCustomize /> },
          { path: "apikeys", element: <AppSettingsApiKeys /> },
          { path: "admin", element: <AdminDashboard /> },
        ],
      },
    ],
  },
]);

export default router;