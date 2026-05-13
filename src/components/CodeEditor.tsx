import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, foldGutter, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, type DecorationSet } from "@codemirror/view";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function CodeEditor({ value, onChange, onSave }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          choiceScriptHighlight,
          EditorView.lineWrapping,
          EditorState.tabSize.of(2),
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
            indentWithTab,
            ...searchKeymap,
            ...historyKeymap,
            ...defaultKeymap,
          ]),
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
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} className="generated-code-editor" />;
}

const choiceScriptHighlight = StateField.define<DecorationSet>({
  create: buildChoiceScriptDecorations,
  update(decorations, transaction) {
    if (!transaction.docChanged) return decorations.map(transaction.changes);
    return buildChoiceScriptDecorations(transaction.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildChoiceScriptDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const text = line.text;
    const command = text.match(/^(\s*)(\*[a-z_]+)/i);
    if (command?.[2]) {
      const from = line.from + command[1].length;
      builder.add(from, from + command[2].length, Decoration.mark({ class: "cm-cs-command" }));
    }
    const option = text.match(/^(\s*)(#.*)$/);
    if (option?.[2]) {
      const from = line.from + option[1].length;
      builder.add(from, line.to, Decoration.mark({ class: "cm-cs-option" }));
    }
    for (const variable of text.matchAll(/\$\{[a-zA-Z_][\w]*\}/g)) {
      builder.add(line.from + variable.index, line.from + variable.index + variable[0].length, Decoration.mark({ class: "cm-cs-variable" }));
    }
  }
  return builder.finish();
}
