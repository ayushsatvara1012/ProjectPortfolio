import React from 'react';
import {
  Github,
  ArrowRight,
  Globe,
  Cpu,
  Boxes,
  Zap,
  BarChart3,
  Activity,
  Layers
} from 'lucide-react';

// Tech Icons
import JavascriptIcon from '../assets/icons/javascript.svg';
import ReactIcon from '../assets/icons/react.svg';
import MongoDBIcon from '../assets/icons/mongo.svg';
import NodeIcon from '../assets/icons/node.svg';
import HTMLIcon from '../assets/icons/html.svg';
import CSSIcon from '../assets/icons/css.svg';
import PythonIcon from '../assets/icons/python.svg';
import TailwindIcon from '../assets/icons/tailwind.svg';
import PostgreIcon from '../assets/icons/postgre.svg';
import AWSIcon from '../assets/icons/aws.svg';
import DockerIcon from '../assets/icons/docker.svg';
import SupabaseIcon from '../assets/icons/supabase-icon.svg';

/**
 * PROJECT DATA OBJECT
 * Centralized repository for selected deployments.
 */
const projects = [
  {
    id: "01",
    title: "LuminaLib",
    subtitle: "Distributed Book Intelligence Engine",
    description: "LuminaLib is an AI-driven digital library platform that uses FastAPI and PostgreSQL with pgvector to manage a dataset of over 271k book records. It features a Semantic Search engine that utilizes 384-dimensional vector embeddings to allow users to discover books based on themes and context rather than just traditional keywords.",
    tech: ["REACT_UI", "FAST_API", "PG_SQL", "PGVECTOR","VectorEmbeddings","SemanticSearch"],
    github: "https://github.com/ayushsatvara1012/book_store_ui.git",
    launch: "#",
    status: "Active Development",
    accent: "indigo",
    icon: <Globe size={24} />
  },
  {
    id: "02",
    title: "V-Comm",
    subtitle: "Full stack finance management system",
    description: "The V-Comm Platform is a specialized digital hub designed to connect community members and manage village-related activities through a modern web dashboard. Built with React and FastAPI, it allows users to browse a member directory, manage donations, stay updated on community events, and preserve their shared cultural heritage.",
    tech: ["REACT_UI", "JWT/OAUTH 2.0", "PG_SQL", "SUPABASE", "TAILWIND_V4"],
    github: "https://github.com/ayushsatvara1012/village-community-platform.git",
    launch: "https://village-community-platform.vercel.app/",
    status: "Deployed: Vercel",
    accent: "orange",
    icon: <Globe size={24} />
  },
  {
    id: "03",
    title: "SaPyBase",
    subtitle: "Agency Core Infrastructure",
    description: "Our internal startup identity.This Duo-Portfolio is an ultra-modern, Bento-grid architecture engineered to showcase two distinct technical profiles within a unified digital ecosystem. It leverages React 19 and Tailwind CSS v4 to deliver a high-performance, mobile-responsive interface that bridges the gap between systems architecture and creative full-stack engineering.",
    tech: ["VITE_JS", "TAILWIND_V4","REACT_19"],
    github: "https://github.com/ayushsatvara1012/ProjectPortfolio.git",
    launch: "#",
    status: "Deployed: Vercel",
    accent: "blue",
    icon: <Cpu size={24} />
  },
  {
    id: "04",
    title: "Coming Soon",
    subtitle: "Under Development",
    description: "We are currently architecting a next-generation solution focused on optimizing complex digital workflows. This project is in active development, undergoing rigorous refinement to ensure it delivers a high-performance and scalable experience upon release.",
    tech: ["VITE_JS", "TAILWIND_V4", "AWS_S3"],
    github: "#",
    launch: "#",
    status: "Under Development",
    accent: "gray",
    icon: (
      <>
        <img src="/sb_logo2.svg" className="w-6 h-6 block dark:hidden object-contain" alt="" />
        <img src="/sb_logo2_dark.svg" className="w-6 h-6 hidden dark:block object-contain" alt="" />
      </>
    )
  }
];

