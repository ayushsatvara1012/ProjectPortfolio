'use client';

import { motion } from "framer-motion";
import React from 'react';

const variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

interface ScrollRevealProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    as?: keyof typeof motion;
}

export default function ScrollReveal({ children, className = "", delay = 0, as = "div" }: ScrollRevealProps) {
  const Tag = (motion as any)[as] ?? motion.div;

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        ...variants,
        visible: {
          ...variants.visible,
          transition: {
            ...variants.visible.transition,
            delay,
          },
        },
      }}
    >
      {children}
    </Tag>
  );
}
