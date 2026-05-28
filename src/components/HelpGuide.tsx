import { useEffect, useState } from "react";
import { NodeIcon, typeColors } from "./NodeCard";
import type { NodeType } from "../domain/types";

type HelpTab = "canvas" | "nodes" | "patterns" | "cheatsheet" | "faq" | "inspector" | "project" | "importexport" | "shortcuts";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["drag"], label: "Pan canvas" },
      { keys: ["Space", "drag"], label: "Pan canvas (alt)" },
      { keys: ["Shift", "drag"], label: "Box select" },
      { keys: ["double-click"], label: "Create passage node" },
      { keys: ["F"], label: "Fit all nodes to view" },
      { keys: ["Shift", "F"], label: "Fit selected nodes to view" },
      { keys: ["Ctrl", "F"], label: "Filter nodes (text, type:, tag:, has:error…)" },
      { keys: ["G"], label: "Toggle snap-to-grid" },
      { keys: ["A"], label: "Add passage at viewport center" },
      { keys: ["Ctrl", "scroll"], label: "Zoom in/out" },
      { keys: ["Escape"], label: "Deselect / close" },
      { keys: ["drag", "→ empty"], label: "Create + connect node from anchor" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Click"], label: "Select node" },
      { keys: ["Ctrl", "A"], label: "Select all" },
      { keys: ["Delete"], label: "Delete selected" },
      { keys: ["Ctrl", "D"], label: "Duplicate selected" },
      { keys: ["Ctrl", "C"], label: "Copy selected" },
      { keys: ["Ctrl", "V"], label: "Paste" },
    ],
  },
  {
    title: "History",
    shortcuts: [
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
    ],
  },
  {
    title: "File",
    shortcuts: [
      { keys: ["Ctrl", "S"], label: "Save / export" },
    ],
  },
  {
    title: "Search",
    shortcuts: [
      { keys: ["Ctrl", "Shift", "F"], label: "Focus search" },
      { keys: ["Ctrl", "H"], label: "Toggle find & replace" },
    ],
  },
  {
    title: "Help",
    shortcuts: [
      { keys: ["Ctrl", "K"], label: "Command palette" },
      { keys: ["?"], label: "Show this guide" },
    ],
  },
];

interface NodeEntry {
  type: NodeType;
  command: string;
  desc: string;
  useWhen: string;
  avoidWhen?: string;
}

