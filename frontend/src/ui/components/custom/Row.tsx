import { cn } from "~/ui/lib/utils";
import React from "react";

type RowProps = React.HtmlHTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const Row = React.forwardRef<HTMLDivElement, RowProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <div className={cn("flex flex-row", className)} ref={ref} {...rest}>
        {children}
      </div>
    );
  },
);

Row.displayName = "Row";
