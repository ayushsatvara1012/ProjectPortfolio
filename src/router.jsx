/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
const Homepage = lazy(() => import("./pages/homepage"));
const About = lazy(() => import("./pages/aboutpage"));
const Contactpage = lazy(() => import("./pages/contactpage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const ServicesCatalog = lazy(() => import("./pages/ServicesCatalog"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Registration = lazy(() => import("./pages/Registration"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Pricing = lazy(() => import("./pages/Pricing"));
import ErrorPage from "./pages/ErrorPage";
import ProtectedRoute from "./components/ProtectedRoute";

import Logo from "./components/Logo";
import Loader from "./components/Loader";

// 2. Create a high-end Loading fallback using the unified Loader
const PageLoader = () => <Loader />;

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Homepage />
          </Suspense>
        ),
      },
      {
        path: "/contact",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Contactpage />
          </Suspense>
        ),
      },
      {
        path: "/about",
        element: (
          <Suspense fallback={<PageLoader />}>
            <About />
          </Suspense>
        ),
      },
      {
        path: "/privacy-policy",
        element: (
          <Suspense fallback={<PageLoader />}>
            <PrivacyPolicy />
          </Suspense>
        ),
      },
      {
        path: "/terms-and-conditions",
        element: (
          <Suspense fallback={<PageLoader />}>
            <TermsAndConditions />
          </Suspense>
        ),
      },
      {
        path: "/services",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ServicesCatalog />
          </Suspense>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: "/register",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute>
              <Registration />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: "/pricing",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Pricing />
          </Suspense>
        ),
      },
      {
        path: "/admin",
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute adminOnly={true}>
              <AdminDashboard />
            </ProtectedRoute>
          </Suspense>
        ),
      },
    ],
  },
]);

export default router;