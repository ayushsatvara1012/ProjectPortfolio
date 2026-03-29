import React from 'react';

const Loader = ({ fullScreen = false }) => {
    const stackSvg = (
        <svg width="100%" viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>{`
                    @keyframes drop1 {
                        0%      { transform: translateY(-220px); opacity:0; }
                        6%      { opacity:1; }
                        20%     { transform: translateY(0px);   animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
                        27%     { transform: translateY(-28px);  animation-timing-function: cubic-bezier(0.55,0,1,0.45); }
                        34%     { transform: translateY(0px);   animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
                        38%     { transform: translateY(-10px);  animation-timing-function: cubic-bezier(0.55,0,1,0.45); }
                        42%     { transform: translateY(0px); }
                        100%    { transform: translateY(0px); opacity:1; }
                    }
                    @keyframes drop2 {
                        0%,24%  { transform: translateY(-220px); opacity:0; }
                        30%     { opacity:1; }
                        44%     { transform: translateY(0px);   animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
                        51%     { transform: translateY(-22px);  animation-timing-function: cubic-bezier(0.55,0,1,0.45); }
                        57%     { transform: translateY(0px);   animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
                        61%     { transform: translateY(-8px);   animation-timing-function: cubic-bezier(0.55,0,1,0.45); }
                        65%     { transform: translateY(0px); }
                        100%    { transform: translateY(0px); opacity:1; }
                    }
                    @keyframes drop3 {
                        0%,46%  { transform: translateY(-220px); opacity:0; }
                        52%     { opacity:1; }
                        64%     { transform: translateY(0px);   animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
                        70%     { transform: translateY(-16px);  animation-timing-function: cubic-bezier(0.55,0,1,0.45); }
                        76%     { transform: translateY(0px);   animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
                        79%     { transform: translateY(-5px);   animation-timing-function: cubic-bezier(0.55,0,1,0.45); }
                        82%     { transform: translateY(0px); }
                        88%     { opacity:1; }
                        96%     { opacity:0; }
                        100%    { opacity:0; transform: translateY(0px); }
                    }
                    @keyframes squish1 {
                        0%,18%  { transform: scaleX(1)    scaleY(1); }
                        20%     { transform: scaleX(1.18) scaleY(0.76); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
                        30%     { transform: scaleX(1)    scaleY(1); }
                        34%     { transform: scaleX(1.10) scaleY(0.88); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
                        40%     { transform: scaleX(1)    scaleY(1); }
                        100%    { transform: scaleX(1)    scaleY(1); }
                    }
                    @keyframes squish2 {
                        0%,42%  { transform: scaleX(1)    scaleY(1); }
                        44%     { transform: scaleX(1.15) scaleY(0.79); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
                        53%     { transform: scaleX(1)    scaleY(1); }
                        57%     { transform: scaleX(1.08) scaleY(0.90); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
                        63%     { transform: scaleX(1)    scaleY(1); }
                        100%    { transform: scaleX(1)    scaleY(1); }
                    }
                    @keyframes squish3 {
                        0%,62%  { transform: scaleX(1)    scaleY(1); }
                        64%     { transform: scaleX(1.12) scaleY(0.82); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
                        72%     { transform: scaleX(1)    scaleY(1); }
                        76%     { transform: scaleX(1.06) scaleY(0.92); animation-timing-function: cubic-bezier(0.34,1.56,0.64,1); }
                        81%     { transform: scaleX(1)    scaleY(1); }
                        100%    { transform: scaleX(1)    scaleY(1); }
                    }
                    @keyframes sh1 {
                        0%      { transform: scaleX(0.08); opacity:0; }
                        6%      { opacity:1; }
                        20%     { transform: scaleX(1); }
                        27%     { transform: scaleX(0.55); }
                        34%     { transform: scaleX(1); }
                        38%     { transform: scaleX(0.78); }
                        42%     { transform: scaleX(1); }
                        100%    { transform: scaleX(1); }
                    }
                    @keyframes sh2 {
                        0%,24%  { transform: scaleX(0.08); opacity:0; }
                        30%     { opacity:0.9; }
                        44%     { transform: scaleX(1); }
                        51%     { transform: scaleX(0.55); }
                        57%     { transform: scaleX(1); }
                        61%     { transform: scaleX(0.78); }
                        65%     { transform: scaleX(1); }
                        100%    { transform: scaleX(1); }
                    }
                    @keyframes sh3 {
                        0%,46%  { transform: scaleX(0.08); opacity:0; }
                        52%     { opacity:0.8; }
                        64%     { transform: scaleX(1); }
                        70%     { transform: scaleX(0.55); }
                        76%     { transform: scaleX(1); }
                        79%     { transform: scaleX(0.78); }
                        82%     { transform: scaleX(1); }
                        88%     { opacity:0.8; }
                        96%     { opacity:0; }
                        100%    { opacity:0; }
                    }
                    @keyframes fadeall {
                        0%,84% { opacity:1; }
                        94%    { opacity:0; }
                        100%   { opacity:0; }
                    }
                    .d1 { animation: drop1   2.4s cubic-bezier(0.55,0,1,0.45) infinite; }
                    .d2 { animation: drop2   2.4s cubic-bezier(0.55,0,1,0.45) infinite; }
                    .d3 { animation: drop3   2.4s cubic-bezier(0.55,0,1,0.45) infinite; }
                    .s1 { animation: squish1 2.4s ease-out infinite; transform-origin: 340px 212px; }
                    .s2 { animation: squish2 2.4s ease-out infinite; transform-origin: 340px 172px; }
                    .s3 { animation: squish3 2.4s ease-out infinite; transform-origin: 340px 132px; }
                    .e1 { animation: sh1 2.4s ease-in-out infinite; transform-origin: 340px 214px; }
                    .e2 { animation: sh2 2.4s ease-in-out infinite; transform-origin: 340px 174px; }
                    .e3 { animation: sh3 2.4s ease-in-out infinite; transform-origin: 340px 134px; }
                    .all-fade { animation: fadeall 2.4s ease-in-out infinite; }
                `}</style>
            </defs>

            <g className="all-fade">
                <ellipse className="e1" cx="340" cy="214" rx="66" ry="5" fill="#0F2060" opacity="0.2"/>
                <ellipse className="e2" cx="340" cy="174" rx="66" ry="4" fill="#0F2060" opacity="0.15"/>
                <ellipse className="e3" cx="340" cy="134" rx="66" ry="3" fill="#5730F5" opacity="0.13"/>

                <g className="d1"><g className="s1">
                    <rect x="276" y="178" width="128" height="36" rx="5" fill="#0F2060"/>
                </g></g>
                <g className="d2"><g className="s2">
                    <rect x="276" y="138" width="128" height="36" rx="5" fill="#1a2f7a"/>
                </g></g>
                <g className="d3"><g className="s3">
                    <rect x="276" y="98"  width="128" height="36" rx="5" fill="#5730F5"/>
                </g></g>
            </g>
        </svg>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-[#020617]">
                <div className="w-full max-w-[600px]">
                    {stackSvg}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[60vh] flex items-center justify-center">
             <div className="w-full max-w-[400px]">
                {stackSvg}
            </div>
        </div>
    );
};

export default Loader;
