export type Language = "pt" | "en" | "es";
export type Theme = "light" | "dark";
export type Density = "minimal" | "medium" | "rich";
export type EditorView = "editor" | "dashboard" | "map";

export type NodeType =
  | "passage"
  | "choice"
  | "fake_choice"
  | "if"
  | "set"
  | "label"
  | "goto"
  | "goto_scene"
  | "gosub"
  | "return"
  | "ending"
  | "finish"
  | "checkpoint"
  | "restore_checkpoint"
  | "page_break"
  | "comment"
  | "input_text"
  | "input_number"
  | "rand"
  | "gosub_scene"
  | "image"
  | "temp"
  | "params";

export interface SceneSummary {
  id: string;
  name: string;
  words: number;
  nodes: number;
  isStart?: boolean;
  current?: boolean;
  warning?: boolean;
  special?: boolean;
}

export interface VariableSummary {
  name: string;
  type: "string" | "number" | "boolean";
  initial: string;
  desc: string;
  uses: number;
  fairmath?: boolean;
}

export interface AchievementSummary {
  id: string;
  title: string;
  points: number;
  desc: string;
  preDesc?: string;
  postDesc?: string;
  hidden?: boolean;
}

export interface AssetSummary {
  id: string;
  path: string;
  kind: "image" | "audio" | "data" | "other";
  desc: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
}

export interface VariableSet {
  var: string;
  op: "=" | "+" | "-" | "%+" | "%-";
  val: string;
}

export interface ChoiceCondition {
  type: "if" | "selectable_if";
  expr: string;
}

export type ChoiceReuse = "hide" | "disable" | "allow";

export interface ChoiceOption {
  text: string;
  to: string;
  cond?: ChoiceCondition | null;
  reuse?: ChoiceReuse;
  hideReuse?: boolean;
  sets?: VariableSet[];
}

export interface FakeChoiceOption {
  text: string;
  cond?: ChoiceCondition | null;
  reuse?: ChoiceReuse;
  hideReuse?: boolean;
  sets?: VariableSet[];
}

export interface ConditionalBranch {
  kind: "if" | "elseif" | "else";
  expr?: string;
  to: string;
  sets?: VariableSet[];
}

export interface StoryNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  w: number;
  title: string;
  body?: string;
  prompt?: string;
  sets?: VariableSet[];
  options?: ChoiceOption[];
  fakeOptions?: FakeChoiceOption[];
  branches?: ConditionalBranch[];
  target?: string;
  inputVar?: string;
  inputMin?: string;
  inputMax?: string;
  warning?: string;
}

export interface StoryEdge {
  from: string;
  to: string;
  kind: "flow" | "choice" | "goto" | "if" | "elseif" | "else";
  label?: string;
}

export interface SceneGraph {
  nodes: StoryNode[];
  edges: StoryEdge[];
  sourceText?: string;
}

export interface LintIssue {
  level: "error" | "warning" | "info";
  msg: string;
  scene?: string | null;
  node?: string;
  line?: number;
}

export interface ChoiceForgeProject {
  title: string;
  author: string;
  sceneTitle: string;
  sceneSubtitle: string;
  scenes: SceneSummary[];
  variables: VariableSummary[];
  achievements: AchievementSummary[];
  assets: AssetSummary[];
  nodes: StoryNode[];
  edges: StoryEdge[];
  sceneData?: Record<string, SceneGraph>;
  startupSource?: string;
  statsSource?: string;
  lints: LintIssue[];
}

export interface I18nLabels {
  scenes: string;
  variables: string;
  achievements: string;
  assets: string;
  search: string;
  replace: string;
  inspector: string;
  play: string;
  export: string;
  autosave: string;
  addScene: string;
  addVar: string;
  addAch: string;
  addNode: string;
  deleteSelected: string;
  autoLayout: string;
  connectHere: string;
  dragToConnect: string;
  fitView: string;
  minimap: string;
  textMode: string;
  nodes: string;
  words: string;
  errors: string;
  warnings: string;
  consoleTitle: string;
  bodyLabel: string;
  choiceLabel: string;
  addOption: string;
  linterPasses: string;
  indentRule: string;
  encoding: string;
  nodeTypes: Record<NodeType, string>;
  inspectorTabs: [string, string, string];
  leftTabs: [string, string, string, string];
}
