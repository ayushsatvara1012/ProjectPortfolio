import { Outlet,ScrollRestoration } from "react-router-dom";
import "./App.css";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import './index.css'

function App() {
  return (
    <div className="flex flex-col">
      <ScrollRestoration />
      <Navbar />
        <Outlet />
      <Footer />
    </div>
  );
}

export default App;
