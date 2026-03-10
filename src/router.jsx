import React, { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
const Homepage = lazy(() => import("./pages/homepage"));
const About = lazy(() => import("./pages/aboutpage"));
const Contactpage = lazy(() => import("./pages/contactpage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const ServicesCatalog = lazy(() => import("./pages/ServicesCatalog"));
import ErrorPage from "./pages/ErrorPage";

// 2. Create a high-end Loading fallback
// You can use a simple spinner or a skeleton screen that matches your theme
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-slate-950">
    <div className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
    </div>
  </div>
);

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
    ],
  },
]);

export default router;