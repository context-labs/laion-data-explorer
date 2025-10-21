import React, { forwardRef } from "react";
import { CopyIcon } from "lucide-react";
import { useCopyToClipboard } from "usehooks-ts";

import { toast } from "~/ui/hooks/useToast.hook";
import { cn } from "~/ui/lib/utils";

type CodeProps = React.HTMLAttributes<HTMLElement> & {
  disableCopyToClipboard?: boolean;
  children: React.ReactNode;
  textToCopy?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  showCopyIcon?: boolean;
};

const ToastSnippet: React.FC<{ value: string }> = ({ value }) => (
  <code
    className={`
      inline-block max-w-[20rem] overflow-hidden text-ellipsis whitespace-nowrap
      rounded-md bg-muted px-1.5 py-1 font-mono text-xs text-detail-brand ring-1
      ring-inset ring-border/50
    `}
    title={value}
  >
    {value}
  </code>
);

export const Code = forwardRef<HTMLElement, CodeProps>(
  (
    {
      children,
      className,
      disableCopyToClipboard,
      onClick,
      showCopyIcon = false,
      textToCopy,
      ...rest
    },
    ref,
  ) => {
    const [, copyToClipboard] = useCopyToClipboard();

    const valueToCopy = disableCopyToClipboard
      ? null
      : (textToCopy ?? (typeof children === "string" ? children : null));

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      if (valueToCopy) {
        void copyToClipboard(valueToCopy);

        toast.info({
          description: (
            <div className="flex flex-wrap items-center gap-1">
              <span>Copied</span>
              <ToastSnippet value={valueToCopy} />
            </div>
          ),
          title: "Success",
        });
      }

      if (onClick) {
        onClick(e);
        return;
      }
    };

    return (
      <code
        className={cn(
          "flex w-fit items-center rounded-sm p-0 font-mono text-detail-brand",
          valueToCopy && "hover:cursor-pointer hover:text-blue-400",
          className,
        )}
        onClick={handleClick}
        ref={ref}
        {...rest}
      >
        {showCopyIcon && <CopyIcon className="mr-1 h-4 w-4" />}
        {children}
      </code>
    );
  },
);

Code.displayName = "Code";
export default Code;
