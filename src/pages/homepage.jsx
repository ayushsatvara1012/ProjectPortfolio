import Projects from "../components/projectSection";
import HeroSection from "../components/heroSection";
import Services from "../components/services";
import Metrics from "../components/metrics"

function homepage() {
  return (
    <>
      <HeroSection/>
      <Metrics />
      <Projects />
      <Services />
    </>
  );
}

export default homepage;