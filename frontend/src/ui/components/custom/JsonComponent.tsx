import JsonView from "@uiw/react-json-view";
import { lightTheme } from "@uiw/react-json-view/light";
import { vscodeTheme } from "@uiw/react-json-view/vscode";

import { useTheme } from "~/ui/providers/ThemeProvider";

type JsonComponentProps = {
  data: object | null | undefined;
};

export function JsonComponent({ data }: JsonComponentProps) {
  const { isDarkTheme } = useTheme();
  if (data == null) {
    return <p>No data present.</p>;
  }
  return (
    <JsonView style={isDarkTheme ? vscodeTheme : lightTheme} value={data} />
  );
}
