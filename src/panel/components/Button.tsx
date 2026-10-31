import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
};

const VARIANTS = {
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
  secondary:
    'border border-neutral-300 text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800',
} as const;

const SIZES = {
  md: 'h-9 rounded-lg px-4 text-sm',
  sm: 'h-7 rounded-md px-2.5 text-xs',
} as const;

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
