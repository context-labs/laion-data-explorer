import { Col } from "~/ui/components/custom/Col";
import { cn } from "~/ui/lib/utils";
import React from "react";

type ResponsiveRowProps = React.HtmlHTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const ResponsiveRow = React.forwardRef<
  HTMLDivElement,
  ResponsiveRowProps
>(({ children, className, ...rest }, ref) => {
  return (
    <Col
      className={cn(
        `
          flex items-start

          md:flex-row md:items-center
        `,
        className,
      )}
      ref={ref}
      {...rest}
    >
      {children}
    </Col>
  );
});
