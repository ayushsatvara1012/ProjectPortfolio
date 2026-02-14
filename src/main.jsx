import { StrictMode,useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import "./index.css";

const Root = () => {
  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      // Add a slight fade out for that high-end architect feel
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500); 
    }
  }, []);

  return <RouterProvider router={router} />;
};


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root/>
  </StrictMode>
);
