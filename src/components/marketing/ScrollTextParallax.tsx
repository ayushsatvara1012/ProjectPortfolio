'use client';

const textItems = [
  {
    id: '1',
    title: "Not able to answer the question 24/7",
  },
  {
    id: '2',
    title: "Customer leaving your site unsatisfied",
  },
  {
    id: '3',
    title: "Response times affecting user experience",
  },
  {
    id: '4',
    title: "Manual support burden overwhelming your team",
  },
  {
    id: '5',
    title: "Missing revenue opportunities in conversations",
  },
];

const ScrollTextParallax = () => {
  return (
    <section className="w-full bg-white dark:bg-black py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Left Side: Visuals */}
          <div className="w-full order-1 lg:order-1 relative">
            <div className="relative w-full aspect-square flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-600/20 blur-[100px] rounded-full scale-110" />
              <img
                src="/vector1.svg"
                alt="Feature Visualization"
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_20px_50px_rgba(255,255,255,0.05)]"
              />
            </div>
          </div>

          {/* Right Side: Text List */}
          <div className="w-full order-2 lg:order-2">
            <div className="flex flex-col">
              {textItems.map((item, index) => (
                <div key={item.id}>
                  <div className="py-8">
                    <h3 className="text-2xl sm:text-2xl md:text-3xl font-google font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h3>
                  </div>
                  {index < textItems.length - 1 && (
                    <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ScrollTextParallax;
