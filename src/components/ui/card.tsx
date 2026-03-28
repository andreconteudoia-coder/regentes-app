import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    onClick={onClick}
    {...props}
    className={cn(
      "bg-bg-card border border-white/5 rounded-2xl p-6 transition-all duration-300 shadow-sm",
      onClick && "cursor-pointer hover:border-primary/40 hover:bg-bg-card-hover hover:shadow-feminine active:scale-[0.98]",
      className
    )}
  >
    {children}
  </div>
);
