import { useEffect, useState } from "react";
import { NodeIcon, typeColors } from "./NodeCard";
import type { NodeType } from "../domain/types";

type HelpTab = "canvas" | "nodes" | "inspector" | "project" | "importexport" | "shortcuts";

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
  desc: string;
}

const NODE_ENTRIES: NodeEntry[] = [
  { type: "passage",            desc: "Narrative text. Supports ${var} interpolation and @{var a b} conditional inline text." },
  { type: "choice",             desc: "Player choice menu. Each option connects to a child node. Supports reuse and conditions per option." },
  { type: "fake_choice",        desc: "Cosmetic choice that shows all branches sequentially — no real branching, purely cosmetic." },
  { type: "if",                 desc: "Conditional branch with *if / *elseif / *else arms. Each arm connects to a child node." },
  { type: "set",                desc: "Assigns or modifies a variable. Operators: = + - *= / %+ %- (fairmath)." },
  { type: "temp",               desc: "Declares a temporary variable local to the current scene. Cleared when the scene ends." },
  { type: "label",              desc: "Named anchor inside a scene. Used as a target for *goto and *gosub jumps." },
  { type: "goto",               desc: "Unconditional jump to a *label within the current scene." },
  { type: "goto_scene",         desc: "Jump to another scene (no return). Optionally targets a label inside that scene." },
  { type: "gosub",              desc: "Calls a subroutine at a *label in the current scene. Resumes after *return." },
  { type: "gosub_scene",        desc: "Calls a subroutine in another scene. Optionally specifies an entry label. Resumes on *return." },
  { type: "return",             desc: "Returns from a *gosub or *gosub_scene call back to the original call site." },
  { type: "finish",             desc: "Ends the current scene and advances to the next scene listed in scene_list." },
  { type: "ending",             desc: "Ends the game entirely (*ending). Typically the final node in a story path." },
  { type: "checkpoint",         desc: "Saves the current game state to a named slot (*save_checkpoint)." },
  { type: "restore_checkpoint", desc: "Restores a previously saved checkpoint (*restore_checkpoint)." },
  { type: "page_break",         desc: "Inserts a page break with a configurable button label (*page_break)." },
  { type: "input_text",         desc: "Prompts the player to enter a text string, stored in a variable (*input_text)." },
  { type: "input_number",       desc: "Prompts the player to enter a number within min/max bounds (*input_number)." },
  { type: "rand",               desc: "Assigns a random integer within a range to a variable (*rand)." },
  { type: "image",              desc: "Displays an image file. Supports alignment (none / left / right) and alt text (*image)." },
  { type: "sound",              desc: "Plays an audio file (*sound)." },
  { type: "params",             desc: "Declares parameter names for a gosub subroutine (*params). Must appear at the subroutine entry." },
  { type: "achieve",            desc: "Unlocks a defined achievement by its ID (*achieve)." },
  { type: "comment",            desc: "Author note. Never exported as ChoiceScript text — for documentation only." },
];

interface HelpGuideProps {
  onClose: () => void;
}

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
          {(["canvas", "nodes", "inspector", "project", "importexport", "shortcuts"] as HelpTab[]).map((t) => (
            <button key={t} className={`hg-tab ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
              {t === "importexport" ? "Import / Export" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="hg-body">
          {tab === "canvas" && <CanvasTab />}
          {tab === "nodes" && <NodesTab />}
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
      <p className="hg-intro">All 24 node types available in ChoiceForge. Each corresponds to one or more ChoiceScript commands.</p>
      <div className="hg-node-grid">
        {NODE_ENTRIES.map(({ type, desc }) => {
          const color = typeColors[type];
          return (
            <div key={type} className="hg-node-entry">
              <div className="hg-node-icon" style={{ background: color.tint, color: color.dot }}>
                <NodeIcon type={type} />
              </div>
              <div className="hg-node-info">
                <span className="hg-node-name" style={{ color: color.dot }}>{color.label}</span>
                <span className="hg-node-desc">{desc}</span>
              </div>
            </div>
          );
        })}
      </div>
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
        <Row label="Draft" desc="Mark a node as a work-in-progress. Shown as a grey badge." />
        <Row label="Review" desc="Needs review before publishing. Shown as an amber badge." />
        <Row label="Done" desc="Node is finalized. Shown as a green badge." />
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
        <Row label="Ctrl+S / Save" desc="Saves the project to browser localStorage. Also triggers an export download." />
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
