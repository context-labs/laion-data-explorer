import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "~/ui/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    className={cn(
      `
        fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4

        md:w-fit md:min-w-[420px]

        sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col
      `,
      className,
    )}
    ref={ref}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  `
    group pointer-events-auto relative flex w-full items-center justify-between
    space-x-4 overflow-hidden rounded border p-6 pr-8 shadow-lg transition-all

    data-[state=closed]:animate-out data-[state=closed]:fade-out-80
    data-[state=closed]:slide-out-to-right-full

    data-[state=open]:animate-in data-[state=open]:slide-in-from-top-full
    data-[state=open]:sm:slide-in-from-bottom-full

    data-[swipe=cancel]:translate-x-0

    data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
    data-[swipe=end]:animate-out

    data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
    data-[swipe=move]:transition-none
  `,
  {
    defaultVariants: {
      variant: "info",
    },
    variants: {
      variant: {
        destructive: "group border-destructive bg-red-400 text-gray-950",
        info: "border bg-background text-foreground",
        success: "border bg-green-400 text-gray-950",
        warning: "border bg-yellow-200 text-gray-950",
      },
    },
  },
);

type ToastVariantProp = VariantProps<typeof toastVariants>["variant"];

const Toast = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      className={cn(toastVariants({ variant }), className)}
      ref={ref}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    className={cn(
      `
        inline-flex h-8 shrink-0 items-center justify-center rounded-md border
        bg-transparent px-3 text-sm font-medium ring-offset-background
        transition-colors

        disabled:pointer-events-none disabled:opacity-50

        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2

        group-[.destructive]:border-muted/40
        group-[.destructive]:hover:border-destructive/30
        group-[.destructive]:hover:bg-destructive
        group-[.destructive]:hover:text-destructive-foreground
        group-[.destructive]:focus:ring-destructive
      `,
      className,
    )}
    ref={ref}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> & {
    variant: ToastVariantProp;
  }
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Close
    className={cn(
      `
        absolute right-2 top-2 rounded-md p-1 text-gray-950 transition-opacity

        focus:opacity-100 focus:outline-none focus:ring-2

        group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50
        group-[.destructive]:focus:ring-red-400
        group-[.destructive]:focus:ring-offset-red-600

        group-[.info]:text-blue-300 group-[.info]:hover:text-blue-50

        group-hover:opacity-100

        hover:text-gray-800
      `,
      className,
      variant === "info" &&
        cn(`
          text-muted-foreground

          hover:text-foreground
        `),
    )}
    ref={ref}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    className={cn("text-sm font-semibold", className)}
    ref={ref}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    className={cn("text-sm opacity-90", className)}
    ref={ref}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
