'use client';

import React, { useState } from 'react';

/* The one-line embed snippet with a copy button. Client-only for the clipboard
   interaction; the surrounding InstallStrip stays a Server Component. */
const SNIPPET = '<script src="https://cdn.sapybase.com/vaayu.js" data-bot="your-bot-id" defer></script>';

export default function CopyEmbed() {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SNIPPET).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#17161F] shadow-[0_16px_44px_-22px_rgba(26,25,20,0.4)]">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-[18px] py-3">
        <span className="font-mono text-[12px] text-white/40">index.html</span>
        <button
          type="button"
          onClick={onCopy}
          className="ml-auto cursor-pointer rounded-lg border border-white/[0.14] bg-white/[0.05] px-3 py-1.5 font-mono text-[11.5px] font-semibold tracking-wide text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-6 py-6 font-mono text-[14px] leading-[1.9] text-[#E9EAF2]">
        <code>
          <span className="text-[#6E7180]">{'<!-- Add once, before </body> -->'}</span>
          {'\n'}
          <span className="text-[#6E7180]">{'<'}</span>
          <span className="text-[#6E97FF]">script</span>{' '}
          <span className="text-[#5FD3A0]">src</span>=<span className="text-[#E9945B]">&quot;https://cdn.sapybase.com/vaayu.js&quot;</span>
          {'\n        '}
          <span className="text-[#5FD3A0]">data-bot</span>=<span className="text-[#E9945B]">&quot;your-bot-id&quot;</span>{' '}
          <span className="text-[#5FD3A0]">defer</span>
          <span className="text-[#6E7180]">{'></'}</span>
          <span className="text-[#6E97FF]">script</span>
          <span className="text-[#6E7180]">{'>'}</span>
        </code>
      </pre>
    </div>
  );
}
