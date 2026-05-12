'use client';

const FeatureIllustration = () => {
  return (
    <section className="w-full bg-white dark:bg-slate-950 py-20 flex items-center justify-center">
      <div className="max-w-7xl mx-auto flex justify-center">
        {/* Mobile Illustration */}
        <img
          src="/vector2_mobile.svg"
          alt="Feature Showcase Illustration Mobile"
          className="w-full h-auto max-w-7xl block min-[430px]:hidden"
        />
        {/* Tablet Illustration */}
        <img
          src="/vector2_tablet.svg"
          alt="Feature Showcase Illustration Tablet"
          className="w-full h-auto max-w-7xl hidden min-[430px]:block lg:hidden"
        />
        {/* Desktop Illustration */}
        <img
          src="/vector2.svg"
          alt="Feature Showcase Illustration Desktop"
          className="w-full h-auto max-w-7xl hidden lg:block"
        />
      </div>
    </section>
  );
};

export default FeatureIllustration;
