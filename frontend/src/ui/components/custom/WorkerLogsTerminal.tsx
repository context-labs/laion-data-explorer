import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import type { LogMessage } from "~/lib/models";
import { LogLevel } from "~/lib/models";

import { Col } from "~/ui/components/custom/Col";
import { Button } from "~/ui/components/ui/Button";

type WorkerLogsTerminalProps = {
  logs: LogMessage[];
};

const logLevelToReadable = (level: LogLevel) => {
  switch (level) {
    case LogLevel.Debug:
      return "DEBUG";
    case LogLevel.Info:
      return "INFO";
    case LogLevel.Warn:
      return "WARN";
    case LogLevel.Error:
      return "ERROR";
    case LogLevel.Fatal:
      return "FATAL";
  }
};

const logLevelToColor = (level: LogLevel) => {
  switch (level) {
    case LogLevel.Debug:
      return "text-gray-500";
    case LogLevel.Info:
      return "text-blue-500";
    case LogLevel.Warn:
      return "text-yellow-500";
    case LogLevel.Error:
      return "text-red-500";
    case LogLevel.Fatal:
      return "text-red-700";
  }
};

// Simple hash function similar to winstonLogger.ts
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// Color palette using only confirmed available Tailwind colors
const HEADER_COLORS = [
  "text-green-600",
  "text-yellow-600",
  "text-purple-400",
  "text-blue-500",
  "text-green-400",
  "text-yellow-400",
  "text-teal-400",
  "text-yellow-300",
  "text-green-600",
];

// Get color for a header part based on hash
function getHeaderColor(part: string): string {
  const hash = simpleHash(part);
  const colorIndex = Math.abs(hash) % HEADER_COLORS.length;
  return HEADER_COLORS[colorIndex] ?? "text-white";
}

// Colorize header similar to buildColorizedHeader in winstonLogger.ts
function renderColorizedHeader(header: string) {
  // Remove brackets and colon from header to get the clean content
  const cleanHeader = header.replace(/^\[|\]:?$/g, "").trim();

  // If no actual content, don't render any brackets
  if (!cleanHeader) {
    return null;
  }

  // Split by pipe and colorize each part
  const nameParts = cleanHeader.split("|");

  return (
    <>
      <span className="text-white">[</span>
      {nameParts.map((part, index) => (
        <span key={index}>
          <span className={getHeaderColor(part.trim())}>{part.trim()}</span>
          {index < nameParts.length - 1 && (
            <span className="text-gray-400">|</span>
          )}
        </span>
      ))}
      <span className="text-white">]:</span>
    </>
  );
}

export function WorkerLogsTerminal({ logs }: WorkerLogsTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (containerRef.current && autoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { clientHeight, scrollHeight, scrollTop } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;

    setAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    setAutoScroll(true);
    setShowScrollButton(false);
  };

  if (logs.length === 0) {
    return (
      <span className="font-jet-brains text-sm text-green-600">
        Starting...
      </span>
    );
  }

  return (
    <div className="relative h-full">
      <Col
        className="h-full overflow-y-auto"
        onScroll={handleScroll}
        ref={containerRef}
      >
        {logs.map((log, i) => {
          const headerElement = renderColorizedHeader(log.header);

          return (
            <span className="font-jet-brains text-sm" key={i}>
              {headerElement}
              {headerElement && <>&nbsp;</>}
              <span className="text-gray-500">{log.timestamp}</span>
              &nbsp;
              <span className={logLevelToColor(log.level)}>
                {logLevelToReadable(log.level)}
              </span>
              &nbsp;
              <span className="text-muted-foreground">{log.message}</span>
            </span>
          );
        })}
      </Col>
      {showScrollButton && (
        <Button
          className={`
            absolute bottom-4 right-4 opacity-80

            hover:opacity-100
          `}
          onClick={scrollToBottom}
          size="sm"
          variant="secondary"
        >
          <ArrowDown className="mr-1 h-4 w-4" />
          Scroll to Bottom
        </Button>
      )}
    </div>
  );
}
