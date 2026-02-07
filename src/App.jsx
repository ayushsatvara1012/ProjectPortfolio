import { Outlet } from "react-router-dom";
import "./App.css";
import Navbar from "./components/navbar";
import Footer from "./components/footer";

function App() {
  return (
    <div className="flex flex-col">
      <Navbar />
        <Outlet />
      <Footer />
    </div>
  );
}

export default App;