const NODE_ENTRIES: NodeEntry[] = [
  {
    type: "passage",
    command: "(prose) + *goto next_node",
    desc: "Narrative text. Supports ${var} interpolation and @{var a b} conditional inline text.",
    useWhen: "Most of your story — every block of prose the player reads.",
  },
  {
    type: "choice",
    command: "*choice",
    desc: "Player choice menu. Each option connects to a child node.",
    useWhen: "Real branching where the player picks a path that changes the story.",
    avoidWhen: "When all options should be shown then merge to the same next node — use *fake_choice instead.",
  },
  {
    type: "fake_choice",
    command: "*fake_choice",
    desc: "Player picks an option, each shows brief inline text, then all paths converge.",
    useWhen: "Adding flavor (what does the character notice? what do they say?) without real branching.",
    avoidWhen: "When picks should actually change the story — use *choice.",
  },
  {
    type: "if",
    command: "*if / *elseif / *else",
    desc: "Conditional branch. Each arm connects to a child node.",
    useWhen: "Story should branch based on variables (stats, flags, earlier choices).",
  },
  {
    type: "set",
    command: "*set var op value",
    desc: "Modifies a variable. Operators: = + - %+ %- (fairmath, clamped 0–100).",
    useWhen: "Tracking stats, flags, items the player picked up.",
  },
  {
    type: "temp",
    command: "*temp name initial",
    desc: "Scene-local variable. Cleared when the scene ends.",
    useWhen: "Intermediate calculations that don't need to outlive the scene.",
    avoidWhen: "For values used across scenes — use *create + set instead.",
  },
  {
    type: "label",
    command: "*label name",
    desc: "Named anchor inside a scene. Target for *goto and *gosub.",
    useWhen: "(1) Importing existing ChoiceScript that uses *label; (2) marking subroutine entry points for *gosub; (3) when you want the exported .txt to use a human-readable label instead of the auto-generated cf_n42.",
    avoidWhen: "For ordinary forward flow — you don't need a *label. Just draw the connection. The exporter wires up jumps via internal labels automatically.",
  },
  {
    type: "goto",
    command: "*goto label_name",
    desc: "Unconditional jump to a *label within the current scene.",
    useWhen: "Loops or pointers back to an earlier label, or routing multiple branches to the same entry point.",
    avoidWhen: "Linear forward flow — a regular flow connection is cleaner.",
  },
  {
    type: "goto_scene",
    command: "*goto_scene scene_name [label]",
    desc: "Jumps to another scene. No return. Optionally targets a label inside that scene.",
    useWhen: "Moving between chapters or major sections.",
  },
  {
    type: "gosub",
    command: "*gosub label",
    desc: "Calls a subroutine at a *label in the current scene. Resumes after *return.",
    useWhen: "Reusable mini-flows: a stat check, a NPC reaction template, a shop interaction.",
  },
  {
    type: "gosub_scene",
    command: "*gosub_scene scene_name [label]",
    desc: "Calls a subroutine in another scene. Returns on *return.",
    useWhen: "Reusable flows shared across the whole story (e.g. one combat scene called from many places).",
  },
  {
    type: "return",
    command: "*return",
    desc: "Returns from a *gosub or *gosub_scene call back to the original call site.",
    useWhen: "End of every subroutine flow reached via gosub.",
  },
  {
    type: "finish",
    command: "*finish",
    desc: "Ends the current scene and advances to the next in *scene_list.",
    useWhen: "Natural end of a chapter — last node before the next scene.",
  },
  {
    type: "ending",
    command: "*ending",
    desc: "Ends the game entirely.",
    useWhen: "Final node of any story path — bad ending, good ending, secret ending.",
  },
  {
    type: "checkpoint",
    command: "*save_checkpoint name",
    desc: "Saves a named restore point at this position.",
    useWhen: "Before a risky branch or dangerous choice the player might want to retry.",
  },
  {
    type: "restore_checkpoint",
    command: "*restore_checkpoint name",
    desc: "Jumps back to a previously saved checkpoint.",
    useWhen: "Reset gameplay to a known point — bad ending replay buttons, retry choices.",
  },
  {
    type: "page_break",
    command: "*page_break Continue",
    desc: "Inserts a page break with a configurable button label.",
    useWhen: "Splitting long prose sections so the player paces through.",
  },
  {
    type: "input_text",
    command: "*input_text variable",
    desc: "Prompts the player to enter a text string.",
    useWhen: "Player character name, custom note, free-form input.",
  },
  {
    type: "input_number",
    command: "*input_number var min max",
    desc: "Prompts the player to enter a number in range.",
    useWhen: "Player age, dice roll override, custom stat allocation.",
  },
  {
    type: "rand",
    command: "*rand var min max",
    desc: "Assigns a random integer in range to a variable.",
    useWhen: "Combat rolls, random events, procedural variations.",
  },
  {
    type: "image",
    command: "*image filename alignment [alt]",
    desc: "Displays an image. Alignment: none / left / right.",
    useWhen: "Illustrations, character portraits, scene-setting visuals.",
  },
  {
    type: "sound",
    command: "*sound filename",
    desc: "Plays an audio file.",
    useWhen: "Music cues, ambient sounds, dramatic stings.",
  },
  {
    type: "params",
    command: "*params name1 name2",
    desc: "Declares parameter names for a gosub subroutine.",
    useWhen: "Right after a *label that's a subroutine entry — receives values from *gosub call site.",
  },
  {
    type: "achieve",
    command: "*achieve achievement_id",
    desc: "Unlocks an achievement by its ID.",
    useWhen: "When the player crosses a story threshold worth marking.",
  },
  {
    type: "comment",
    command: "*comment text",
    desc: "Author note. Never visible to the player.",
    useWhen: "TODOs, design notes, reminders inside the .txt for yourself or collaborators.",
  },
];

interface HelpGuideProps {
  onClose: () => void;
}

