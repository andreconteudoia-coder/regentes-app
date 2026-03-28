import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps {
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; 
  size?: 'sm' | 'md' | 'lg';
  className?: string; 
  onClick?: () => void;
  icon?: any;
  disabled?: boolean;
  loading?: boolean;
}

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className, 
  onClick, 
  icon: Icon,
  disabled,
  loading
}: ButtonProps) => {
  const variants = {
    primary: "bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20",
    secondary: "bg-[#2C2E33] hover:bg-[#383A40] text-white border border-[#383A40]",
    ghost: "bg-transparent hover:bg-[#2C2E33] text-[#C1C2C5]",
    danger: "bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