const accentStyles = {
  indigo: {
    glow: "from-indigo-500 to-violet-500",
    iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
    iconText: "text-indigo-600",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/20",
    badgeDot: "bg-indigo-500",
    badgeText: "text-indigo-600",
    subtitle: "text-indigo-600",
    dot: "bg-indigo-500",
    action: "text-indigo-600"
  },
  orange: {
    glow: "from-orange-500 to-amber-500",
    iconBg: "bg-orange-50 dark:bg-orange-900/20",
    iconText: "text-orange-600",
    badgeBg: "bg-orange-500/10",
    badgeBorder: "border-orange-500/20",
    badgeDot: "bg-orange-500",
    badgeText: "text-orange-600",
    subtitle: "text-orange-600",
    dot: "bg-orange-500",
    action: "text-orange-600"
  },
  blue: {
    glow: "from-blue-500 to-cyan-500",
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    iconText: "text-blue-600",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/20",
    badgeDot: "bg-blue-500",
    badgeText: "text-blue-600",
    subtitle: "text-blue-600",
    dot: "bg-blue-500",
    action: "text-blue-600"
  },
  gray: {
    glow: "from-gray-500 to-gray-500",
    iconBg: "bg-gray-50 dark:bg-gray-900/20",
    iconText: "text-gray-600",
    badgeBg: "bg-gray-500/10",
    badgeBorder: "border-gray-500/20",
    badgeDot: "bg-gray-500",
    badgeText: "text-gray-600",
    subtitle: "text-gray-600",
    dot: "bg-gray-500",
    action: "text-gray-600"
  }
};

