import React, { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Homepage from "./pages/homepage";
import Apptest from './Apptest'
import About from "./pages/aboutpage";

// 1. Architect the Lazy Imports
// This tells Vite to create separate chunks for these components
const Contactpage = lazy(() => import("./pages/contactpage"));


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
    children: [
      {
        path: "/",
        element: <Homepage />,
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
        element: <About />,
      },
    ],
  },
]);

export default router;