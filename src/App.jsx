import { Outlet,ScrollRestoration } from "react-router-dom";
import "./App.css";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import './index.css'

function App() {
  return (
    <div className="flex flex-col">
      <ScrollRestoration getKey={(location, matches) => {
          // Standard: Each history entry has its own unique scroll position
          // This is the default behavior if you don't provide getKey
          return location.key;}}/>
      <Navbar />
        <Outlet />
      <Footer />
    </div>
  );
}

export default App;
