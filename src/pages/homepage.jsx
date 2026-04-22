import HeroSection from "../components/heroSection";
import Services from "../components/services";
import Metrics from "../components/metrics";
import HowItWorks from "../components/HowItWorks";
import SEO from "../components/Seo";
import { seoConfig } from "../seo/seoConfig";
import ScrollReveal from "../components/ScrollReveal";

function homepage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.sapybase.com/#organization",
        "name": "SaPyBase",
        "url": "https://www.sapybase.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.sapybase.com/SB_Brand-removebg.png"
        }
      },
      {
        "@type": "SoftwareApplication",
        "name": "SaPyBase AI Chatbot",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://www.sapybase.com",
        "description": "Autonomous AI chatbots and agents for modern businesses. Connect documents and databases to automate customer support and sales.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      }
    ]
  };

  return (
    <>
      <SEO {...seoConfig.home} schema={schema} />
      <HeroSection/>
      <ScrollReveal><HowItWorks /></ScrollReveal>
      <ScrollReveal delay={0.05}><Metrics /></ScrollReveal>
      <ScrollReveal delay={0.05}><Services /></ScrollReveal>
    </>
  );
}

export default homepage;