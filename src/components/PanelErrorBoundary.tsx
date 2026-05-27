import { Component, type ReactNode, type ErrorInfo } from "react";

interface PanelErrorBoundaryProps {
  panelName: string;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ChoiceForge] ${this.props.panelName} panel crashed`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <aside className="panel-error" role="alert" style={errorPanelStyle}>
        <strong>{this.props.panelName} crashed</strong>
        <pre style={errorPreStyle}>{this.state.error.message}</pre>
        <button type="button" className="ghost-btn" onClick={this.reset}>Retry</button>
        <span style={hintStyle}>
          The rest of the app is still usable. If this keeps happening, your project autosave is intact in localStorage — refresh to reload it.
        </span>
      </aside>
    );
  }
}

const errorPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 16,
  background: "var(--bg-soft, #fff5f5)",
  border: "1px solid var(--c-err, #d33)",
  borderRadius: 8,
  color: "var(--ink, #333)",
  fontSize: 13,
  overflow: "auto",
};

const errorPreStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, JetBrains Mono, monospace)",
  fontSize: 11,
  background: "var(--bg, #fff)",
  padding: 8,
  borderRadius: 4,
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 200,
  overflow: "auto",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-mute, #777)",
  fontStyle: "italic",
};
