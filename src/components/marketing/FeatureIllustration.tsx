'use client';

const FeatureIllustration = () => {
  return (
    <section className="relative w-full bg-white dark:bg-slate-950 py-20 overflow-hidden flex items-center justify-center transition-colors duration-500 border-none inset-shadow-2xs">
      {/* Immersive Background SVG Container */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-600/10 rounded-full p-5 blur-[100px] scale-100 lg:scale-90" />
          <img
            src="/vector_ChatBG.svg"
            alt="Chat Background Vector"
            className="w-full h-full object-cover object-center relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_20px_50px_rgba(255,255,255,0.03)]"
          />
        </div>
      </div>

      {/* Foreground Illustrations Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 flex justify-center w-full">
        {/* Mobile Illustration */}
        <img
          src="/vector2_mobile.svg"
          alt="Feature Showcase Illustration Mobile"
          className="w-full h-auto max-w-7xl block min-[430px]:hidden drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        />
        {/* Tablet Illustration */}
        <img
          src="/vector2_tablet.svg"
          alt="Feature Showcase Illustration Tablet"
          className="w-full h-auto max-w-7xl hidden min-[430px]:block lg:hidden drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        />
        {/* Desktop Illustration */}
        <img
          src="/vector2.svg"
          alt="Feature Showcase Illustration Desktop"
          className="w-full h-auto max-w-7xl hidden lg:block drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        />
      </div>
    </section>
  );
};

export default FeatureIllustration;
