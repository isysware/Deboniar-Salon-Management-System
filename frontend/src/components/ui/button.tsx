import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2254E1] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none font-sans',
  {
    variants: {
      variant: {
        default: 'bg-[#2254E1] text-white shadow-xs hover:bg-[#1B3FC5] active:bg-[#1534a6]',
        primary: 'bg-[#2254E1] text-white shadow-xs hover:bg-[#1B3FC5] active:bg-[#1534a6]',
        destructive: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800',
        danger: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800',
        outline: 'border border-slate-200 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 hover:text-slate-900',
        secondary: 'bg-slate-100 text-slate-900 shadow-2xs hover:bg-slate-200',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        link: 'text-[#2254E1] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        md: 'h-10 px-4 py-2 text-sm',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin inline-block shrink-0" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
