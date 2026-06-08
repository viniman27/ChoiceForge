import type { Language, StoryEdge, StoryNode } from "../domain/types";

export interface NodeTemplate {
  id: string;
  category: "logic" | "choice" | "stat" | "achievement" | "flow";
  /** Short label per language. */
  label: Record<Language, string>;
  /** One-line description per language explaining what the template drops in. */
  description: Record<Language, string>;
  /** Comma-separated tags used by the palette's fuzzy search. */
  searchTags: string;
  /** Nodes with relative positions (anchored around 0,0). IDs use a "t" prefix; the paste flow re-IDs them. */
  nodes: StoryNode[];
  /** Internal edges between the template nodes (kind=flow|choice|...). */
  edges: StoryEdge[];
}

// Templates are intentionally English-only in the node bodies/titles to keep
// the data file manageable. The user can rename them after paste — every node
// has a generic prompt that hints at what to fill in.
// Positions are anchored loosely so the paste flow can recenter them on the
// current canvas viewport without overlapping existing content.

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: "skill_check",
    category: "logic",
    label: {
      pt: "Teste de habilidade",
      en: "Skill check",
      es: "Prueba de habilidad",
    },
    description: {
      pt: "*if comparando uma variavel a um limiar, com sucesso/falha — ambos convergem",
      en: "*if comparing a stat to a threshold, success/fail branches that converge",
      es: "*if comparando una variable con un umbral, ramas de exito/fracaso que convergen",
    },
    searchTags: "skill check if threshold stat test roll",
    nodes: [
      { id: "t1", type: "passage", x: 0, y: 0, w: 300, title: "setup", body: "Setup before the skill check." },
      { id: "t2", type: "if", x: 0, y: 160, w: 300, title: "*if (skill_var > 50)", branches: [
        { kind: "if", expr: "skill_var > 50", to: "t3" },
        { kind: "else", to: "t4" },
      ] },
      { id: "t3", type: "passage", x: -200, y: 320, w: 280, title: "success", body: "Success branch — describe the win." },
      { id: "t4", type: "passage", x: 200, y: 320, w: 280, title: "failure", body: "Failure branch — describe the cost." },
      { id: "t5", type: "passage", x: 0, y: 480, w: 320, title: "after", body: "Both paths converge here." },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "flow" },
      { from: "t2", to: "t3", kind: "if" },
      { from: "t2", to: "t4", kind: "else" },
      { from: "t3", to: "t5", kind: "flow" },
      { from: "t4", to: "t5", kind: "flow" },
    ],
  },
  {
    id: "achievement_unlock",
    category: "achievement",
    label: {
      pt: "Desbloquear conquista",
      en: "Unlock achievement",
      es: "Desbloquear logro",
    },
    description: {
      pt: "*achieve seguido de um passage explicando ao jogador o que acabou de acontecer",
      en: "*achieve followed by a passage telling the player what just happened",
      es: "*achieve seguido de un passage explicando al jugador lo que acaba de pasar",
    },
    searchTags: "achievement unlock badge reward",
    nodes: [
      { id: "t1", type: "achieve", x: 0, y: 0, w: 280, title: "*achieve my_achievement_id", target: "my_achievement_id" },
      { id: "t2", type: "passage", x: 0, y: 140, w: 300, title: "achievement_unlocked", body: "You unlocked something! Describe the celebration here." },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "flow" },
    ],
  },
  {
    id: "dialog_with_consequence",
    category: "choice",
    label: {
      pt: "Dialogo com consequencia",
      en: "Dialog with consequence",
      es: "Dialogo con consecuencia",
    },
    description: {
      pt: "*choice com 3 falas, cada uma muda uma variavel diferente",
      en: "*choice with 3 dialog options, each shifts a different stat",
      es: "*choice con 3 opciones de dialogo, cada una cambia una variable distinta",
    },
    searchTags: "dialog choice stat shift conversation",
    nodes: [
      { id: "t1", type: "passage", x: 0, y: 0, w: 320, title: "scene_setup", body: "The other character looks at you, waiting." },
      { id: "t2", type: "choice", x: 0, y: 160, w: 360, title: "what_do_you_say", prompt: "What do you say?", options: [
        { text: "Be honest.",   to: "t3", sets: [{ var: "honesty",  op: "+", val: "10" }] },
        { text: "Be cautious.", to: "t4", sets: [{ var: "caution",  op: "+", val: "10" }] },
        { text: "Be playful.",  to: "t5", sets: [{ var: "charisma", op: "+", val: "10" }] },
      ] },
      { id: "t3", type: "passage", x: -260, y: 360, w: 260, title: "honest_path",   body: "They respect your honesty." },
      { id: "t4", type: "passage", x: 0,    y: 360, w: 260, title: "cautious_path", body: "They appreciate your tact." },
      { id: "t5", type: "passage", x: 260,  y: 360, w: 260, title: "playful_path",  body: "They laugh at your joke." },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "flow" },
      { from: "t2", to: "t3", kind: "choice" },
      { from: "t2", to: "t4", kind: "choice" },
      { from: "t2", to: "t5", kind: "choice" },
    ],
  },
  {
    id: "combat_round",
    category: "stat",
    label: {
      pt: "Rodada de combate",
      en: "Combat round",
      es: "Ronda de combate",
    },
    description: {
      pt: "Combate basico: passage de inimigo + escolha (atacar/defender/fugir) + *rand pra hit/miss",
      en: "Basic combat: enemy passage + choice (attack/defend/flee) + *rand for hit/miss",
      es: "Combate basico: passage del enemigo + opcion (atacar/defender/huir) + *rand para acierto/fallo",
    },
    searchTags: "combat fight battle round attack defend rand random",
    nodes: [
      { id: "t1", type: "passage", x: 0, y: 0, w: 320, title: "enemy_appears", body: "An enemy blocks the path. They look dangerous." },
      { id: "t2", type: "choice", x: 0, y: 160, w: 320, title: "combat_choice", prompt: "What do you do?", options: [
        { text: "Attack.",  to: "t3" },
        { text: "Defend.",  to: "t4" },
        { text: "Flee.",    to: "t5" },
      ] },
      { id: "t3", type: "rand", x: -260, y: 320, w: 260, title: "*rand attack_roll 1 100", inputVar: "attack_roll", inputMin: "1", inputMax: "100" },
      { id: "t6", type: "if",   x: -260, y: 460, w: 260, title: "*if (attack_roll > 50)", branches: [
        { kind: "if",   expr: "attack_roll > 50", to: "t7" },
        { kind: "else", to: "t8" },
      ] },
      { id: "t7", type: "passage", x: -360, y: 620, w: 240, title: "hit",  body: "Your blow lands. Enemy is wounded." },
      { id: "t8", type: "passage", x: -160, y: 620, w: 240, title: "miss", body: "You miss. The enemy counters." },
      { id: "t4", type: "passage", x: 0,   y: 320, w: 240, title: "defend", body: "You brace for the blow." },
      { id: "t5", type: "passage", x: 260, y: 320, w: 240, title: "flee",   body: "You break for the exit." },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "flow" },
      { from: "t2", to: "t3", kind: "choice" },
      { from: "t2", to: "t4", kind: "choice" },
      { from: "t2", to: "t5", kind: "choice" },
      { from: "t3", to: "t6", kind: "flow" },
      { from: "t6", to: "t7", kind: "if" },
      { from: "t6", to: "t8", kind: "else" },
    ],
  },
  {
    id: "romance_beat",
    category: "stat",
    label: {
      pt: "Momento romantico",
      en: "Romance beat",
      es: "Momento romantico",
    },
    description: {
      pt: "*choice com 3 falas, cada uma muda uma variavel de fairmath (romance %)",
      en: "*choice with 3 dialog options, each fairmath-shifts a romance percentage",
      es: "*choice con 3 opciones de dialogo, cada una usa fairmath sobre un romance %",
    },
    searchTags: "romance love fairmath percent affection",
    nodes: [
      { id: "t1", type: "passage", x: 0, y: 0, w: 320, title: "intimate_moment", body: "The two of you are alone. The mood softens." },
      { id: "t2", type: "choice", x: 0, y: 160, w: 360, title: "respond_warmly", prompt: "How do you respond?", options: [
        { text: "Lean in close.",      to: "t3", sets: [{ var: "romance_them", op: "%+", val: "20" }] },
        { text: "Stay friendly.",      to: "t4", sets: [{ var: "romance_them", op: "%+", val: "5"  }] },
        { text: "Pull back politely.", to: "t5", sets: [{ var: "romance_them", op: "%-", val: "10" }] },
      ] },
      { id: "t3", type: "passage", x: -260, y: 360, w: 260, title: "they_warm",    body: "They smile, drawn closer." },
      { id: "t4", type: "passage", x: 0,    y: 360, w: 260, title: "they_friendly", body: "They nod, comfortable but reserved." },
      { id: "t5", type: "passage", x: 260,  y: 360, w: 260, title: "they_cool",    body: "They step back, respecting your boundary." },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "flow" },
      { from: "t2", to: "t3", kind: "choice" },
      { from: "t2", to: "t4", kind: "choice" },
      { from: "t2", to: "t5", kind: "choice" },
    ],
  },
  {
    id: "yes_no_fork",
    category: "flow",
    label: {
      pt: "Bifurcacao sim/nao",
      en: "Yes/no fork",
      es: "Bifurcacion si/no",
    },
    description: {
      pt: "Escolha binaria que NAO converge — dois caminhos longos diferentes",
      en: "Binary choice that does NOT converge — two different long paths forward",
      es: "Eleccion binaria que NO converge — dos caminos largos distintos hacia adelante",
    },
    searchTags: "fork branch binary yes no decision diverge",
    nodes: [
      { id: "t1", type: "choice", x: 0, y: 0, w: 320, title: "the_question", prompt: "Will you accept the offer?", options: [
        { text: "Yes — accept.", to: "t2" },
        { text: "No — refuse.",  to: "t3" },
      ] },
      { id: "t2", type: "passage", x: -200, y: 200, w: 280, title: "accept_path",  body: "You accept. A new road opens." },
      { id: "t3", type: "passage", x: 200,  y: 200, w: 280, title: "refuse_path",  body: "You refuse. A different road opens." },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "choice" },
      { from: "t1", to: "t3", kind: "choice" },
    ],
  },
];

/** Lookup helper for tests and palette filtering. */
export function findTemplate(id: string): NodeTemplate | undefined {
  return NODE_TEMPLATES.find((t) => t.id === id);
}