const ProjectCard = ({ project, index }) => {
  const isEven = index % 2 === 0;
  const styles = accentStyles[project.accent] || accentStyles.indigo;

  return (
    <div
      className={`relative group ${!isEven ? 'md:mt-8' : ''} transition-all duration-500`}
    >
      {/* Dynamic Hover Glow */}
      <div className={`absolute -inset-2 bg-linear-to-r ${styles.glow} rounded-[2.5rem] opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl`}></div>

      <div className="relative rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-500">
        {/* Card Header / Status */}
        <div className="px-6 pt-6 pb-2 flex justify-between items-start">
          <div className={`p-4 rounded-2xl ${styles.iconBg} ${styles.iconText} transition-transform group-hover:scale-110 duration-500`}>
            {project.icon}
          </div>
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${styles.badgeBg} border ${styles.badgeBorder}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${styles.badgeDot} animate-pulse`}></span>
              <span className={`text-[10px] font-bold ${styles.badgeText} uppercase tracking-[0.15em]`}>
                {project.status}
              </span>
            </div>
            <span className="mt-2 font-mono text-[10px] text-slate-400">NODE_REF: {project.id}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 md:p-8 pt-4">
          <h4 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 leading-none tracking-tighter transition-all group-hover:translate-x-1">
            {project.title}
          </h4>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${styles.subtitle} mb-4 font-mono`}>
            {project.subtitle}
          </p>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed text-sm font-light">
            {project.description}
          </p>

          {/* Tech Matrix */}
          <div className="flex flex-wrap gap-3 md:gap-4 mb-8">
            {project.tech.map((t, i) => (
              <span key={i} className="flex items-center gap-2 font-mono text-[9px] text-slate-400">
                <div className={`w-1 h-1 ${styles.dot} rounded-full`}></div>
                {t}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-6 md:gap-8 pt-8 border-t border-slate-100 dark:border-slate-800">
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Github size={16} /> <span className="tracking-widest uppercase">Source Code</span>
            </a>
            <a
              href={project.launch}
              className={`flex items-center gap-2 text-xs font-black ${styles.action} hover:gap-4 transition-all tracking-widest uppercase`}
            >
              Launch Deployment <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectSection = () => {
  const techIcons = [
    { src: PythonIcon, name: "Python" },
    { src: JavascriptIcon, name: "JavaScript" },
    { src: ReactIcon, name: "React" },
    { src: HTMLIcon, name: "HTML5" },
    { src: CSSIcon, name: "CSS3" },
    { src: NodeIcon, name: "Node.js" },
    { src: TailwindIcon, name: "Tailwind CSS" },
    { src: MongoDBIcon, name: "MongoDB" },
    { src: AWSIcon, name: "AWS" },
    { src: PostgreIcon, name: "PostgreSQL" },
    { src: DockerIcon, name: "Docker" },
    { src: SupabaseIcon, name: "Supabase" }
  ];

  return (
    <section className="relative py-12 bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Architectural Grid Underlay */}
      <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* 1. SECTION HEADER */}
        <div className="grid lg:grid-cols-12 gap-8 md:gap-12 items-end mb-12">
          <div className="lg:col-span-12 space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-linear-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20">
              <Boxes size={14} className="text-indigo-600" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Enterprise Protocols</span>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
              PRODUCTION <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-violet-500 italic font-light">Ecosystems.</span>
            </h2>
          </div>
        </div>

        {/* 2. TECH STACK DASHBOARD (Glassmorphic Redesign - Darkened) */}
        <div className="mb-12">
          <div className="relative backdrop-blur-xl bg-white dark:bg-slate-950/60 p-12 md:p-2 rounded-[3rem] md:rounded-[4rem] border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-indigo-500/5 overflow-hidden flex flex-col items-center justify-center min-h-[350px] md:min-h-[350px] transition-all duration-700 hover:backdrop-blur-2xl">

            {/* Background Layer: Balanced, Vibrant Tech Distribution (No Grayscale) */}
            <div className="absolute inset-0 z-0 opacity-[0.15] dark:opacity-[0.25] grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-8 md:gap-16 p-10 pointer-events-none items-center justify-items-center">
              {techIcons.map((tech, idx) => (
                <div key={idx} className="aspect-square flex items-center justify-center">
                  <img src={tech.src} alt={`${tech.name} icon`} className="w-12 h-12 md:w-24 md:h-24 object-contain" />
                </div>
              ))}
            </div>

            {/* Foreground Layer: Content Centerpiece */}
            <div className="relative z-10 text-center space-y-6 max-w-2xl h-full">
              <div className="space-y-3">
                <h3 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
                  Stack_Registry
                </h3>
                <div className="h-1 w-12 bg-indigo-600 mx-auto rounded-full"></div>
              </div>

              <p className="text-sm md:text-lg text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                Utilizing a high-concurrency architecture to bridge the gap between complex business logic and high-performance digital interfaces across <span className="text-indigo-600 dark:text-indigo-400 font-medium">Python, React, & Cloud Systems.</span>
              </p>

              {/* Functional Verification Tag */}
              <div className="flex items-center justify-center gap-4 pt-6">
                <div className="h-px w-6 md:w-12 bg-slate-200 dark:bg-slate-800"></div>
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-indigo-600" />
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-[0.3em]">Status: Integrated</span>
                </div>
                <div className="h-px w-6 md:w-12 bg-slate-200 dark:bg-slate-800"></div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. FEATURED PROJECTS GRID */}
        <div id="projects" className="space-y-8 md:space-y-12">
          <div className="flex items-center justify-between pb-6 md:pb-8 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-8 md:w-12 h-px bg-indigo-600"></div>
              <h3 className="text-xs md:text-sm font-mono font-bold tracking-[0.2em] md:tracking-[0.3em] text-slate-400 uppercase">Selected_Deployments</h3>
            </div>
            <span className="hidden md:block font-mono text-[10px] text-slate-400 opacity-50 tracking-widest">STABLE_RELEASE_V4.2</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-8 lg:gap-12">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        </div>

        {/* 4. PERFORMANCE PROTOCOL CTA */}
        <div className="mt-20 md:mt-32 p-px rounded-3xl md:rounded-[3rem] bg-linear-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent">
          <div className="bg-white dark:bg-slate-950 rounded-[1.9rem] md:rounded-[2.9rem] p-8 md:p-12 text-center">
            <div className="flex flex-wrap justify-center gap-6 md:gap-12">
              {[
                { label: "LATENCY", value: "<100ms", icon: <Zap size={16} /> },
                { label: "UPTIME", value: "99.98%", icon: <Activity size={16} /> },
                { label: "LOAD_BAL", value: "OPTIMIZED", icon: <Layers size={16} /> },
                { label: "SEO", value: "100% Optimized", icon: <Layers size={16} /> },
                { label: "AEO / GEO", value: "Top 10", icon: <Layers size={16} /> },
                { label: "Token_Efficiency", value: "<5000 tokens", icon: <Layers size={16} /> },
              ].map((m, i) => (
                <div key={i} className="flex flex-col items-center min-w-[80px]">
                  <div className="text-indigo-600 mb-2">{m.icon}</div>
                  <span className="text-[9px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">{m.label}</span>
                  <span className="text-xs md:text-sm font-black dark:text-white uppercase tracking-tighter">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default ProjectSection;