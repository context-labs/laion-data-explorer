import * as React from "react";

import { cn } from "~/ui/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string | null;
  hasError?: boolean;
  hint?: string;
  label?: string;
  icon?: React.ReactNode;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hasError, hint, icon, label, type, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="text-sm font-medium leading-none">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              {icon}
            </div>
          )}
          <input
            className={cn(
              `
                flex h-10 w-full rounded border border-input bg-background px-3
                py-2 text-sm ring-offset-background

                disabled:cursor-not-allowed disabled:opacity-50

                file:border-0 file:bg-transparent file:text-sm file:font-medium

                focus-visible:outline-none focus-visible:ring-1
                focus-visible:ring-primary-cta/60 focus-visible:ring-offset-2

                placeholder:text-muted-foreground
              `,
              (error ?? hasError) &&
                cn(`
                  border-detail-failure

                  focus-visible:ring-detail-failure
                `),
              icon && "pl-7",
              label && "mt-[4px]",
              className,
            )}
            ref={ref}
            type={type}
            {...props}
          />
        </div>
        {error && <p className="mt-2 text-sm text-detail-failure">{error}</p>}
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
