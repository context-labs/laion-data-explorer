// Stub for @kuzco/ui-client-utils
// This file contains minimal stubs to replace imports from the monorepo @kuzco/ui-client-utils package

export const LOCAL_STORAGE_KEYS = {
  THEME: "theme",
  // Add other keys as needed
};

export function createLocalStorage(): Storage {
  if (typeof window === "undefined") {
    // Return a mock storage for SSR
    const mockStorage: Record<string, string> = {};
    return {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
      },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      length: Object.keys(mockStorage).length,
    };
  }
  return window.localStorage;
}

export function isTypingInputElementFocused(): boolean {
  if (typeof document === "undefined") return false;

  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isInput = tagName === "input" || tagName === "textarea";
  const isContentEditable = activeElement.getAttribute("contenteditable") === "true";

  return isInput || isContentEditable;
}
