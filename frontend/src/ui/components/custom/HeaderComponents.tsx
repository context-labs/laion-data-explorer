import { cn } from "~/ui/lib/utils";

type HeaderComponentProps = {
  children: React.ReactNode;
  className?: string;
};

export function HeaderComponent({ children, className }: HeaderComponentProps) {
  return (
    <div
      className={cn(
        `
          fixed left-0 top-0 z-50 w-full border border-border bg-card
          backdrop-blur-sm transition-[top] duration-200 ease-in-out

          lg:left-1/2 lg:top-4 lg:w-[1024px] lg:-translate-x-1/2 lg:rounded-xl
        `,
        className,
      )}
    >
      {children}
    </div>
  );
}

type HeaderHoverLinkContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function HeaderHoverLinkContainer({
  children,
  className,
}: HeaderHoverLinkContainerProps) {
  return (
    <div
      className={cn(
        `
          invisible absolute -left-6 top-full pt-2 opacity-0 transition-all
          duration-200

          group-hover:visible group-hover:opacity-100
        `,
        className,
      )}
    >
      {children}
    </div>
  );
}
