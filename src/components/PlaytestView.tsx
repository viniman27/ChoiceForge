import { useEffect, useMemo, useState } from "react";
import type { ChoiceForgeProject, SceneGraph, StoryNode, VariableSet, VariableSummary } from "../domain/types";

interface PlaytestViewProps {
  project: ChoiceForgeProject;
  onClose: () => void;
}

export function PlaytestView({ project, onClose }: PlaytestViewProps) {
  const [sceneName, setSceneName] = useState(project.sceneTitle);
  const [nodeId, setNodeId] = useState("n1");
  const [stats, setStats] = useState(() => initialStats(project.variables));
  const graph = getSceneGraph(project, sceneName);
  const node = graph.nodes.find((candidate) => candidate.id === nodeId) ?? graph.nodes[0] ?? null;

  useEffect(() => {
    setSceneName(project.sceneTitle);
    setNodeId("n1");
    setStats(initialStats(project.variables));
  }, [project]);

  useEffect(() => {
    if (!node) return;
    if (node.type === "if") {
      const branch = node.branches?.find((candidate) => candidate.kind === "else" || evaluateExpression(candidate.expr ?? "false", stats));
      if (branch) {
        setStats((current) => applySets(current, branch.sets ?? [], project.variables));
        setNodeId(branch.to);
      }
    }
    if (node.type === "goto_scene" && node.target) {
      setSceneName(node.target);
      setNodeId("n1");
    }
    if (node.type === "finish") {
      const nextScene = nextPlayableScene(project, sceneName);
      if (nextScene) {
        setSceneName(nextScene);
        setNodeId("n1");
      }
    }
    if (node.type === "goto" || node.type === "gosub") {
      const target = graph.edges.find((edge) => edge.from === node.id && edge.kind === "goto")?.to;
      if (target) setNodeId(target);
    }
  }, [graph.edges, node, project, project.variables, sceneName, stats]);

  const options = node?.type === "choice" ? node.options ?? [] : [];
  const flowTarget = useMemo(() => (node ? graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to : undefined), [graph.edges, node]);

  return (
    <section className="playtest">
      <header className="playtest-head">
        <div>
          <div className="generated-doc-kicker">playtest</div>
          <h1>{sceneName}.txt</h1>
        </div>
        <div className="playtest-actions">
          <button className="ghost-btn" onClick={() => { setSceneName(project.sceneTitle); setNodeId("n1"); setStats(initialStats(project.variables)); }}>Restart</button>
          <button className="ghost-btn" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="playtest-body">
        <aside className="playtest-stats">
          {project.variables.map((variable) => (
            <div className="playtest-stat" key={variable.name}>
              <span>{variable.name}</span>
              <code>{String(stats[variable.name] ?? variable.initial)}</code>
            </div>
          ))}
        </aside>

        <main className="playtest-card">
          {!node ? (
            <p>Scene has no playable nodes.</p>
          ) : (
            <>
              <div className="playtest-node"><code>{node.id}</code><span>{node.title}</span></div>
              {node.body && <p className="playtest-text">{node.body}</p>}
              {node.type === "checkpoint" && <p className="playtest-note">Checkpoint saved: {node.title.replace("*save_checkpoint", "").trim()}</p>}
              {node.type === "return" && <p className="playtest-note">Subroutine returned.</p>}
              {node.type === "ending" && <p className="playtest-note">Ending reached.</p>}
              {node.type === "finish" && <p className="playtest-note">Scene finished.</p>}
              {node.prompt && <p className="playtest-prompt">{node.prompt}</p>}

              {options.length > 0 && (
                <div className="playtest-options">
                  {options.map((option, index) => {
                    const enabled = option.cond ? evaluateExpression(option.cond.expr, stats) : true;
                    return (
                      <button
                        key={`${option.text}-${index}`}
                        disabled={!enabled}
                        onClick={() => {
                          setStats((current) => applySets(current, option.sets ?? [], project.variables));
                          setNodeId(option.to);
                        }}
                      >
                        <span>#{index + 1}</span>
                        {option.text}
                      </button>
                    );
                  })}
                </div>
              )}

              {flowTarget && node.type !== "choice" && node.type !== "return" && node.type !== "ending" && node.type !== "finish" && (
                <button className="playtest-continue" onClick={() => { setStats((current) => applySets(current, node.sets ?? [], project.variables)); setNodeId(flowTarget); }}>
                  Continue
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </section>
  );
}

function getSceneGraph(project: ChoiceForgeProject, sceneName: string): SceneGraph {
  return project.sceneData?.[sceneName] ?? { nodes: project.nodes, edges: project.edges };
}

function nextPlayableScene(project: ChoiceForgeProject, sceneName: string): string | null {
  const scenes = project.scenes.filter((scene) => !scene.isStart && !scene.special);
  const index = scenes.findIndex((scene) => scene.name === sceneName);
  return index >= 0 ? scenes[index + 1]?.name ?? null : null;
}

function initialStats(variables: VariableSummary[]): Record<string, string | number | boolean> {
  return Object.fromEntries(variables.map((variable) => [variable.name, parseValue(variable.initial, variable)]));
}

function applySets(current: Record<string, string | number | boolean>, sets: VariableSet[], variables: VariableSummary[]) {
  const next = { ...current };
  sets.forEach((set) => {
    const variable = variables.find((candidate) => candidate.name === set.var);
    const value = parseValue(set.val, variable);
    const currentValue = Number(next[set.var] ?? 0);
    if (set.op === "=") next[set.var] = value;
    if (set.op === "+") next[set.var] = currentValue + Number(value);
    if (set.op === "-") next[set.var] = currentValue - Number(value);
    if (set.op === "%+") next[set.var] = Math.min(100, Math.round(currentValue + (100 - currentValue) * Number(value) / 100));
    if (set.op === "%-") next[set.var] = Math.max(0, Math.round(currentValue - currentValue * Number(value) / 100));
  });
  return next;
}

function parseValue(value: string, variable: VariableSummary | undefined): string | number | boolean {
  if (variable?.type === "boolean") return value === "true";
  if (variable?.type === "number") return Number(value) || 0;
  return value.replace(/^"|"$/g, "");
}

function evaluateExpression(expression: string, stats: Record<string, string | number | boolean>): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return true;
  const names = Object.keys(stats).sort((a, b) => b.length - a.length);
  const source = names.reduce((current, name) => current.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, "g"), JSON.stringify(stats[name])), trimmed)
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||")
    .replace(/\bnot\b/g, "!");
  try {
    const tokens = tokenizeExpression(source);
    let index = 0;
    const peek = () => tokens[index];
    const take = () => tokens[index++];

    const parsePrimary = (): string | number | boolean => {
      const token = take();
      if (token === "(") {
        const value = parseOr();
        if (take() !== ")") throw new Error("unclosed expression");
        return value;
      }
      if (token === "true") return true;
      if (token === "false") return false;
      if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
      if (/^".*"$/.test(token)) return token.slice(1, -1);
      throw new Error("unsupported token");
    };

    const parseNot = (): string | number | boolean => {
      if (peek() === "!") {
        take();
        return !Boolean(parseNot());
      }
      return parsePrimary();
    };

    const parseComparison = (): boolean | string | number => {
      let left = parseNot();
      while (["=", "==", "!=", ">", ">=", "<", "<="].includes(peek())) {
        const op = take();
        const right = parseNot();
        if (op === "=" || op === "==") left = left === right;
        if (op === "!=") left = left !== right;
        if (op === ">") left = Number(left) > Number(right);
        if (op === ">=") left = Number(left) >= Number(right);
        if (op === "<") left = Number(left) < Number(right);
        if (op === "<=") left = Number(left) <= Number(right);
      }
      return left;
    };

    const parseAnd = (): boolean => {
      let value = Boolean(parseComparison());
      while (peek() === "&&") {
        take();
        value = value && Boolean(parseComparison());
      }
      return value;
    };

    function parseOr(): boolean {
      let value = parseAnd();
      while (peek() === "||") {
        take();
        value = value || parseAnd();
      }
      return value;
    }

    const result = parseOr();
    if (index !== tokens.length) throw new Error("unused tokens");
    return result;
  } catch {
    return false;
  }
}

function tokenizeExpression(expression: string): string[] {
  return expression.match(/"[^"]*"|>=|<=|!=|==|&&|\|\||[()!><=]|-?\d+(?:\.\d+)?|true|false/g) ?? [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
