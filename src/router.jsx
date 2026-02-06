import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Homepage from "./pages/homepage";
import Contactpage from "./pages/contactpage";

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
        element: <Contactpage />,
      },
    ],
  },
]);

export default router;
