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
import ErrorPage from "./pages/ErrorPage";

import Logo from "./components/Logo";

// 2. Create a high-end Loading fallback using the Logo
const PageLoader = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-slate-950">
      <Logo className="w-[160px] h-[80px] lg:w-[200px] lg:h-[100px]" />
    </div>
  );
};

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
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: "/register",
        element: (
          <Suspense fallback={<PageLoader />}>
            <Registration />
          </Suspense>
        ),
      },
    ],
  },
]);

export default router;