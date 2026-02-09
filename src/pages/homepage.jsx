import Projects from "../components/projectSection";
import HeroSection from "../components/heroSection";
import Services from "../components/services";

function homepage() {
  return (
    <>
      <HeroSection />
      <Projects />
      <Services />
    </>
  );
}

export default homepage;