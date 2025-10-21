import React from "react";

import { cn } from "~/ui/lib/utils";

type GridProps = React.HtmlHTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <div className={cn("grid", className)} ref={ref} {...rest}>
        {children}
      </div>
    );
  },
);

Grid.displayName = "Grid";
