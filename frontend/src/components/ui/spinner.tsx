import React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'blue' | 'white' | 'primary';
  className?: string;
}

const sizeClasses = {
  xs: 'w-3.5 h-3.5 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
  xl: 'w-10 h-10 border-3',
};

const variantClasses = {
  blue: 'border-blue-100 border-t-[#2254E1]',
  primary: 'border-slate-200 border-t-[#2254E1]',
  white: 'border-white/30 border-t-white',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'blue',
  className,
  ...props
}) => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-full animate-spin inline-block shrink-0',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
};
