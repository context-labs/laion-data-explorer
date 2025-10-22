import { Button } from "~/ui/components/ui/Button";
import { Separator } from "~/ui/components/ui/Separator";
import { useTheme } from "~/ui/providers/ThemeProvider";
import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";

type ThemeToggleProps = {
  trigger?: React.ReactNode;
};

export function ThemeToggle({ trigger }: ThemeToggleProps) {
  const { setTheme, theme } = useTheme();

  const themeLabel = theme
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? <Button variant="outline">{themeLabel}</Button>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <Separator />
        <DropdownMenuItem onClick={() => setTheme("retro-light")}>
          Retro Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("retro-dark")}>
          Retro Dark
        </DropdownMenuItem>
        <Separator />
        <p
          className={`
            mb-1 ml-2 mt-2 hidden text-[10px] text-muted-foreground

            sm:block
          `}
        >
          Or press 't' to toggle
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
