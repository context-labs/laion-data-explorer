import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type CoreTheme = "dark" | "light";

export type Theme = CoreTheme | "system" | "retro-dark" | "retro-light";

const DEFAULT_THEME: Theme = "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  storageKey: string;
  enableMarketingBehavior?: boolean;
  storage: Storage;
};

type ThemeProviderState = {
  theme: Theme;
  isDarkTheme: boolean;
  isLightTheme: boolean;
  isRetroTheme: boolean;
  appliedTheme?: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: CoreTheme | "retro-dark" | "retro-light";
  darkOrLightTheme: CoreTheme;
};

const initialState: ThemeProviderState = {
  resolvedTheme: "dark" as const,
  setTheme: () => null,
  theme: "system" as const,
  darkOrLightTheme: "dark" as const,
  isDarkTheme: true,
  isLightTheme: false,
  isRetroTheme: false,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const getSystemTheme = (): CoreTheme => {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function ThemeProvider({
  children,
  enableMarketingBehavior = false,
  storage,
  storageKey,
  ...props
}: ThemeProviderProps) {
  const [appliedTheme, setAppliedTheme] = useState<Theme | undefined>();
  const [theme, setTheme] = useState<Theme>(
    () => (storage.getItem(storageKey) ?? DEFAULT_THEME) as Theme,
  );
  const [systemTheme, setSystemTheme] = useState<CoreTheme>(getSystemTheme);

  const updateDocumentBodyTheme = useCallback(
    (themeToApply: Theme) => {
      const root = window.document.body;
      root.classList.remove("light", "dark", "retro-light", "retro-dark");
      const resolvedTheme =
        themeToApply === "system" ? systemTheme : themeToApply;

      // Add base theme class for Tailwind utilities (dark: or light:)
      if (resolvedTheme === "retro-dark") {
        root.classList.add("dark", "retro-dark");
      } else if (resolvedTheme === "retro-light") {
        root.classList.add("light", "retro-light");
      } else {
        root.classList.add(resolvedTheme);
      }
    },
    [systemTheme],
  );

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    const resolvedTheme = theme === "system" ? systemTheme : theme;
    if (enableMarketingBehavior && resolvedTheme === "light") {
      setAppliedTheme("dark");
      updateDocumentBodyTheme("dark");
    } else if (appliedTheme !== resolvedTheme) {
      setAppliedTheme(undefined);
      updateDocumentBodyTheme(theme);
    }
  }, [
    appliedTheme,
    enableMarketingBehavior,
    theme,
    systemTheme,
    updateDocumentBodyTheme,
  ]);

  useEffect(() => {
    updateDocumentBodyTheme(theme);
  }, [theme, systemTheme, updateDocumentBodyTheme]);

  const resolvedTheme = appliedTheme
    ? appliedTheme === "system"
      ? systemTheme
      : appliedTheme
    : theme === "system"
      ? systemTheme
      : theme;

  const darkOrLightTheme =
    resolvedTheme === "retro-dark"
      ? "dark"
      : resolvedTheme === "retro-light"
        ? "light"
        : resolvedTheme;

  const state: ThemeProviderState = {
    appliedTheme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      storage.setItem(storageKey, theme);
      setTheme(theme);
    },
    theme,
    darkOrLightTheme,
    isDarkTheme: darkOrLightTheme === "dark",
    isLightTheme: darkOrLightTheme === "light",
    isRetroTheme:
      resolvedTheme === "retro-dark" || resolvedTheme === "retro-light",
  };

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) {
        if (
          event.newValue !== "dark" &&
          event.newValue !== "light" &&
          event.newValue !== "system" &&
          event.newValue !== "retro-dark" &&
          event.newValue !== "retro-light"
        ) {
          return;
        }
        setTheme(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [storageKey]);

  return (
    <ThemeProviderContext.Provider {...props} value={state}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (context == undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  const resolvedTheme = context.appliedTheme
    ? context.appliedTheme === "system"
      ? getSystemTheme()
      : context.appliedTheme
    : context.resolvedTheme;

  const darkOrLightTheme =
    resolvedTheme === "retro-dark"
      ? "dark"
      : resolvedTheme === "retro-light"
        ? "light"
        : resolvedTheme;

  return {
    ...context,
    isDarkTheme: resolvedTheme === "dark" || resolvedTheme === "retro-dark",
    isLightTheme: resolvedTheme === "light" || resolvedTheme === "retro-light",
    isRetroTheme:
      resolvedTheme === "retro-dark" || resolvedTheme === "retro-light",
    resolvedTheme,
    theme: context.theme,
    darkOrLightTheme,
  };
}
