import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, foldGutter, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, type DecorationSet } from "@codemirror/view";

interface CodeEditorProps {
  value: string;
  targetLine?: number | null;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function CodeEditor({ value, targetLine = null, onChange, onSave }: CodeEditorProps) {
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
          targetLineHighlight,
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

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !targetLine) return;
    const lineNumber = Math.min(Math.max(1, targetLine), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: { anchor: line.from },
      effects: [
        EditorView.scrollIntoView(line.from, { y: "center" }),
        setTargetLineEffect.of(lineNumber),
      ],
    });
    view.focus();
  }, [targetLine]);

  return <div ref={hostRef} className="generated-code-editor" />;
}

export const choiceScriptHighlight = StateField.define<DecorationSet>({
  create: buildChoiceScriptDecorations,
  update(decorations, transaction) {
    if (!transaction.docChanged) return decorations.map(transaction.changes);
    return buildChoiceScriptDecorations(transaction.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const setTargetLineEffect = StateEffect.define<number | null>();

const targetLineHighlight = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTargetLineEffect)) {
        if (!effect.value) return Decoration.none;
        const line = transaction.state.doc.line(Math.min(Math.max(1, effect.value), transaction.state.doc.lines));
        return Decoration.set([Decoration.line({ class: "cm-cs-target-line" }).range(line.from)]);
      }
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function buildChoiceScriptDecorations(state: EditorState): DecorationSet {
  type Range = { from: number; to: number; decoration: Decoration };
  const ranges: Range[] = [];
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const text = line.text;
    const command = text.match(/^(\s*)(\*[a-z_]+)/i);
    if (command?.[2]) {
      const from = line.from + command[1].length;
      ranges.push({ from, to: from + command[2].length, decoration: Decoration.mark({ class: "cm-cs-command" }) });
    }
    const option = text.match(/^(\s*)(#.*)$/);
    if (option?.[2]) {
      const from = line.from + option[1].length;
      ranges.push({ from, to: line.to, decoration: Decoration.mark({ class: "cm-cs-option" }) });
    }
    for (const variable of text.matchAll(/\$\{[a-zA-Z_][\w]*\}/g)) {
      const from = line.from + (variable.index ?? 0);
      ranges.push({ from, to: from + variable[0].length, decoration: Decoration.mark({ class: "cm-cs-variable" }) });
    }
    for (const multi of text.matchAll(/@\{[^}]+\}/g)) {
      const from = line.from + (multi.index ?? 0);
      ranges.push({ from, to: from + multi[0].length, decoration: Decoration.mark({ class: "cm-cs-multi" }) });
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  let lastFrom = -1;
  let lastTo = -1;
  for (const range of ranges) {
    if (range.from < lastTo) continue;
    if (range.from === lastFrom && range.to === lastTo) continue;
    builder.add(range.from, range.to, range.decoration);
    lastFrom = range.from;
    lastTo = range.to;
  }
  return builder.finish();
}
