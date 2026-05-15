import { useEffect, useMemo, useRef, useState } from "react";
import type { ChoiceForgeProject, SceneGraph, StoryNode, VariableSet, VariableSummary } from "../domain/types";

interface PlaytestViewProps {
  project: ChoiceForgeProject;
  onClose: () => void;
  onNavigateToNode?: (sceneName: string, nodeId: string) => void;
}

type ReturnEntry = { scene: string; nodeId: string };
type PageBlock = { id: string; body?: string; note?: string };
type TrailEntry = { kind: "scene"; name: string } | { kind: "choice"; text: string; num: number };

export function PlaytestView({ project, onClose, onNavigateToNode }: PlaytestViewProps) {
  const [sceneName, setSceneName] = useState(project.sceneTitle);
  const [nodeId, setNodeId] = useState("n1");
  const [stats, setStats] = useState(() => initialStats(project.variables));
  const [returnStack, setReturnStack] = useState<ReturnEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pageBlocks, setPageBlocks] = useState<PageBlock[]>([]);
  const [playTrail, setPlayTrail] = useState<TrailEntry[]>(() => [{ kind: "scene", name: project.sceneTitle }]);
  const [changedVars, setChangedVars] = useState<Set<string>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graph = getSceneGraph(project, sceneName);

  const flashVars = (names: string[]) => {
    if (!names.length) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setChangedVars(new Set(names));
    flashTimerRef.current = setTimeout(() => setChangedVars(new Set()), 1400);
  };
  const node = graph.nodes.find((candidate) => candidate.id === nodeId) ?? graph.nodes[0] ?? null;

  useEffect(() => {
    setSceneName(project.sceneTitle);
    setNodeId("n1");
    setStats(initialStats(project.variables));
    setReturnStack([]);
    setInputValue("");
    setPageBlocks([]);
    setPlayTrail([{ kind: "scene", name: project.sceneTitle }]);
    setChangedVars(new Set());
  }, [project]);

  useEffect(() => { setInputValue(""); }, [nodeId, sceneName]);

  useEffect(() => {
    if (!node) return;
    if (node.type === "passage") {
      const passageFlowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      if (passageFlowTarget) {
        if (node.sets?.length) {
          flashVars(node.sets.map((s) => s.var));
          setStats((current) => applySets(current, node.sets!, project.variables));
        }
        setPageBlocks((prev) => [...prev, { id: node.id, body: node.body, note: node.note }]);
        setNodeId(passageFlowTarget);
      }
    }
    if (node.type === "if") {
      const branch = node.branches?.find((candidate) => candidate.kind === "else" || evaluateExpression(candidate.expr ?? "false", stats));
      if (branch) {
        if (branch.sets?.length) flashVars(branch.sets.map((s) => s.var));
        setStats((current) => applySets(current, branch.sets ?? [], project.variables));
        setNodeId(branch.to);
      }
    }
    if (node.type === "goto_scene" && node.target) {
      setPlayTrail((prev) => [...prev, { kind: "scene", name: node.target! }]);
      setSceneName(node.target);
      setNodeId("n1");
    }
    if (node.type === "finish") {
      const nextScene = nextPlayableScene(project, sceneName);
      if (nextScene) {
        setPlayTrail((prev) => [...prev, { kind: "scene", name: nextScene }]);
        setSceneName(nextScene);
        setNodeId("n1");
      }
    }
    if (node.type === "goto") {
      const target = graph.edges.find((edge) => edge.from === node.id && edge.kind === "goto")?.to;
      if (target) setNodeId(target);
    }
    if (node.type === "gosub") {
      const target = graph.edges.find((edge) => edge.from === node.id && edge.kind === "goto")?.to;
      const flowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      if (target) {
        if (flowTarget) setReturnStack((current) => [...current, { scene: sceneName, nodeId: flowTarget }]);
        setNodeId(target);
      }
    }
    if (node.type === "gosub_scene" && node.target) {
      const entryLabel = node.body?.trim();
      const flowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      const targetGraph = getSceneGraph(project, node.target);
      const labelNode = entryLabel
        ? targetGraph.nodes.find((candidate) => candidate.type === "label" && candidate.title === `*label ${entryLabel}`)
        : null;
      setReturnStack((current) => [...current, { scene: sceneName, nodeId: flowTarget ?? "" }]);
      setSceneName(node.target);
      setNodeId(labelNode?.id ?? "n1");
    }
    if (node.type === "return") {
      const top = returnStack.at(-1);
      if (top) {
        setReturnStack((current) => current.slice(0, -1));
        setSceneName(top.scene);
        setNodeId(top.nodeId);
      }
    }
    if (node.type === "rand") {
      const min = Math.ceil(Number(node.inputMin ?? "1"));
      const max = Math.floor(Number(node.inputMax ?? "100"));
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      if (node.inputVar) {
        flashVars([node.inputVar]);
        setStats((current) => ({ ...current, [node.inputVar!]: value }));
      }
      const flowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      if (flowTarget) setNodeId(flowTarget);
    }
    if (node.type === "set") {
      if (node.sets?.length) {
        flashVars(node.sets.map((s) => s.var));
        setStats((current) => applySets(current, node.sets!, project.variables));
      }
      const flowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      if (flowTarget) setNodeId(flowTarget);
    }
    if (node.type === "temp") {
      if (node.inputVar) {
        const raw = node.body?.trim() ?? "0";
        const numVal = Number(raw);
        const parsed = raw === "true" ? true : raw === "false" ? false : Number.isFinite(numVal) ? numVal : raw;
        flashVars([node.inputVar]);
        setStats((current) => ({ ...current, [node.inputVar!]: parsed }));
      }
      const flowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      if (flowTarget) setNodeId(flowTarget);
    }
    if (node.type === "params") {
      const flowTarget = graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to;
      if (flowTarget) setNodeId(flowTarget);
    }
  }, [graph.edges, node, project, project.variables, returnStack, sceneName, stats]);

  const options = node?.type === "choice" ? node.options ?? [] : [];
  const flowTarget = useMemo(
    () => (node ? graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow")?.to : undefined),
    [graph.edges, node],
  );
  const imageAsset = node?.type === "image"
    ? (project.assets ?? []).find((asset) => asset.fileName === node.target)
    : null;

  const restart = () => {
    setSceneName(project.sceneTitle);
    setNodeId("n1");
    setStats(initialStats(project.variables));
    setReturnStack([]);
    setInputValue("");
    setPageBlocks([]);
    setPlayTrail([{ kind: "scene", name: project.sceneTitle }]);
    setChangedVars(new Set());
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  };

  const advance = (nextId: string) => {
    const sets = node?.sets ?? [];
    if (sets.length) flashVars(sets.map((s) => s.var));
    setStats((current) => applySets(current, sets, project.variables));
    setNodeId(nextId);
  };

  const submitInput = (value: string) => {
    if (!node?.inputVar) return;
    const varDef = project.variables.find((candidate) => candidate.name === node.inputVar);
    const parsed: string | number = varDef?.type === "number" ? Number(value) || 0 : value;
    flashVars([node.inputVar]);
    setStats((current) => ({ ...current, [node.inputVar!]: parsed }));
    if (flowTarget) setNodeId(flowTarget);
  };

  const isInputNode = node?.type === "input_text" || node?.type === "input_number";
  const showContinue = Boolean(flowTarget)
    && node?.type !== "passage"
    && node?.type !== "choice"
    && node?.type !== "ending"
    && node?.type !== "input_text"
    && node?.type !== "input_number";

  return (
    <section className="playtest">
      <header className="playtest-head">
        <div>
          <div className="generated-doc-kicker">playtest</div>
          <h1>{sceneName}.txt</h1>
        </div>
        <div className="playtest-actions">
          <button className="ghost-btn" onClick={restart}>Restart</button>
          <button className="ghost-btn" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="playtest-body">
        <aside className="playtest-stats">
          {project.variables.map((variable) => (
            <div className={`playtest-stat${changedVars.has(variable.name) ? " is-changed" : ""}`} key={variable.name}>
              <span>{variable.name}</span>
              <code>{String(stats[variable.name] ?? variable.initial)}</code>
            </div>
          ))}
          <div className="pt-trail">
            <div className="pt-trail-head">history</div>
            <div className="pt-trail-list">
              {playTrail.map((entry, i) =>
                entry.kind === "scene"
                  ? <div key={i} className="pt-trail-scene">→ {entry.name}</div>
                  : <div key={i} className="pt-trail-choice" title={entry.text}>#{entry.num} {entry.text}</div>
              )}
            </div>
          </div>
        </aside>

        <main className="playtest-card">
          {!node ? (
            <p>Scene has no playable nodes.</p>
          ) : (
            <>
              <div className="playtest-node">
                <code>{node.id}</code>
                <span>{node.title}</span>
                {onNavigateToNode && (
                  <button
                    className="playtest-goto-btn"
                    onClick={() => onNavigateToNode(sceneName, node.id)}
                    title="Jump to this node in the editor"
                  >↗ editor</button>
                )}
              </div>

              {pageBlocks.length > 0 && (
                <div className="playtest-history">
                  {pageBlocks.map((block) => (
                    <div key={block.id} className="playtest-history-block">
                      {block.body && <p className="playtest-text">{interpolate(block.body, stats)}</p>}
                      {block.note && <p className="playtest-note">✎ {block.note}</p>}
                    </div>
                  ))}
                  <div className="playtest-history-sep" />
                </div>
              )}

              {node.type === "image" && (
                imageAsset?.dataUrl
                  ? <img className="playtest-image" src={imageAsset.dataUrl} alt={node.prompt ?? node.target ?? ""} />
                  : <div className="playtest-image-placeholder">[image: {node.target || "unnamed"}]</div>
              )}

              {node.body && node.type !== "image" && node.type !== "passage" && (
                <p className="playtest-text">{interpolate(node.body, stats)}</p>
              )}

              {node.type === "passage" && !graph.edges.find((edge) => edge.from === node.id && edge.kind === "flow") && node.body && (
                <p className="playtest-text">{interpolate(node.body, stats)}</p>
              )}

              {node.type === "checkpoint" && (
                <p className="playtest-note">Checkpoint saved: {node.title.replace("*save_checkpoint", "").trim()}</p>
              )}
              {node.type === "restore_checkpoint" && (
                <p className="playtest-note">Checkpoint restore requested.</p>
              )}
              {node.type === "ending" && <p className="playtest-note">The End.</p>}
              {node.type === "finish" && <p className="playtest-note">Scene finished.</p>}

              {node.prompt && (
                <p className="playtest-prompt">{interpolate(node.prompt, stats)}</p>
              )}

              {node.type === "fake_choice" && (
                <div className="playtest-options">
                  {node.fakeOptions?.map((option, index) => (
                    <button key={`${option.text}-${index}`} disabled>
                      <span>#{index + 1}</span>
                      {option.text}
                    </button>
                  ))}
                </div>
              )}

              {options.length > 0 && (
                <div className="playtest-options">
                  {options.map((option, index) => {
                    const condMet = option.cond ? evaluateExpression(option.cond.expr, stats) : true;
                    if (option.cond?.type === "if" && !condMet) return null;
                    return (
                      <button
                        key={`${option.text}-${index}`}
                        disabled={!condMet}
                        onClick={() => {
                          const optSets = option.sets ?? [];
                          if (optSets.length) flashVars(optSets.map((s) => s.var));
                          setStats((current) => applySets(current, optSets, project.variables));
                          setPageBlocks([]);
                          setPlayTrail((prev) => [...prev, { kind: "choice", text: option.text, num: index + 1 }]);
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

              {isInputNode && (
                <form
                  className="playtest-input-form"
                  onSubmit={(event) => { event.preventDefault(); submitInput(inputValue); }}
                >
                  <label className="playtest-input-label">{node.inputVar}</label>
                  <input
                    key={`${sceneName}_${nodeId}`}
                    className="playtest-input"
                    type={node.type === "input_number" ? "number" : "text"}
                    min={node.type === "input_number" ? node.inputMin : undefined}
                    max={node.type === "input_number" ? node.inputMax : undefined}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    autoFocus
                    placeholder={
                      node.type === "input_number"
                        ? `${node.inputMin ?? "0"}–${node.inputMax ?? "100"}`
                        : "Type here…"
                    }
                  />
                  <button type="submit" className="playtest-continue" disabled={!inputValue.trim()}>
                    Confirm
                  </button>
                </form>
              )}

              {showContinue && (
                <button
                  className="playtest-continue"
                  onClick={() => {
                    if (node?.type === "page_break") setPageBlocks([]);
                    advance(flowTarget!);
                  }}
                >
                  {node?.type === "page_break"
                    ? node.title.replace("*page_break", "").trim() || "Continue"
                    : "Continue"}
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

function interpolate(text: string, stats: Record<string, string | number | boolean>): string {
  return text.replace(/\$\{([a-zA-Z_][\w]*)\}/g, (_, name: string) => String(stats[name] ?? `{${name}}`));
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
