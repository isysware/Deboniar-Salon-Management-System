import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      helperText,
      leftElement,
      rightElement,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || (label ? `input-${generatedId}` : undefined);

    const inputNode = (
      <div className="relative w-full">
        {leftElement && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {leftElement}
          </div>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B1020] placeholder:text-slate-400 font-sans transition-colors duration-150',
            'focus-visible:outline-none focus-visible:border-[#2254E1] focus-visible:ring-2 focus-visible:ring-[#2254E1]/20',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
            leftElement && 'pl-10',
            rightElement && 'pr-10',
            error && 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/20',
            className
          )}
          ref={ref}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    );

    if (!label && !error && !helperText) {
      return inputNode;
    }

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-700">
            {label}
          </label>
        )}
        {inputNode}
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
