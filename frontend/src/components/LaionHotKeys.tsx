import { useCallback, useEffect } from "react";

import { isTypingInputElementFocused } from "~/lib/ui-client-utils";
import { useTheme } from "~/ui";

const HOT_KEY_MAP = {
  TOGGLE_THEME: "t",
};

type HotKey = keyof typeof HOT_KEY_MAP;

export function LaionHotKeys() {
  const { setTheme, theme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingInputElementFocused()) {
        return;
      }

      const matchedKey = Object.entries(HOT_KEY_MAP).find(
        ([_, value]) => value === event.key,
      );
      if (matchedKey == null) {
        return;
      }

      const metaKeysPressed = event.metaKey || event.ctrlKey;
      if (metaKeysPressed) {
        return;
      }

      // This prevents the closest active element from being focused.
      event.preventDefault();
      document.body.focus();

      const hotKey = matchedKey[0] as HotKey;
      switch (hotKey) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        case "TOGGLE_THEME": {
          toggleTheme();
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return function cleanup() {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleTheme]);

  return null;
}
