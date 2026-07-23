import React from 'react';

/* Four calm proof-points. Static (no count-up) to keep this off the client bundle. */
const stats: { value: React.ReactNode; label: string }[] = [
  { value: <>24<span className="text-[#004DE8] dark:text-[#6E97FF]">/7</span></>, label: 'Always-on answers' },
  { value: <><span className="text-[#004DE8] dark:text-[#6E97FF]">&lt;</span>5</>, label: 'Minutes to go live' },
  { value: <>1</>, label: 'Line of code to install' },
  { value: <><span className="text-[#004DE8] dark:text-[#6E97FF]">$</span>0</>, label: 'To start — free forever' },
];

export default function HomeMetrics() {
  return (
    <section className="bg-[#FAF9F5] dark:bg-[#14130E] py-28 lg:py-32 transition-colors duration-500">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-7 gap-y-14 px-6 text-center md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={i}>
            <div className="font-google text-[34px] font-bold tracking-[-0.035em] tabular-nums text-[#1A1914] dark:text-[#F5F3EB] sm:text-[44px] lg:text-[50px]">
              {s.value}
            </div>
            <div className="mt-2.5 font-google text-[14.5px] text-[#57544B] dark:text-[#ABA79A]">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
