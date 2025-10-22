import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "~/ui/lib/utils";
import * as React from "react";

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className,
    )}
    ref={ref}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(`
        relative h-2 w-full grow overflow-hidden rounded-full border
        bg-secondary
      `)}
    >
      <SliderPrimitive.Range className="absolute h-full bg-ring" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={props["aria-label"] ?? "Slider Thumb"}
      className={`
        block h-5 w-5 rounded-full border-2 border-ring bg-background
        ring-offset-background transition-colors

        disabled:pointer-events-none disabled:opacity-50

        focus-visible:outline-none focus-visible:ring-ring

        hover:cursor-pointer
      `}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
