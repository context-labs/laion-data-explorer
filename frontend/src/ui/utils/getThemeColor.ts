import type { ThemeColorName } from "../constants/ColorSystem";
import { ColorSystem } from "../constants/ColorSystem";

export function getThemeColor(
  resolvedTheme: "dark" | "light",
  themeColorName: ThemeColorName,
) {
  return ColorSystem.TailwindThemeColors[resolvedTheme][themeColorName];
}
