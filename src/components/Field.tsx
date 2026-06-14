import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface FieldWrapProps {
  label?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldWrap({ label, hint, children }: FieldWrapProps) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-meta font-medium text-ink-soft">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-ink-faint">{hint}</span>}
    </label>
  );
}

const baseInput =
  'w-full rounded-input border border-border bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-clay focus:ring-2 focus:ring-clay/20';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, leftIcon, className, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} hint={hint}>
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            {leftIcon}
          </span>
        )}
        <input ref={ref} className={cn(baseInput, !!leftIcon && 'pl-11', className)} {...rest} />
      </div>
    </FieldWrap>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function Textarea({ label, hint, className, ...rest }: TextareaProps) {
  return (
    <FieldWrap label={label} hint={hint}>
      <textarea className={cn(baseInput, 'min-h-[110px] resize-none', className)} {...rest} />
    </FieldWrap>
  );
}
