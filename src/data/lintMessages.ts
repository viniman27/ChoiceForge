import type { Language } from "../domain/types";

type LintTranslations = Record<string, Record<Exclude<Language, "en">, string>>;

export const lintMessages: LintTranslations = {
  project_empty_title: {
    pt: "titulo do projeto esta vazio",
    es: "el titulo del proyecto esta vacio",
  },
  project_empty_author: {
    pt: "autor do projeto esta vazio",
    es: "el autor del proyecto esta vacio",
  },
  orphan_node: {
    pt: "no isolado — nao acessivel a partir do inicio da cena",
    es: "nodo huerfano — no accesible desde el inicio de la escena",
  },
  dead_end: {
    pt: "no sem saida — sem conexao de saida",
    es: "nodo sin salida — sin conexion de salida",
  },
  empty_choice: {
    pt: "*choice sem opcoes",
    es: "*choice sin opciones",
  },
  empty_fake_choice: {
    pt: "*fake_choice sem opcoes",
    es: "*fake_choice sin opciones",
  },
  empty_if: {
    pt: "*if sem ramificacoes",
    es: "*if sin ramificaciones",
  },
  undef_var: {
    pt: "variavel nao declarada: {name}",
    es: "variable no declarada: {name}",
  },
  temp_shadows: {
    pt: "*temp oculta variavel global: {name}",
    es: "*temp oculta variable global: {name}",
  },
  undef_ach: {
    pt: "conquista nao declarada: {name}",
    es: "logro no declarado: {name}",
  },
  goto_missing_label: {
    pt: "*goto aponta para rotulo inexistente: {name}",
    es: "*goto apunta a etiqueta inexistente: {name}",
  },
  gosub_missing_label: {
    pt: "*gosub aponta para rotulo inexistente: {name}",
    es: "*gosub apunta a etiqueta inexistente: {name}",
  },
  duplicate_label: {
    pt: "*label duplicado: {name}",
    es: "*label duplicada: {name}",
  },
  goto_scene_missing: {
    pt: "*goto_scene aponta para cena inexistente: {name}",
    es: "*goto_scene apunta a escena inexistente: {name}",
  },
  scene_unreachable: {
    pt: "cena sem conexoes de entrada",
    es: "escena sin conexiones de entrada",
  },
  image_unknown: {
    pt: "*image referencia arquivo desconhecido: {name}",
    es: "*image referencia archivo desconocido: {name}",
  },
  stat_undef_var: {
    pt: "*stat_chart usa variavel nao declarada: {name}",
    es: "*stat_chart usa variable no declarada: {name}",
  },
  rand_same_bounds: {
    pt: "*rand produz sempre o mesmo valor (min = max = {val})",
    es: "*rand siempre produce el mismo valor (min = max = {val})",
  },
  empty_passage_body: {
    pt: "passagem sem texto de corpo",
    es: "pasaje sin texto de cuerpo",
  },
  unused_temp: {
    pt: "*temp declarado mas nunca lido nesta cena: {name}",
    es: "*temp declarado pero nunca leido en esta escena: {name}",
  },
  restore_no_save: {
    pt: "*restore_checkpoint nao encontra *save_checkpoint correspondente no projeto: {name}",
    es: "*restore_checkpoint no encuentra *save_checkpoint correspondiente en el proyecto: {name}",
  },
  fairmath_range: {
    pt: "variavel fairmath com valor inicial fora de 0–100: {name}",
    es: "variable fairmath con valor inicial fuera de 0–100: {name}",
  },
};

export function translateLintMsg(
  key: string | undefined,
  params: Record<string, string> | undefined,
  fallback: string,
  lang: Language,
): string {
  if (!key || lang === "en") return fallback;
  const tpl = lintMessages[key]?.[lang as Exclude<Language, "en">];
  if (!tpl) return fallback;
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "");
}
