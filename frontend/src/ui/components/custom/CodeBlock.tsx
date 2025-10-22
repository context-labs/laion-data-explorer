import { Row } from "~/ui/components/custom/Row";
import { Button } from "~/ui/components/ui/Button";
import { Card } from "~/ui/components/ui/Card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/ui/components/ui/Tabs";
import { Tooltip } from "~/ui/components/ui/Tooltip";
import { toast } from "~/ui/hooks/useToast.hook";
import { cn } from "~/ui/lib/utils";
import { useTheme } from "~/ui/providers/ThemeProvider";
import { Copy } from "lucide-react";
import { useCallback, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
  a11yLight,
  atomOneDark,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import type { ClassNameValue } from "tailwind-merge";
import { useCopyToClipboard } from "usehooks-ts";

type CopyCodeButtonProps = {
  onCopy: () => void;
};

function CopyCodeButton({ onCopy }: CopyCodeButtonProps) {
  return (
    <Tooltip content="Copy to clipboard">
      <Button
        aria-label="Copy code to clipboard"
        className="group bg-secondary/80"
        onClick={onCopy}
        size="icon"
        variant="ghost"
      >
        <Copy
          className={`
            size-4 text-muted-foreground

            group-hover:text-foreground
          `}
        />
      </Button>
    </Tooltip>
  );
}

export type CodeBlockTab = {
  label: string;
  code: string;
  obfuscatedCode: string;
  language?: string;
};

type SharedProps = {
  className?: ClassNameValue;
  cta?: React.ReactNode;
  copyButton?: React.ReactNode;
  customStyle?: React.CSSProperties;
  onCopy?: () => void;
};

type CodeBlockTabsProps = SharedProps & {
  language?: string;
  tabs: CodeBlockTab[];
};

type CodeBlockCodeProps = SharedProps & {
  code: string;
  obfuscatedCode: string;
  language: string;
};

type CodeBlockProps = CodeBlockTabsProps | CodeBlockCodeProps;

type CodeContentProps = {
  copyButton?: React.ReactNode;
  code: string;
  obfuscatedCode: string;
  language: string;
  handleCopy: (code: string) => void;
  customStyle?: React.CSSProperties;
};

export function CodeContent({
  code,
  copyButton,
  customStyle,
  handleCopy,
  language = "plaintext",
  obfuscatedCode,
}: CodeContentProps) {
  const { isDarkTheme } = useTheme();
  return (
    <div
      className={`
        relative h-full w-auto rounded-md p-2

        dark:bg-stone-950
      `}
    >
      {copyButton && (
        <div className="absolute right-2 top-2">
          <CopyCodeButton onCopy={() => handleCopy(code)} />
        </div>
      )}
      <SyntaxHighlighter
        codeTagProps={{ style: { fontFamily: "inherit" } }}
        customStyle={customStyle}
        id="CodeContent"
        language={language}
        style={{
          ...(isDarkTheme ? atomOneDark : a11yLight),
          hljs: {
            ...(isDarkTheme ? atomOneDark.hljs : a11yLight.hljs),
            background: "transparent",
          },
        }}
        wrapLongLines={false}
      >
        {obfuscatedCode}
      </SyntaxHighlighter>
    </div>
  );
}

export function CodeBlock({
  className,
  copyButton = <></>,
  cta,
  customStyle,
  language,
  onCopy,
  ...rest
}: CodeBlockProps) {
  const [, copyToClipboard] = useCopyToClipboard();
  const [tab, setTab] = useState<string>(
    ("tabs" in rest ? rest.tabs[0]?.label : "") ?? "",
  );

  const handleCopy = useCallback(
    (codeToClip: string) => {
      if (codeToClip) {
        void copyToClipboard(codeToClip);
        toast.success({
          description: "Code snippet has been copied to your clipboard.",
          title: "Code Copied",
        });
        onCopy?.();
      }
    },
    [copyToClipboard, onCopy],
  );

  const code = "code" in rest ? rest.code : null;
  if (code) {
    const obfuscatedCode = "obfuscatedCode" in rest ? rest.obfuscatedCode : "";
    return (
      <Card className={cn("relative flex flex-col rounded-lg", className)}>
        {code && (
          <CodeContent
            code={code}
            copyButton={copyButton}
            customStyle={customStyle}
            handleCopy={handleCopy}
            language={language ?? "plaintext"}
            obfuscatedCode={obfuscatedCode}
          />
        )}
      </Card>
    );
  }

  const tabs = "tabs" in rest ? rest.tabs : [];
  return (
    <Card
      className={cn(
        `
          relative flex flex-col

          dark:bg-stone-950
        `,
        className,
      )}
    >
      <Tabs onValueChange={setTab} value={tab}>
        <TabsList className="w-full rounded-none border-b bg-card px-2 py-[6px]">
          <Row className="w-full justify-between">
            <Row className="gap-2">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.label} value={tab.label}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </Row>
            {cta != null && cta}
          </Row>
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.label} value={tab.label}>
            <CodeContent
              code={tab.code}
              copyButton={copyButton}
              customStyle={customStyle}
              handleCopy={handleCopy}
              language={tab.language ?? "plaintext"}
              obfuscatedCode={tab.obfuscatedCode}
            />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
