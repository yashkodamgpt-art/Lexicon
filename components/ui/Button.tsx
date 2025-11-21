import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed select-none";
  
  const variants = {
    primary: "bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-lg shadow-blue-900/20 border border-blue-500/50",
    secondary: "glass hover:bg-white/10 text-zinc-100 border border-white/10",
    ghost: "bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white",
    icon: "p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white aspect-square",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  const finalSize = variant === 'icon' ? '' : sizes[size];

  return (
    <motion.button 
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      className={`${baseStyles} ${variants[variant]} ${finalSize} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
};