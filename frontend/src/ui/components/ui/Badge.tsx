import { cn } from "~/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
  `
    inline-flex items-center rounded-full border px-3 py-1.5 text-xs
    font-semibold transition-colors

    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
  `,
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: `
          border-transparent bg-primary text-primary-foreground

          hover:bg-primary/80
        `,
        destructive: `
          border-transparent bg-destructive text-destructive-foreground

          hover:bg-destructive/80
        `,
        failure: `
          border-transparent bg-detail-failure text-detail-failure-foreground

          hover:bg-detail-failure/80
        `,
        outline: "text-foreground",
        secondary: `
          border-transparent bg-secondary text-secondary-foreground

          hover:bg-secondary/80
        `,
        success: "border bg-background font-medium text-green-500",
      },
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
