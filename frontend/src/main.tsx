import React from "react";
import { createStore } from "jotai";
import { Provider as JotaiProvider } from "jotai/react";
import ReactDOM from "react-dom/client";

import { createLocalStorage, LOCAL_STORAGE_KEYS } from "~/lib/ui-client-utils";
import { ThemeProvider } from "~/ui";

import { LaionHotKeys } from "./components/LaionHotKeys";
import LaionApp from "./LaionApp";

import "./index.css";

const jotaiStore = createStore();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <JotaiProvider store={jotaiStore}>
      <ThemeProvider
        storage={createLocalStorage()}
        storageKey={LOCAL_STORAGE_KEYS.THEME}
      >
        <LaionHotKeys />
        <LaionApp />
      </ThemeProvider>
    </JotaiProvider>
  </React.StrictMode>
);
