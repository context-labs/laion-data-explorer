import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "~/ui/lib/utils";
import * as React from "react";

const SeparatorBorder = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SeparatorPrimitive.Root
    className={cn("shrink-0 border-b border-muted", className)}
    ref={ref}
    {...props}
  />
));
SeparatorBorder.displayName = "SeparatorBorder";

export { SeparatorBorder };
