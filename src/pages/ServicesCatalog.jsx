import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Zap, Shield, Rocket, Phone, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import SEO from '../components/Seo';
import seoConfig from '../seo/seoConfig';

// Import generated assets
import customSoftwareImg from '../assets/custom_software.png';
import seoOptimizationImg from '../assets/seo_optimization.png';
import fullStackImg from '../assets/full_stack.png';
import webDesignImg from '../assets/web_design.png';

const services = [
  {
    id: 'custom-software',
    name: 'Custom Software Development',
    description: 'Bespoke software solutions engineered for scalability and performance. We build robust systems tailored to your unique business logic.',
    price: 'Starting from $3,000',
    image: customSoftwareImg,
    features: ['Microservices Architecture', 'Cloud Native', 'API Integration'],
    color: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'full-stack',
    name: 'Full Stack Development',
    description: 'End-to-end web applications built with modern stacks like React, Node.js, and Python. Seamless integration from frontend to database.',
    price: 'Starting from $2,500',
    image: fullStackImg,
    features: ['Responsive UI/UX', 'Real-time Features', 'Secure Authentication'],
    color: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'seo-optimization',
    name: 'SEO & Performance',
    description: 'Optimize your digital presence for search engines and lightning-fast load times. We ensure your brand is discovered and ranks high.',
    price: 'Starting from $300',
    image: seoOptimizationImg,
    features: ['Core Web Vitals', 'Technical SEO', 'Content Strategy'],
    color: 'from-purple-500 to-fuchsia-600'
  },
  {
    id: 'static-dynamic',
    name: 'Static & Dynamic Websites',
    description: 'High-speed static landing pages or feature-rich dynamic websites. Perfect for portfolios, marketing sites, and CMS-driven platforms.',
    price: 'Starting from $400',
    image: webDesignImg,
    features: ['Next.js / Vite', 'Headless CMS', 'Global Edge CDN'],
    color: 'from-orange-500 to-rose-600'
  }
];
const CodeEditor = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="hidden lg:block w-full max-w-lg perspective-1000"
    >
      <div className="relative group">
        {/* Glow Effect */}
        <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-violet-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

        {/* Editor Window */}
        <div className="relative bg-slate-900/90 dark:bg-slate-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Title Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">service_architect.ts</div>
            <div className="w-12"></div>
          </div>

          {/* Code Content */}
          <div className="p-6 font-mono text-sm leading-relaxed overflow-hidden">
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">1</span>
              <span className="text-indigo-400"><span className="text-purple-400">interface</span> <span className="text-blue-300">Project</span> &#123;</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">2</span>
              <span className="text-slate-300 ml-4">id: <span className="text-amber-300">string</span>;</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">3</span>
              <span className="text-slate-300 ml-4">scope: <span className="text-amber-300">'global'</span> | <span className="text-amber-300">'enterprise'</span>;</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">4</span>
              <span className="text-indigo-400">&#125;</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">5</span>
              <span>&nbsp;</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">6</span>
              <span className="text-purple-400">async function</span> <span className="text-emerald-400">buildExcellence</span><span className="text-orange-300">(config)&#123;</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">7</span>
              <span className="text-slate-300 ml-4">
                <span className="text-purple-400">return await</span> Architect.deploy(&#123;
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">8</span>
              <span className="text-slate-300 ml-8">performance: <span className="text-amber-300">1.0</span>,</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">9</span>
              <span className="text-slate-300 ml-8">ui: <span className="text-amber-300">'ultra-modern'</span></span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">10</span>
              <span className="text-slate-300 ml-4">&#125;);</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-600 select-none text-right w-4">11</span>
              <span className="text-indigo-400">&#125;</span>
            </div>
          </div>
          {/* Lines Decor */}
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-linear-to-b from-indigo-500/50 to-purple-500/50 opacity-20"></div>
        </div>
      </div>
    </motion.div>
  );
};

const ServicesCatalog = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <SEO {...seoConfig.services} />
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-32 pb-20 px-6 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-violet-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-20 lg:mb-32">
          <div className="space-y-6 flex-1 text-center lg:text-left">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors font-medium text-sm mb-2"
            >
              <ArrowLeft size={16} /> Back to Portfolio
            </motion.button>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-slate-200 leading-[1.1]"
            >
              Tailored Digital <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500">Service Solutions</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-2xl text-xl text-slate-600 dark:text-slate-400 font-light leading-relaxed mx-auto lg:mx-0"
            >
              We combine architectural precision with creative engineering to deliver products that redefine industry standards.
            </motion.p>
          </div>

          <CodeEditor />
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="group relative bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500"
            >
              {/* Image Container */}
              <div className="aspect-16/10 overflow-hidden relative">
                <img
                  src={service.image}
                  alt={service.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className={`absolute inset-0 bg-linear-to-t ${service.color} opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>

                {/* Price Tag Overlay */}
                <div className="absolute bottom-4 right-4 px-4 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/20 dark:border-slate-700 shadow-lg">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{service.price}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {service.name}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-light">
                    {service.description}
                  </p>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-3">
                  {service.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                    >
                      <CheckCircle2 size={12} className="text-indigo-500" />
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Action */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <button className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 group/btn">
                    Configure Project <Rocket size={18} className="transition-transform group-hover/btn:-translate-y-1 group-hover/btn:translate-x-1" />
                  </button>
                  <div className="flex gap-2">
                    <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                      <Zap size={16} />
                    </span>
                    <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                      <Shield size={16} />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 p-6 rounded-4xl bg-white dark:bg-slate-900 dark:border-slate-800 border border-slate-200 relative overflow-hidden text-center shadow-2xl"
        >
          {/* Decorative Mesh */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-30 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_70%)]"></div>
          </div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-widest uppercase">
              <Rocket size={14} /> Ready to Begin
            </div>

            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-slate-200 leading-tight">
              Ready to Architect Your <br />
              <span className="bg-linear-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">Digital Future?</span>
            </h2>

            <p className="text-slate-600 dark:text-slate-400 text-lg font-light leading-relaxed">
              Schedule a strategy call to discuss your project requirements and get a detailed architectural breakdown.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center pt-4">
              <a href="tel:+15626681855" className="flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 px-10 py-5 rounded-2xl font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                <Phone size={20} fill="currentColor" /> Book a Discovery Call
              </a>
              <button
                onClick={() => window.open('https://wa.me/15626681855', '_blank')}
                className="flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 px-10 py-5 rounded-2xl font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <MessageCircle size={20} fill="lightgreen" /> Message
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
    </>
  );
};

export default ServicesCatalog;
