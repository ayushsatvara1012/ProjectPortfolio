import Projects from "../components/projectSection";
import HeroSection from "../components/heroSection";
import Services from "../components/services";
import Metrics from "../components/metrics"
import SEO from "../components/Seo";
import { seoConfig } from "../seo/seoConfig";

function homepage() {
  return (
    <>
      <SEO {...seoConfig.home} />
      <HeroSection/>
      <Metrics />
      <Projects />
      <Services />
    </>
  );
}

export default homepage;