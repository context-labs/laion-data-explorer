import React from "react";

import { cn } from "~/ui/lib/utils";

type ColProps = React.HtmlHTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const Col = React.forwardRef<HTMLDivElement, ColProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <div className={cn("flex flex-col", className)} ref={ref} {...rest}>
        {children}
      </div>
    );
  },
);

Col.displayName = "Col";
