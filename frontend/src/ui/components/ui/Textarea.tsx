import * as React from "react";

import { cn } from "~/ui/lib/utils";

export type TextareaProps = React.ComponentProps<"textarea"> & {
  error?: string | null;
  hasError?: boolean;
  hint?: string;
  label?: string;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, hasError, hint, label, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="text-sm font-medium leading-none">{label}</label>
        )}
        <textarea
          className={cn(
            `
              flex min-h-[80px] w-full rounded-md border border-input
              bg-background px-3 py-2 text-base ring-offset-background

              disabled:cursor-not-allowed disabled:opacity-50

              focus-visible:outline-none focus-visible:ring-1
              focus-visible:ring-primary-cta/60 focus-visible:ring-offset-2

              md:text-sm

              placeholder:text-muted-foreground
            `,
            (error ?? hasError) &&
              cn(`
                border-detail-failure

                focus-visible:ring-detail-failure
              `),
            label && "mt-[4px]",
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-2 text-sm text-detail-failure">{error}</p>}
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
