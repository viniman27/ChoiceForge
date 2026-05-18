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
    pt: "no \"{name}\" isolado — nao acessivel a partir do inicio da cena",
    es: "nodo \"{name}\" huerfano — no accesible desde el inicio de la escena",
  },
  dead_end: {
    pt: "no \"{name}\" sem saida — sem conexao de saida",
    es: "nodo \"{name}\" sin salida — sin conexion de salida",
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
  gosub_scene_missing: {
    pt: "*gosub_scene aponta para cena inexistente: {name}",
    es: "*gosub_scene apunta a escena inexistente: {name}",
  },
  scene_unreachable: {
    pt: "cena \"{name}\" sem conexoes de entrada de outras cenas",
    es: "escena \"{name}\" sin conexiones de entrada de otras escenas",
  },
  image_unknown: {
    pt: "*image referencia arquivo desconhecido: {name}",
    es: "*image referencia archivo desconocido: {name}",
  },
  sound_unknown: {
    pt: "*sound referencia arquivo desconhecido: {name}",
    es: "*sound referencia archivo desconocido: {name}",
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
    pt: "passagem \"{name}\" sem texto de corpo",
    es: "pasaje \"{name}\" sin texto de cuerpo",
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
  unused_var: {
    pt: "variavel \"{name}\" declarada mas nunca lida",
    es: "variable \"{name}\" declarada pero nunca leida",
  },
  unreferenced_label: {
    pt: "*label \"{name}\" nunca referenciado por *goto ou *gosub",
    es: "*label \"{name}\" nunca referenciado por *goto o *gosub",
  },
  gosub_no_return: {
    pt: "cena \"{name}\" tem nos *gosub mas nenhum no *return",
    es: "escena \"{name}\" tiene nodos *gosub pero ningun nodo *return",
  },
  gosub_scene_no_return: {
    pt: "*gosub_scene chama cena \"{name}\" que nao tem *return",
    es: "*gosub_scene llama a escena \"{name}\" que no tiene *return",
  },
  passage_too_long: {
    pt: "passagem \"{name}\" e muito longa ({wc} palavras)",
    es: "pasaje \"{name}\" es muy largo ({wc} palabras)",
  },
  duplicate_scene_name: {
    pt: "nome de cena duplicado: {name}",
    es: "nombre de escena duplicado: {name}",
  },
  duplicate_var_name: {
    pt: "nome de variavel duplicado: {name}",
    es: "nombre de variable duplicado: {name}",
  },
  duplicate_ach_id: {
    pt: "id de conquista duplicado: {name}",
    es: "id de logro duplicado: {name}",
  },
  duplicate_asset_id: {
    pt: "id de asset duplicado: {name}",
    es: "id de asset duplicado: {name}",
  },
  duplicate_asset_path: {
    pt: "caminho de asset duplicado: {name}",
    es: "ruta de asset duplicada: {name}",
  },
  duplicate_exported_asset: {
    pt: "caminho de asset exportado duplicado: {name}",
    es: "ruta de asset exportado duplicada: {name}",
  },
  duplicate_params: {
    pt: "*params tem parametro duplicado: {name}",
    es: "*params tiene parametro duplicado: {name}",
  },
  duplicate_option_text: {
    pt: "texto de opcao duplicado \"{text}\" em \"{title}\"",
    es: "texto de opcion duplicado \"{text}\" en \"{title}\"",
  },
  stat_chart_invalid_type: {
    pt: "*stat_chart tem tipo de linha invalido: {type}",
    es: "*stat_chart tiene tipo de fila invalido: {type}",
  },
  stat_chart_invalid_var: {
    pt: "*stat_chart tem identificador de variavel invalido: {name}",
    es: "*stat_chart tiene identificador de variable invalido: {name}",
  },
  stat_chart_needs_number: {
    pt: "*stat_chart {type} requer variavel numerica: {name}",
    es: "*stat_chart {type} requiere variable numerica: {name}",
  },
  stat_chart_nonpercent: {
    pt: "*stat_chart percent usa variavel numerica sem formato percent: {name}",
    es: "*stat_chart percent usa variable numerica sin formato percent: {name}",
  },
  stat_chart_raw_number: {
    pt: "*stat_chart text exibe {name} como numero bruto — use percent ou opposed_pair para barra",
    es: "*stat_chart text muestra {name} como numero bruto — usa percent u opposed_pair para barra",
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
