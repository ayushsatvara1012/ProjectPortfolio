import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    children?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ className = "", children, ...props }) => {
    return (
        <button
            {...props}
            className={`relative flex items-center px-6 py-3 overflow-hidden font-medium transition-all bg-blue-950 group dark:bg-blue-600 dark:hover:bg-blue-700 text-white ${className}`}
        >
            <span
                className="absolute top-0 right-0 inline-block w-4 h-4 transition-all duration-500 ease-in-out bg-blue-900 group-hover:-mr-4 group-hover:-mt-4"
            >
                <span
                    className="absolute top-0 right-0 w-5 h-5 rotate-45 translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-950"
                ></span>
            </span>
            <span
                className="absolute bottom-0 rotate-180 left-0 inline-block w-4 h-4 transition-all duration-500 ease-in-out bg-blue-900 group-hover:-ml-4 group-hover:-mb-4"
            >
                <span
                    className="absolute top-0 right-0 w-5 h-5 rotate-45 translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-950"
                ></span>
            </span>
            <span
                className="relative w-full flex items-center justify-center gap-2 transition-colors duration-200 ease-in-out"
            >
                {children || "Button"}
            </span>
        </button>
    );
};

export default Button;
