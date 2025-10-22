import { Col } from "~/ui/components/custom/Col";
import { cn } from "~/ui/lib/utils";
import type React from "react";

type TooltipContentComponentProps = {
  content: React.ReactNode | string[];
  title: React.ReactNode;
  className?: string;
};

export function TooltipContentComponent({
  className,
  content,
  title,
}: TooltipContentComponentProps) {
  return (
    <Col className={cn("w-[400px] gap-2 pb-1", className)}>
      <p className="font-semibold">{title}</p>
      {Array.isArray(content) ? (
        content.map((item, index) => (
          <p className="text-sm text-muted-foreground" key={index}>
            {item}
          </p>
        ))
      ) : typeof content === "string" ? (
        <p className="text-sm text-muted-foreground">{content}</p>
      ) : (
        content
      )}
    </Col>
  );
}
