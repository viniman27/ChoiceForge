import { useEffect, useRef } from "react";
import { autocompletion, closeBracketsKeymap, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, drawSelection, keymap, type DecorationSet } from "@codemirror/view";
import { choiceScriptHighlight } from "./CodeEditor";

interface NodeBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  achievements?: string[];
  /** Map of variable name → initial value text. Drives the inline preview chip next to ${var} / @{var ...}. */
  variableInitials?: Record<string, string>;
}

class InitialValueWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-var-initial";
    span.textContent = `:${this.text}`;
    span.setAttribute("aria-hidden", "true");
    return span;
  }
  eq(other: InitialValueWidget) { return other.text === this.text; }
  ignoreEvent() { return true; }
}

function buildInitialDecorations(docText: string, initials: Map<string, string>): DecorationSet {
  if (initials.size === 0) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  // ${name} or @{name ...} — append a widget right after the closing brace,
  // but only when `name` appears in the project's declared variables.
  const re = /[\$@]\{([a-zA-Z_][\w]*)([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(docText)) !== null) {
    const name = match[1];
    const initial = initials.get(name);
    if (initial === undefined) continue;
    const endPos = match.index + match[0].length;
    builder.add(endPos, endPos, Decoration.widget({
      widget: new InitialValueWidget(initial),
      side: 1,
    }));
  }
  return builder.finish();
}

// StateEffect carrying the new initials map. Parent dispatches it whenever
// the variableInitials prop changes; the StateField recomputes decorations.
const setInitialsEffect = StateEffect.define<Map<string, string>>();

function initialValueExtension(seedInitials: Map<string, string>) {
  return StateField.define<{ initials: Map<string, string>; decorations: DecorationSet }>({
    create(state) {
      return {
        initials: seedInitials,
        decorations: buildInitialDecorations(state.doc.toString(), seedInitials),
      };
    },
    update(value, tr) {
      let nextInitials = value.initials;
      for (const eff of tr.effects) {
        if (eff.is(setInitialsEffect)) nextInitials = eff.value;
      }
      if (!tr.docChanged && nextInitials === value.initials) return value;
      return {
        initials: nextInitials,
        decorations: buildInitialDecorations(tr.state.doc.toString(), nextInitials),
      };
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
  });
}

export function NodeBodyEditor({ value, onChange, variables = [], achievements = [], variableInitials }: NodeBodyEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const variablesRef = useRef(variables);
  const achievementsRef = useRef(achievements);
  const initialsRef = useRef<Map<string, string>>(new Map(Object.entries(variableInitials ?? {})));

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { variablesRef.current = variables; }, [variables]);
  useEffect(() => { achievementsRef.current = achievements; }, [achievements]);
  useEffect(() => {
    const next = new Map(Object.entries(variableInitials ?? {}));
    initialsRef.current = next;
    viewRef.current?.dispatch({ effects: setInitialsEffect.of(next) });
  }, [variableInitials]);

  useEffect(() => {
    if (!hostRef.current) return;

    const completionSource = (context: CompletionContext) => {
      // Variable reference: ${ or @{
      const exprMatch = context.matchBefore(/[\$@]\{[a-z0-9_]*/i);
      if (exprMatch) {
        const from = exprMatch.from + 2;
        return {
          from,
          options: variablesRef.current.map((v) => ({ label: v, type: "variable" })),
          filter: true,
        };
      }
      // *achieve command
      const achieveMatch = context.matchBefore(/\*achieve\s+[a-z0-9_]*/i);
      if (achieveMatch) {
        const from = achieveMatch.from + achieveMatch.text.indexOf(" ") + 1;
        return {
          from,
          options: achievementsRef.current.map((a) => ({ label: a, type: "keyword" })),
          filter: true,
        };
      }
      return null;
    };

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          choiceScriptHighlight,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ spellcheck: "true" }),
          autocompletion({ override: [completionSource], icons: false }),
          initialValueExtension(initialsRef.current),
          keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} className="node-body-editor" />;
}
