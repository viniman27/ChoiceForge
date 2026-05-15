import { useEffect, useRef } from "react";
import { autocompletion, closeBracketsKeymap, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { choiceScriptHighlight } from "./CodeEditor";

interface NodeBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  achievements?: string[];
}

export function NodeBodyEditor({ value, onChange, variables = [], achievements = [] }: NodeBodyEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const variablesRef = useRef(variables);
  const achievementsRef = useRef(achievements);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { variablesRef.current = variables; }, [variables]);
  useEffect(() => { achievementsRef.current = achievements; }, [achievements]);

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
