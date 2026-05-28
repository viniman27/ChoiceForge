import { describe, test, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { buildChoiceScriptDecorations } from "../../src/components/CodeEditor.tsx";

function build(doc: string) {
  const state = EditorState.create({ doc });
  // The act of building either succeeds or throws RangeSetBuilder ordering errors.
  return buildChoiceScriptDecorations(state);
}

describe("buildChoiceScriptDecorations — RangeSetBuilder ordering", () => {
  test("plain prose with no decorations", () => {
    expect(() => build("hello world\nsecond line")).not.toThrow();
  });

  test("line with ${var} only", () => {
    expect(() => build("your strength is ${strength} today")).not.toThrow();
  });

  test("line with @{var ...} only", () => {
    expect(() => build("you are @{strong burly|tall|fast} today")).not.toThrow();
  });

  test("line with @{var} BEFORE ${var} on the same line (the original crash case)", () => {
    expect(() => build("you @{flag yes|no} and have ${strength} hp")).not.toThrow();
  });

  test("line with multiple ${var} and @{var} interleaved", () => {
    expect(() => build("${a} @{b yes|no} ${c} @{d t|f} ${e}")).not.toThrow();
  });

  test("regression: long preserved-source-style line with many features mixed", () => {
    const doc = [
      "*comment scene with everything",
      "*set foo + 1",
      "*if (strength > 10)",
      "  the warrior @{gender he|she} grips ${weapon} firmly, ${count} arrows ready",
      "  *choice",
      "    #Attack with ${weapon}",
      "      *set hp - 5",
      "      *goto next",
      "    #@{flag flee|stand} instead",
      "      *goto retreat",
    ].join("\n");
    expect(() => build(doc)).not.toThrow();
  });

  test("returns a non-empty decoration set when decorations exist", () => {
    const set = build("${a} text @{b x|y}");
    expect(set.size).toBeGreaterThan(0);
  });

  test("returns an empty decoration set for prose with no special markers", () => {
    const set = build("just plain prose, no markers at all");
    expect(set.size).toBe(0);
  });

  test("does not throw on a 1000-line synthetic preserved source with mixed features", () => {
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      if (i % 5 === 0) lines.push("*set count + 1");
      else if (i % 7 === 0) lines.push("text with @{flag a|b} then ${stat} value");
      else if (i % 11 === 0) lines.push("  #Option ${x} with @{y t|f}");
      else lines.push(`plain prose line ${i}`);
    }
    expect(() => build(lines.join("\n"))).not.toThrow();
  });
});
