declare module "react-plotly.js" {
  import { Component } from "react";
  import type { PlotParams } from "plotly.js";

  export interface PlotProps extends Partial<PlotParams> {
    data: unknown[];
    layout?: unknown;
    config?: unknown;
    frames?: unknown[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    onInitialized?: (figure: unknown, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: unknown, graphDiv: HTMLElement) => void;
    onPurge?: (figure: unknown, graphDiv: HTMLElement) => void;
    onClick?: (event: unknown) => void;
    onHover?: (event: unknown) => void;
    onUnhover?: (event: unknown) => void;
    onSelected?: (event: unknown) => void;
    onRelayout?: (event: unknown) => void;
    onClickAnnotation?: (event: unknown) => void;
  }

  export default class Plot extends Component<PlotProps> {}
}
