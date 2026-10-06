import test from "node:test";
import assert from "node:assert/strict";
import { layoutSceneGraph } from "../src/domain/graphLayout.ts";
import type { SceneGraph, StoryEdge, StoryNode } from "../src/domain/types.ts";

const W = 260;
const H = 120;

function node(id: string, type: StoryNode["type"] = "passage", extra: Partial<StoryNode> = {}): StoryNode {
  return { id, type, x: 0, y: 0, w: W, title: id, ...extra };
}

function edge(from: string, to: string, kind: StoryEdge["kind"] = "flow"): StoryEdge {
  return { from, to, kind };
}

function byId(graph: SceneGraph): Map<string, StoryNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

function assertNoOverlap(nodes: StoryNode[], heights: Record<string, number> = {}): void {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const aH = heights[a.id] ?? H;
      const bH = heights[b.id] ?? H;
      const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + bH && a.y + aH > b.y;
      assert.equal(overlaps, false, `${a.id} overlaps ${b.id}`);
    }
  }
}

test("layout terminates and is deterministic with back edges", () => {
  const graph: SceneGraph = {
    nodes: [
      node("start"),
      node("choice", "choice", { options: [{ text: "Loop", to: "loop" }, { text: "Continue", to: "after" }] }),
      node("loop"),
      node("back", "goto", { title: "*goto choice" }),
      node("after"),
      node("end", "finish"),
    ],
    edges: [
      edge("start", "choice"),
      edge("choice", "loop", "choice"),
      edge("choice", "after", "choice"),
      edge("loop", "back"),
      edge("back", "choice", "goto"),
      edge("after", "end"),
    ],
  };

  const first = layoutSceneGraph(graph, Object.fromEntries(graph.nodes.map((n) => [n.id, H])));
  const second = layoutSceneGraph(graph, Object.fromEntries(graph.nodes.map((n) => [n.id, H])));
  assert.deepEqual(first.nodes.map(({ id, x, y }) => ({ id, x, y })), second.nodes.map(({ id, x, y }) => ({ id, x, y })));
  assertNoOverlap(first.nodes);

  const laidOut = byId(first);
  assert.ok(laidOut.get("loop")!.x > laidOut.get("choice")!.x, "choice option target should rank after choice");
  assert.ok(laidOut.get("back")!.x > laidOut.get("loop")!.x, "loop body should flow forward to the goto node");
  assert.ok(laidOut.get("choice")!.x < laidOut.get("back")!.x, "back goto must not push the choice to an ever-growing depth");
  assert.ok(laidOut.get("after")!.x > laidOut.get("choice")!.x, "non-loop branch should continue forward");
});

test("layout keeps choice branches as sibling lanes and aligns their merge", () => {
  const graph: SceneGraph = {
    nodes: [
      node("start"),
      node("choice", "choice", { options: [{ text: "A", to: "left" }, { text: "B", to: "right" }] }),
      node("left"),
      node("right"),
      node("merge"),
      node("end", "finish"),
    ],
    edges: [
      edge("start", "choice"),
      edge("choice", "left", "choice"),
      edge("choice", "right", "choice"),
      edge("left", "merge"),
      edge("right", "merge"),
      edge("merge", "end"),
    ],
  };

  const result = layoutSceneGraph(graph, Object.fromEntries(graph.nodes.map((n) => [n.id, H])));
  const laidOut = byId(result);
  assertNoOverlap(result.nodes);
  const choice = laidOut.get("choice")!;
  const left = laidOut.get("left")!;
  const right = laidOut.get("right")!;
  const merge = laidOut.get("merge")!;

  assert.equal(left.x, right.x, "branch targets should share the next rank");
  assert.ok(left.y < right.y, "option order should map to top-to-bottom lanes");
  assert.ok(merge.x > left.x, "merge should rank after both branch bodies");
  const branchMid = (left.y + right.y + H) / 2;
  assert.ok(Math.abs((merge.y + H / 2) - branchMid) <= H, "merge should stay visually centered on branch lanes");
  assert.ok(choice.x < left.x, "choice should be before its branches");
});

test("layout handles if/elseif/else branches, rejoin, and disconnected nodes without overlap", () => {
  const graph: SceneGraph = {
    nodes: [
      node("intro"),
      node("if", "if", { branches: [{ kind: "if", expr: "brave", to: "brave" }, { kind: "elseif", expr: "clever", to: "clever" }, { kind: "else", to: "quiet" }] }),
      node("brave"),
      node("clever"),
      node("quiet"),
      node("rejoin"),
      node("tail"),
      node("orphan"),
    ],
    edges: [
      edge("intro", "if"),
      edge("if", "brave", "if"),
      edge("if", "clever", "elseif"),
      edge("if", "quiet", "else"),
      edge("brave", "rejoin"),
      edge("clever", "rejoin"),
      edge("quiet", "rejoin"),
      edge("rejoin", "tail"),
    ],
  };

  const result = layoutSceneGraph(graph, Object.fromEntries(graph.nodes.map((n) => [n.id, H])));
  const laidOut = byId(result);
  assertNoOverlap(result.nodes);
  assert.equal(laidOut.get("brave")!.x, laidOut.get("clever")!.x);
  assert.equal(laidOut.get("clever")!.x, laidOut.get("quiet")!.x);
  assert.ok(laidOut.get("brave")!.y < laidOut.get("clever")!.y && laidOut.get("clever")!.y < laidOut.get("quiet")!.y, "if/elseif/else order should define lanes");
  assert.ok(laidOut.get("rejoin")!.x > laidOut.get("brave")!.x);
  assert.ok(Number.isFinite(laidOut.get("orphan")!.x) && Number.isFinite(laidOut.get("orphan")!.y));
});

test("layout does not let backward goto edges create huge diagonal sprawl", () => {
  const graph: SceneGraph = {
    nodes: [node("label", "label", { title: "*label loop" }), node("body"), node("again", "goto", { title: "*goto loop" }), node("exit", "finish")],
    edges: [edge("label", "body"), edge("body", "again"), edge("again", "label", "goto"), edge("body", "exit")],
  };
  const result = layoutSceneGraph(graph, Object.fromEntries(graph.nodes.map((n) => [n.id, H])));
  const laidOut = byId(result);
  assertNoOverlap(result.nodes);
  assert.ok(laidOut.get("again")!.x > laidOut.get("label")!.x);
  assert.ok(laidOut.get("exit")!.x > laidOut.get("body")!.x);
  const width = Math.max(...result.nodes.map((n) => n.x + n.w)) - Math.min(...result.nodes.map((n) => n.x));
  assert.ok(width < 1600, `looping four-node graph should stay compact, got width ${width}`);
});