const TAB_LABELS: Record<HelpTab, string> = {
  canvas: "Canvas",
  nodes: "Node Types",
  patterns: "Patterns",
  cheatsheet: "Cheatsheet",
  faq: "FAQ",
  inspector: "Inspector",
  project: "Project",
  importexport: "Import / Export",
  shortcuts: "Shortcuts",
};

const TAB_ORDER: HelpTab[] = ["canvas", "nodes", "patterns", "cheatsheet", "inspector", "project", "importexport", "shortcuts", "faq"];

export function HelpGuide({ onClose }: HelpGuideProps) {
  const [tab, setTab] = useState<HelpTab>("canvas");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="hg-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hg-modal">
        <div className="hg-header">
          <span className="hg-title">ChoiceForge Guide</span>
          <button className="hg-close" onClick={onClose} aria-label="close guide">✕</button>
        </div>
        <div className="hg-tabs">
          {TAB_ORDER.map((t) => (
            <button key={t} className={`hg-tab ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="hg-body">
          {tab === "canvas" && <CanvasTab />}
          {tab === "nodes" && <NodesTab />}
          {tab === "patterns" && <PatternsTab />}
          {tab === "cheatsheet" && <CheatsheetTab />}
          {tab === "faq" && <FaqTab />}
          {tab === "inspector" && <InspectorTab />}
          {tab === "project" && <ProjectTab />}
          {tab === "importexport" && <ImportExportTab />}
          {tab === "shortcuts" && <ShortcutsTab />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="hg-section">
      <h3 className="hg-section-title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="hg-row">
      <span className="hg-row-label">{label}</span>
      <span className="hg-row-desc">{desc}</span>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="hg-code"><code>{children}</code></pre>;
}

function CanvasTab() {
  return (
    <div className="hg-content">
      <Section title="Navigation">
        <Row label="Pan" desc="Middle-click drag, or hold Space + drag anywhere on the canvas." />
        <Row label="Zoom" desc="Ctrl + scroll wheel. The canvas zooms toward the cursor position." />
        <Row label="Fit view" desc="Press F to fit all nodes. Shift+F fits only selected nodes." />
        <Row label="Reset view" desc="Use Command Palette (Ctrl+K) → 'fit' to reset pan & zoom." />
      </Section>
      <Section title="Adding nodes">
        <Row label="Double-click canvas" desc="Creates a passage node at the click position." />
        <Row label="Toolbar" desc="The scrollable node toolbar on the left shows all 24 node types. Click to add at center." />
        <Row label="A key" desc="Adds a passage node at the current viewport center." />
        <Row label="Drag from anchor" desc="Drag from the ↓ anchor at a node's bottom edge to empty space — a menu appears to pick the new node type and it connects automatically." />
      </Section>
      <Section title="Connecting nodes">
        <Row label="Drag anchor" desc="Drag from the ↓ anchor of a source node onto the ○ input anchor of a target node." />
        <Row label="Auto-connect" desc="Dragging to empty space opens a picker — choose a type and the new node is created and connected in one step." />
        <Row label="Edges" desc="Connections are directional (source → target). Arrows show flow direction." />
      </Section>
      <Section title="Selection">
        <Row label="Click" desc="Select a single node." />
        <Row label="Shift + drag" desc="Box-select: draw a rectangle to select multiple nodes at once." />
        <Row label="Ctrl+A" desc="Select all nodes in the current scene." />
        <Row label="Escape" desc="Deselect all and close open popovers." />
      </Section>
      <Section title="Filtering">
        <Row label="Ctrl+F" desc="Opens the canvas filter bar. Type text to highlight matching nodes by title or body." />
        <Row label="type:if" desc="Filter by node type — e.g. type:passage, type:choice, type:goto." />
        <Row label="tag:red" desc="Filter by color tag — e.g. tag:green, tag:blue." />
        <Row label="has:error" desc="Show only nodes with lint errors. Use has:warning for warnings." />
        <Row label="Navigation" desc="Filter results cycle — use Enter / Shift+Enter to jump between matches." />
      </Section>
      <Section title="Layout & resize">
        <Row label="Auto-layout" desc="Use Command Palette → 'layout' or the toolbar button to run the hierarchical auto-layout algorithm." />
        <Row label="Snap-to-grid" desc="Press G to toggle grid snapping (20 px grid). A badge appears when active." />
        <Row label="Node resize" desc="Hover a node and drag the right-edge handle to resize its width." />
        <Row label="Toolbar resize" desc="Drag the divider between the node toolbar and the canvas to adjust toolbar width." />
      </Section>
    </div>
  );
}

function NodesTab() {
  return (
    <div className="hg-content">
      <p className="hg-intro">All 24 node types and what they generate. Each card shows the ChoiceScript command, a one-line description, and guidance on when to reach for it.</p>
      <div className="hg-node-grid hg-node-grid-detailed">
        {NODE_ENTRIES.map(({ type, command, desc, useWhen, avoidWhen }) => {
          const color = typeColors[type];
          return (
            <div key={type} className="hg-node-entry hg-node-entry-detailed">
              <div className="hg-node-head">
                <div className="hg-node-icon" style={{ background: color.tint, color: color.dot }}>
                  <NodeIcon type={type} />
                </div>
                <div className="hg-node-titles">
                  <span className="hg-node-name" style={{ color: color.dot }}>{color.label}</span>
                  <code className="hg-node-command">{command}</code>
                </div>
              </div>
              <p className="hg-node-desc">{desc}</p>
              <p className="hg-node-when"><strong>Use when:</strong> {useWhen}</p>
              {avoidWhen && <p className="hg-node-avoid"><strong>Skip when:</strong> {avoidWhen}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PatternsTab() {
  return (
    <div className="hg-content">
      <p className="hg-intro">Common story structures and how to build them in ChoiceForge. Copy these mental models — they cover 90% of what you'll write.</p>

      <Section title="1. Linear chain">
        <p>Just one passage after another. The simplest possible flow.</p>
        <CodeBlock>{`[passage A] ──flow──▶ [passage B] ──flow──▶ [passage C] ──flow──▶ [finish]`}</CodeBlock>
        <p>No labels, no conditions. Each node uses its synthetic *label cf_n* under the hood; flow edges become *goto in the .txt.</p>
      </Section>

      <Section title="2. Branching choice with merge">
        <p>Player picks an option, each option has a different consequence, then all paths reconverge.</p>
        <CodeBlock>{`            ┌──▶ [aggressive path] ──▶ [merge point]
[choice] ──┼──▶ [diplomatic path] ──▶ [merge point]
            └──▶ [sneaky path]    ──▶ [merge point]`}</CodeBlock>
        <p>Three options on the choice node, all three branches point to the same continuation. Use a *label on the merge if it's reused from many places, otherwise plain flow connections work.</p>
      </Section>

      <Section title="3. Conditional with fallthrough">
        <p>Show a passage only if a condition is met, otherwise continue.</p>
        <CodeBlock>{`[set strength = 10]
       │
       ▼
[if strength > 50]──▶ [passage: "you push the boulder"] ──▶ [next]
       │
       └─else─▶ [passage: "the boulder won't budge"] ──▶ [next]`}</CodeBlock>
        <p>An *if node with two branches. Both arms eventually meet the same next node — that's a "merge" again.</p>
      </Section>

      <Section title="4. Subroutine (reusable mini-flow)">
        <p>A code block called from multiple places, returning to the caller.</p>
        <CodeBlock>{`[passage] ──▶ [gosub check_stats] ──▶ [continue story]
                       │
                       ▼
              [label check_stats]
                       │
                       ▼
              [passage: "your strength is ..."]
                       │
                       ▼
              [return]`}</CodeBlock>
        <p>The *label marks the subroutine entry. *gosub jumps there, runs until *return, then comes back. Note: in this case the *label IS necessary — *gosub requires a named target.</p>
      </Section>

      <Section title="5. Cross-scene flow">
        <p>End one scene, automatically start the next listed in *scene_list.</p>
        <CodeBlock>{`Scene "chapter_1":
  [passage] ──▶ [choice] ──▶ ... ──▶ [finish]

Scene "chapter_2" (next in scene_list):
  [passage: "you arrive at the cave"] ──▶ ...`}</CodeBlock>
        <p>*finish closes the current scene and advances. Use *goto_scene scene_name to jump to a specific scene out of order.</p>
      </Section>

      <Section title="6. Loop with exit condition">
        <p>Repeat a section until a condition is met.</p>
        <CodeBlock>{`           ┌──── flow ───────────────────┐
           ▼                             │
    [label loop_start]                   │
           │                             │
           ▼                             │
    [if attempts < 3] ─true─▶ [passage] ─┤
           │
           └─else─▶ [passage: "out of attempts"] ──▶ [continue]`}</CodeBlock>
        <p>Use *label loop_start as a target, then *goto loop_start inside the loop body. The *if checks the exit condition.</p>
      </Section>
    </div>
  );
}

function CheatsheetTab() {
  return (
    <div className="hg-content">
      <p className="hg-intro">A condensed ChoiceScript syntax reference. Useful when editing the Raw tab in the Inspector or writing preserved source.</p>

      <Section title="Top-level scene commands">
        <Row label="*title" desc="Project title. Goes in startup.txt." />
        <Row label="*author" desc="Author name. Goes in startup.txt." />
        <Row label="*scene_list" desc="Ordered list of scene file names. Determines *finish flow." />
        <Row label="*create var value" desc="Declares a global variable. Goes in startup.txt." />
        <Row label="*achievement id visible|hidden points Title" desc="Declares an achievement. Followed by 2 indented description lines." />
      </Section>

      <Section title="Variables & assignment">
        <Row label="*set var = value" desc="Assign a literal or expression." />
        <Row label="*set var + 5" desc="Increment by 5." />
        <Row label="*set var - 3" desc="Decrement by 3." />
        <Row label="*set var %+ 25" desc="Fairmath increase. Bigger values move slower, capped at 100." />
        <Row label="*set var %- 25" desc="Fairmath decrease. Bigger losses on high values." />
        <Row label="*temp var value" desc="Scene-local variable, cleared at scene end." />
      </Section>

      <Section title="Conditionals">
        <Row label="*if (expr)" desc="Branch if expr is true. Followed by indented body." />
        <Row label="*elseif (expr)" desc="Additional branch." />
        <Row label="*else" desc="Catch-all branch." />
        <Row label="*selectable_if (expr) #Option" desc="A choice option visible only if expr is true." />
        <Row label="*hide_reuse #Option" desc="Option text hides once chosen." />
        <Row label="*disable_reuse #Option" desc="Option text greys out once chosen." />
        <Row label="*allow_reuse #Option" desc="Default — option can be picked repeatedly." />
      </Section>

      <Section title="Operators (inside expressions)">
        <Row label="= < > <= >= !=" desc="Comparison." />
        <Row label="+ - * / modulo" desc="Arithmetic." />
        <Row label="& | ^" desc="String concat / OR comparison / XOR (rare)." />
        <Row label="and or not" desc="Boolean logic." />
        <Row label="true false" desc="Boolean literals." />
        <Row label="round(x) round_down(x) abs(x) length(x)" desc="Built-in functions." />
      </Section>

      <Section title="Choices & flow control">
        <Row label="*choice" desc="Player picks one option; each #Option below is followed by its branch body." />
        <Row label="*fake_choice" desc="Like *choice but all paths fall through to the same next node." />
        <Row label="*goto label" desc="Jump to a label in the same scene." />
        <Row label="*goto_scene name [label]" desc="Switch to another scene file." />
        <Row label="*gosub label" desc="Call a subroutine; resumes after *return." />
        <Row label="*gosub_scene name [label]" desc="Call a subroutine in another scene." />
        <Row label="*return" desc="End of subroutine — go back to the caller." />
        <Row label="*finish" desc="End scene, advance to next in *scene_list." />
        <Row label="*ending" desc="End the game entirely." />
      </Section>

      <Section title="Inputs">
        <Row label="*input_text var" desc="Free-text input from the player." />
        <Row label="*input_number var min max" desc="Number input with bounds." />
        <Row label="*rand var min max" desc="Random integer in range." />
      </Section>

      <Section title="Inline text features">
        <Row label="${var}" desc="Interpolate a variable into prose." />
        <Row label="@{var a|b|c}" desc="Pick from a list based on a number var (1=a, 2=b, …)." />
        <Row label="@{var a b}" desc="Pick a if var is true, b if false." />
        <Row label="*page_break Continue" desc="Insert a page break with a button label." />
        <Row label="*line_break" desc="Insert a line break inside a passage." />
      </Section>

      <Section title="Stats & UI">
        <Row label="*stat_chart" desc="Block in choicescript_stats.txt; lists stats to show on the stats screen." />
        <Row label="*image file align alt" desc="Show an image. align: none/left/right." />
        <Row label="*sound file" desc="Play a sound clip." />
        <Row label="*save_checkpoint name" desc="Save a restore point." />
        <Row label="*restore_checkpoint name" desc="Jump back to a checkpoint." />
        <Row label="*achieve id" desc="Unlock an achievement." />
      </Section>
    </div>
  );
}

function FaqTab() {
  return (
    <div className="hg-content">
      <Section title="Do I need to use *label nodes?">
        <p>Usually no. ChoiceForge auto-labels every node behind the scenes (<code>*label cf_n42</code>) so flow connections "just work" — the exported .txt has *goto cf_n42 lines that target the right place automatically.</p>
        <p><strong>Use a *label node when:</strong></p>
        <ul>
          <li>You're calling the node from <code>*gosub</code> or <code>*gosub_scene</code> — those require a named entry point.</li>
          <li>You imported existing ChoiceScript that uses *label and you want to preserve those names.</li>
          <li>You want the exported .txt to be human-readable at specific anchor points (instead of cf_n42).</li>
          <li>Multiple branches converge on the same node and you want a meaningful name in the export.</li>
        </ul>
        <p><strong>Don't add a *label node when:</strong> you're just connecting two nodes in sequence. A regular flow connection is cleaner and the linter will flag unused *labels.</p>
      </Section>

      <Section title="Why does the linter say my variable is undeclared?">
        <p>Every variable referenced in expressions or text needs to be declared via <code>*create</code> (in startup.txt) or <code>*temp</code> (inside a scene) before use. Open the Variables tab in the left panel to add a global variable, or drop a <code>*temp</code> node at the start of the scene for a scene-local one.</p>
      </Section>

      <Section title="My choice has only one option — is that wrong?">
        <p>Yes — the ChoiceScript runtime requires at least 2 options per <code>*choice</code>. The linter warns about this. If you only want to show a single piece of inline text after some choice-like UI, use <code>*fake_choice</code> with one option, or just a plain passage.</p>
      </Section>

      <Section title="What's the difference between *choice and *fake_choice?">
        <p><code>*choice</code>: the player picks one option, and each option leads to a different next node — real branching that changes the story.</p>
        <p><code>*fake_choice</code>: the player picks one option, each option shows inline text, then ALL paths fall through to the same next node. Use for flavor (what does the player notice? what do they say?) without real branching.</p>
      </Section>

      <Section title="Where is my work saved?">
        <p><strong>Web:</strong> autosaved to browser localStorage on every change. Closing the tab and reopening restores it. Export to .zip for portable backup.</p>
        <p><strong>Desktop (Tauri):</strong> autosaved both to localStorage (backup) AND to the .json file you opened (every 1.5 s after a change). A "●" appears in the window title while there are unsaved-to-disk changes; it clears once the autosave completes.</p>
      </Section>

      <Section title="How do I share a project with a co-author?">
        <p>Use Export (top bar) → ChoiceForge gives you a .zip with one .txt per scene plus a _choiceforge/project.json that preserves graph metadata. Hand the .zip to the co-author and they can import it back losslessly.</p>
      </Section>

      <Section title="Why doesn't my scene appear in the linter or play test?">
        <p>Scenes need to be listed in <code>*scene_list</code> in startup.txt — otherwise they're orphaned and never reached at runtime. Add the scene name to the scene list (Left panel → Scenes → drag to reorder, or edit Source tab on startup.txt directly).</p>
      </Section>

      <Section title="The Play button opens but nothing happens">
        <p>The embedded ChoiceScript runtime catches errors. Open browser devtools (F12) to see runtime errors. Most common: a *goto pointing at a non-existent label, or an undeclared variable in an expression. Run the linter (bottom panel) first — fix all errors before play-testing.</p>
      </Section>

      <Section title="Can I edit the raw .txt for a scene?">
        <p>Yes — click the Text Mode button in the top bar to open the CodeMirror editor for the current scene. Changes save back to the project. When a scene has imported source preserved, the canvas is read-only until you "Convert to visual editing" via the banner.</p>
      </Section>

      <Section title="My imported ChoiceScript looks weird in the graph">
        <p>The importer is pragmatic — common patterns (*choice, *if, *goto, *label, *set, etc.) become graph nodes, but unsupported structures (deeply nested inline conditionals, exotic *gosub patterns) are preserved as raw source so nothing is lost. You can keep editing in Text Mode, or rebuild that scene as a graph manually.</p>
      </Section>

      <Section title="What does '*finish' actually do?">
        <p>It ends the current scene and tells the runtime "go to the next scene in <code>*scene_list</code>". If there's no next scene, the game ends. Use <code>*ending</code> if you want to explicitly end the game regardless of scene order.</p>
      </Section>

      <Section title="Why are some of my nodes greyed out in the canvas?">
        <p>You've applied a tag filter (color-coded buttons under the canvas toolbar). Only nodes matching the active tags are highlighted; the rest dim. Click the active tag again to remove the filter, or use the × button.</p>
      </Section>
    </div>
  );
}

function InspectorTab() {
  return (
    <div className="hg-content">
      <Section title="Right panel">
        <Row label="Content tab" desc="Edit the node's main content: body text, choice options, condition expressions, variable assignments, and other type-specific fields." />
        <Row label="Logic tab" desc="Manage outgoing edges (flow connections). Add or remove edges between nodes. View and set the edge label." />
        <Row label="Raw tab" desc="Full CodeMirror editor showing the generated ChoiceScript for this node. Edits here are read-only — modify via Content or Logic tabs." />
      </Section>
      <Section title="Node status">
        <Row label="None" desc="Node is valid and has no issues." />
        <Row label="Todo" desc="Mark a node as still-to-write. Shown as a coloured badge." />
        <Row label="Done" desc="Node is finalized. Shown as a coloured badge." />
      </Section>
      <Section title="Color tags">
        <Row label="Six colors" desc="Red, orange, yellow, green, blue, purple. Tags a node's left border for visual organization. Filter by tag: on the canvas." />
        <Row label="Notes" desc="Free-text author notes attached to a node. Never exported to ChoiceScript output." />
      </Section>
      <Section title="Inline editing">
        <Row label="Title" desc="Double-click a node's title bar on the canvas to rename it in-place." />
        <Row label="Inspector" desc="Changes in the right panel take effect immediately — all mutations are tracked in undo history." />
      </Section>
    </div>
  );
}

function ProjectTab() {
  return (
    <div className="hg-content">
      <Section title="Suggested workflow">
        <Row label="1. Plan scene_list" desc="Start by listing your chapters/scenes in the Scenes tab. Order matters — *finish advances to the next in line." />
        <Row label="2. Declare variables" desc="Add the stats, flags, and counters you'll use BEFORE writing nodes that reference them — the linter will flag undeclared use." />
        <Row label="3. Sketch the graph" desc="Drop passages, choices, and finish nodes to outline each scene. Use color tags to mark unfinished sections." />
        <Row label="4. Fill in prose" desc="Use the inspector's Content tab. Body text supports ${var} and @{var a b} substitutions." />
        <Row label="5. Wire conditions & sets" desc="Add *if and *set nodes where the story branches on stats. Keep the linter open to catch typos in variable names." />
        <Row label="6. Playtest" desc="Click Play to run the actual ChoiceScript runtime on your project — catches issues no static linter can." />
        <Row label="7. Export" desc="When happy, Export gives you a .zip ready for upload." />
      </Section>
      <Section title="Scenes">
        <Row label="Scene list" desc="The Scenes tab in the left panel lists all scenes. Click to navigate. Drag to reorder." />
        <Row label="Add scene" desc="Click + in the Scenes panel header to add a new scene. Name must be a valid ChoiceScript identifier." />
        <Row label="startup.txt" desc="The first scene (marked with a star) is the startup file — it contains project-level *create commands and opening prose." />
        <Row label="choicescript_stats.txt" desc="The scene marked as Stats contains stat screen layout and conditionals." />
        <Row label="Delete scene" desc="Select a scene and press the trash icon. All nodes and edges in that scene are removed." />
      </Section>
      <Section title="Variables">
        <Row label="Variables tab" desc="Lists all global variables declared in the project. Filter, add, and delete from this panel." />
        <Row label="Types" desc="Variables can hold numbers (0–100), strings, or booleans. Type is inferred from the initial value." />
        <Row label="Fairmath" desc="%+ and %- operators apply fairmath: large values increase/decrease slowly; small values change quickly." />
      </Section>
      <Section title="Achievements">
        <Row label="Achievements tab" desc="Manage achievement IDs, titles, point values, and descriptions for *achievement declarations." />
        <Row label="Unlock" desc="Use an *achieve node in your graph to unlock an achievement by its ID at runtime." />
      </Section>
      <Section title="Assets">
        <Row label="Assets tab" desc="Register image and sound file names used by *image and *sound nodes. The linter warns on missing or duplicate asset names." />
      </Section>
      <Section title="Search & replace">
        <Row label="Ctrl+Shift+F" desc="Opens global search across all node content in the current scene." />
        <Row label="Ctrl+H" desc="Opens find & replace panel. Supports plain text and scope options." />
      </Section>
      <Section title="Dashboard">
        <Row label="Stats view" desc="Switch to stats view from the top bar to see word counts, node counts, and per-scene metrics." />
        <Row label="Word goals" desc="Set a word goal for the project or per scene. Progress is shown as a bar." />
      </Section>
    </div>
  );
}

function ImportExportTab() {
  return (
    <div className="hg-content">
      <Section title="Import">
        <Row label=".json" desc="Native ChoiceForge project file. Full fidelity — all nodes, edges, metadata, and canvas positions." />
        <Row label=".txt" desc="Raw ChoiceScript scene file. The importer parses *label, *choice, *if, *set, *goto, *gosub, *finish, and more into graph nodes." />
        <Row label=".zip" desc="Zip archive containing multiple .txt scene files. Imports an entire project at once, creating one scene per file." />
        <Row label="Folder" desc="Use the Folder button to pick a directory — all .txt files inside are imported as scenes." />
      </Section>
      <Section title="Source preservation">
        <Row label="What it is" desc="When a scene is imported from .txt, the original source text is preserved alongside the graph. A banner appears at the top of the canvas." />
        <Row label="Read-only mode" desc="While source is preserved, the canvas is read-only. You cannot add, delete, or move nodes." />
        <Row label="Convert to visual" desc="Click 'Convert to Visual' in the banner or Source tab to discard the source text and switch to the full visual editor." />
      </Section>
      <Section title="Export">
        <Row label="Export button" desc="Downloads a .zip containing all generated ChoiceScript .txt files ready for upload to dashingdon or the Choice of Games compiler." />
        <Row label="Ctrl+S / Save" desc="Saves the project to browser localStorage (web) or to the open .json file (desktop, debounced 1.5s autosave too)." />
        <Row label="Snapshots" desc="Named project restore points saved to localStorage. Use Snapshots → Save to create one and Restore to revert." />
      </Section>
      <Section title="Linter">
        <Row label="Lint console" desc="The bottom bar shows all lint errors and warnings. Click any issue to navigate to the offending node." />
        <Row label="Error types" desc="Missing *goto targets, undefined variables, duplicate labels, unreachable nodes, invalid *achieve IDs, and more." />
        <Row label="Export with errors" desc="You can still export with lint errors — a confirmation dialog warns you first." />
      </Section>
    </div>
  );
}

function ShortcutsTab() {
  return (
    <div className="hg-content">
      <div className="hg-shortcut-grid">
        {SHORTCUT_GROUPS.map((group) => (
          <div className="hg-sgroup" key={group.title}>
            <div className="hg-sgroup-title">{group.title}</div>
            {group.shortcuts.map((s) => (
              <div className="hg-srow" key={s.label}>
                <span className="hg-skeys">
                  {s.keys.map((k, i) => (
                    <span key={i}>{i > 0 && <span className="hg-splus">+</span>}<kbd className="hg-skey">{k}</kbd></span>
                  ))}
                </span>
                <span className="hg-slabel">{s.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
