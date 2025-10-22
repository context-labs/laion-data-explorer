import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "~/ui/lib/utils";
import { Check } from "lucide-react";
import * as React from "react";

const CheckboxBase = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    className={cn(
      `
        peer h-4 w-4 shrink-0 rounded-sm border border-primary-cta
        ring-offset-background

        data-[state=checked]:bg-secondary
        data-[state=checked]:text-bg-background

        disabled:cursor-not-allowed disabled:opacity-50

        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        focus-visible:ring-offset-2
      `,
      className,
    )}
    ref={ref}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
CheckboxBase.displayName = CheckboxPrimitive.Root.displayName;

type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxBase> & {
  label?: React.ReactNode;
  labelClassName?: string;
};

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxBase>,
  CheckboxProps
>(({ className, id, label, labelClassName, ...props }, ref) => {
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <CheckboxBase id={id} ref={ref} {...props} />
      {label && (
        <label
          className={cn(
            `
              whitespace-nowrap text-sm font-medium leading-none

              peer-disabled:cursor-not-allowed peer-disabled:opacity-70
            `,
            labelClassName,
          )}
          htmlFor={id}
        >
          {label}
        </label>
      )}
    </div>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
