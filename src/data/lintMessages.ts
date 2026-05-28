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
    pt: "*label \"{name}\" nunca referenciado — se for so um alvo de flow, voce pode deletar o *label; conexoes de flow funcionam sem label explicito",
    es: "*label \"{name}\" nunca referenciado — si solo es un destino de flow, puedes borrar el *label; las conexiones de flow funcionan sin un label explicito",
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
  set_no_assignments: {
    pt: "no *set \"{name}\" nao tem atribuicoes",
    es: "nodo *set \"{name}\" no tiene asignaciones",
  },
  if_noop: {
    pt: "todos os ramos de *if \"{name}\" levam ao mesmo no do caminho falso — condicao e redundante",
    es: "todas las ramas de *if \"{name}\" llevan al mismo nodo del camino falso — condicion es redundante",
  },
  goto_scene_no_target: {
    pt: "*goto_scene precisa de uma cena de destino",
    es: "*goto_scene necesita una escena de destino",
  },
  goto_scene_invalid_id: {
    pt: "*goto_scene tem identificador de cena invalido: {name}",
    es: "*goto_scene tiene identificador de escena invalido: {name}",
  },
  gosub_scene_no_target: {
    pt: "*gosub_scene precisa de uma cena de destino",
    es: "*gosub_scene necesita una escena de destino",
  },
  gosub_scene_invalid_id: {
    pt: "*gosub_scene tem identificador de cena invalido: {name}",
    es: "*gosub_scene tiene identificador de escena invalido: {name}",
  },
  gosub_scene_entry_missing: {
    pt: "*gosub_scene: rotulo de entrada \"{label}\" nao encontrado na cena {scene}",
    es: "*gosub_scene: etiqueta de entrada \"{label}\" no encontrada en la escena {scene}",
  },
  gosub_scene_no_flow: {
    pt: "*gosub_scene nao tem continuacao de fluxo para o retorno",
    es: "*gosub_scene no tiene continuacion de flujo para el retorno",
  },
  image_no_filename: {
    pt: "*image precisa de um nome de arquivo",
    es: "*image necesita un nombre de archivo",
  },
  image_unsupported_ext: {
    pt: "*image referencia arquivo com extensao nao suportada: {name}",
    es: "*image referencia archivo con extension no soportada: {name}",
  },
  image_invalid_alignment: {
    pt: "*image tem alinhamento invalido: \"{val}\" — use none, left ou right",
    es: "*image tiene alineacion invalida: \"{val}\" — usa none, left o right",
  },
  sound_no_filename: {
    pt: "*sound precisa de um nome de arquivo",
    es: "*sound necesita un nombre de archivo",
  },
  sound_unsupported_ext: {
    pt: "*sound referencia arquivo com extensao nao suportada: {name}",
    es: "*sound referencia archivo con extension no soportada: {name}",
  },
  goto_no_target: {
    pt: "*goto precisa de um rotulo de destino",
    es: "*goto necesita una etiqueta de destino",
  },
  goto_invalid_id: {
    pt: "*goto tem identificador de rotulo invalido: {name}",
    es: "*goto tiene identificador de etiqueta invalido: {name}",
  },
  gosub_no_target: {
    pt: "*gosub precisa de um rotulo de destino",
    es: "*gosub necesita una etiqueta de destino",
  },
  gosub_invalid_id: {
    pt: "*gosub tem identificador de rotulo invalido: {name}",
    es: "*gosub tiene identificador de etiqueta invalido: {name}",
  },
  gosub_no_flow: {
    pt: "*gosub nao tem continuacao de fluxo para *return",
    es: "*gosub no tiene continuacion de flujo para *return",
  },
  return_no_gosub: {
    pt: "*return aparece em uma cena sem nos *gosub",
    es: "*return aparece en una escena sin nodos *gosub",
  },
  page_break_no_label: {
    pt: "*page_break precisa de um rotulo de botao",
    es: "*page_break necesita una etiqueta de boton",
  },
  checkpoint_no_name: {
    pt: "*save_checkpoint precisa de um nome de checkpoint",
    es: "*save_checkpoint necesita un nombre de checkpoint",
  },
  temp_invalid_id: {
    pt: "*temp tem identificador de variavel invalido: {name}",
    es: "*temp tiene identificador de variable invalido: {name}",
  },
  temp_no_initial: {
    pt: "*temp \"{name}\" nao tem valor inicial (padrao e 0)",
    es: "*temp \"{name}\" no tiene valor inicial (el valor predeterminado es 0)",
  },
  name_reserved: {
    pt: "nome \"{name}\" conflita com palavra reservada do ChoiceScript",
    es: "nombre \"{name}\" conflicta con palabra reservada de ChoiceScript",
  },
  params_no_names: {
    pt: "*params nao tem nomes de parametros",
    es: "*params no tiene nombres de parametros",
  },
  params_invalid_id: {
    pt: "*params tem identificador de parametro invalido: {name}",
    es: "*params tiene identificador de parametro invalido: {name}",
  },
  achieve_no_id: {
    pt: "*achieve precisa de um id de conquista",
    es: "*achieve necesita un id de logro",
  },
  achieve_invalid_id: {
    pt: "*achieve tem identificador de conquista invalido: {name}",
    es: "*achieve tiene identificador de logro invalido: {name}",
  },
  label_no_name: {
    pt: "*label precisa de um nome",
    es: "*label necesita un nombre",
  },
  label_invalid_id: {
    pt: "*label tem identificador invalido: {name}",
    es: "*label tiene identificador invalido: {name}",
  },
  temp_repeat: {
    pt: "variavel local redeclarada: {name}",
    es: "variable local redeclarada: {name}",
  },
  set_invalid_id: {
    pt: "*set tem identificador de variavel invalido: {name}",
    es: "*set tiene identificador de variable invalido: {name}",
  },
  set_empty_value: {
    pt: "*set sem valor para: {name}",
    es: "*set sin valor para: {name}",
  },
  set_invalid_op: {
    pt: "*set {name} usa operador invalido para {type}: {op}",
    es: "*set {name} usa operador invalido para {type}: {op}",
  },
  set_fairmath_nopercent: {
    pt: "*set {name} usa fairmath sem formato percent",
    es: "*set {name} usa fairmath sin formato percent",
  },
  scene_empty_name: {
    pt: "cena tem nome vazio",
    es: "la escena tiene nombre vacio",
  },
  scene_invalid_id: {
    pt: "cena tem identificador invalido: {name}",
    es: "la escena tiene identificador invalido: {name}",
  },
  var_empty_name: {
    pt: "variavel tem nome vazio",
    es: "la variable tiene nombre vacio",
  },
  var_invalid_id: {
    pt: "variavel tem identificador invalido: {name}",
    es: "la variable tiene identificador invalido: {name}",
  },
  var_empty_initial: {
    pt: "variavel \"{name}\" tem valor inicial vazio",
    es: "la variable \"{name}\" tiene valor inicial vacio",
  },
  var_invalid_initial: {
    pt: "variavel \"{name}\" tem valor inicial invalido para {type}: {val}",
    es: "la variable \"{name}\" tiene valor inicial invalido para {type}: {val}",
  },
  ach_empty_id: {
    pt: "conquista tem id vazio",
    es: "el logro tiene id vacio",
  },
  ach_invalid_id: {
    pt: "conquista tem identificador invalido: {name}",
    es: "el logro tiene identificador invalido: {name}",
  },
  ach_empty_title: {
    pt: "conquista \"{name}\" tem titulo vazio",
    es: "el logro \"{name}\" tiene titulo vacio",
  },
  ach_empty_locked_desc: {
    pt: "conquista \"{name}\" tem descricao bloqueada vazia",
    es: "el logro \"{name}\" tiene descripcion bloqueada vacia",
  },
  ach_empty_unlocked_desc: {
    pt: "conquista \"{name}\" tem descricao desbloqueada vazia",
    es: "el logro \"{name}\" tiene descripcion desbloqueada vacia",
  },
  ach_invalid_points: {
    pt: "conquista \"{name}\" tem pontos invalidos",
    es: "el logro \"{name}\" tiene puntos invalidos",
  },
  asset_empty_path: {
    pt: "asset \"{name}\" tem caminho vazio",
    es: "el asset \"{name}\" tiene ruta vacia",
  },
  asset_unsafe_path: {
    pt: "asset \"{name}\" tem caminho de exportacao inseguro",
    es: "el asset \"{name}\" tiene ruta de exportacion insegura",
  },
  asset_path_conflict: {
    pt: "asset \"{name}\" tem caminho que conflita com arquivo gerado",
    es: "el asset \"{name}\" tiene ruta que conflicta con archivo generado",
  },
  asset_data_issue: {
    pt: "asset \"{name}\" tem problema nos dados",
    es: "el asset \"{name}\" tiene problema en los datos",
  },
  input_invalid_id: {
    pt: "identificador de variavel invalido: {name}",
    es: "identificador de variable invalido: {name}",
  },
  input_text_needs_string: {
    pt: "*input_text requer variavel do tipo texto: {name}",
    es: "*input_text requiere variable de tipo texto: {name}",
  },
  input_needs_number: {
    pt: "comando requer variavel numerica: {name}",
    es: "el comando requiere variable numerica: {name}",
  },
  input_empty_min: {
    pt: "limite minimo vazio",
    es: "limite minimo vacio",
  },
  input_empty_max: {
    pt: "limite maximo vazio",
    es: "limite maximo vacio",
  },
  input_invalid_min: {
    pt: "limite minimo invalido: {val}",
    es: "limite minimo invalido: {val}",
  },
  input_invalid_max: {
    pt: "limite maximo invalido: {val}",
    es: "limite maximo invalido: {val}",
  },
  input_bounds_order: {
    pt: "limite minimo ({min}) e maior que o maximo ({max})",
    es: "limite minimo ({min}) es mayor que el maximo ({max})",
  },
  label_node_empty: {
    pt: "no *label \"{name}\" tem rotulo vazio",
    es: "nodo *label \"{name}\" tiene etiqueta vacia",
  },
  label_collision: {
    pt: "*label \"{name}\" conflita com rotulo gerado pelo ChoiceForge",
    es: "*label \"{name}\" conflicta con etiqueta generada por ChoiceForge",
  },
  choice_single_option: {
    pt: "no *choice \"{name}\" tem apenas uma opcao — ChoiceScript requer pelo menos duas",
    es: "nodo *choice \"{name}\" tiene solo una opcion — ChoiceScript requiere al menos dos",
  },
  option_empty: {
    pt: "opcao #{num} esta vazia em \"{name}\"",
    es: "opcion #{num} esta vacia en \"{name}\"",
  },
  option_missing_target: {
    pt: "opcao #{num} aponta para no inexistente em \"{name}\"",
    es: "opcion #{num} apunta a nodo inexistente en \"{name}\"",
  },
  option_self_loop: {
    pt: "opcao #{num} volta para o proprio no *choice em \"{name}\"",
    es: "opcion #{num} vuelve al propio nodo *choice en \"{name}\"",
  },
  choice_all_same_target: {
    pt: "todas as opcoes de *choice \"{name}\" levam ao mesmo no — considere simplificar",
    es: "todas las opciones de *choice \"{name}\" llevan al mismo nodo — considera simplificar",
  },
  if_must_start_if: {
    pt: "no *if \"{name}\" deve comecar com um ramo *if",
    es: "nodo *if \"{name}\" debe comenzar con una rama *if",
  },
  if_branch_after_else: {
    pt: "no *if \"{name}\" tem ramo depois do *else",
    es: "nodo *if \"{name}\" tiene rama despues del *else",
  },
  if_multiple_else: {
    pt: "no *if \"{name}\" tem multiplos ramos *else",
    es: "nodo *if \"{name}\" tiene multiples ramas *else",
  },
  if_else_has_cond: {
    pt: "ramo *else nao pode ter condicao",
    es: "rama *else no puede tener condicion",
  },
  if_branch_no_cond: {
    pt: "ramo *{kind} precisa de uma condicao",
    es: "rama *{kind} necesita una condicion",
  },
  if_branch_missing_target: {
    pt: "ramo *{kind} aponta para no inexistente",
    es: "rama *{kind} apunta a nodo inexistente",
  },
  if_branch_self_loop: {
    pt: "ramo *{kind} volta para o proprio no *if",
    es: "rama *{kind} vuelve al propio nodo *if",
  },
  if_all_same_target: {
    pt: "todos os ramos de *if \"{name}\" levam ao mesmo no — considere simplificar",
    es: "todas las ramas de *if \"{name}\" llevan al mismo nodo — considera simplificar",
  },
  cond_empty: {
    pt: "condicao de *{command} esta vazia",
    es: "la condicion de *{command} esta vacia",
  },
  startup_empty_title: {
    pt: "startup.txt tem *title vazio",
    es: "startup.txt tiene *title vacio",
  },
  startup_empty_author: {
    pt: "startup.txt tem *author vazio",
    es: "startup.txt tiene *author vacio",
  },
  scene_list_invalid_id: {
    pt: "*scene_list tem identificador de cena invalido: {name}",
    es: "*scene_list tiene identificador de escena invalido: {name}",
  },
  scene_list_repeat: {
    pt: "*scene_list repete cena: {name}",
    es: "*scene_list repite escena: {name}",
  },
  scene_list_missing_scene: {
    pt: "*scene_list aponta para cena inexistente: {name}",
    es: "*scene_list apunta a escena inexistente: {name}",
  },
  startup_needs_scene_list: {
    pt: "startup.txt precisa de um *scene_list",
    es: "startup.txt necesita un *scene_list",
  },
  scene_list_omits_scene: {
    pt: "*scene_list omite cena do projeto: {name}",
    es: "*scene_list omite escena del proyecto: {name}",
  },
  startup_omits_var: {
    pt: "startup.txt omite variavel do projeto: {name}",
    es: "startup.txt omite variable del proyecto: {name}",
  },
  startup_omits_ach: {
    pt: "startup.txt omite conquista do projeto: {name}",
    es: "startup.txt omite logro del proyecto: {name}",
  },
  create_invalid_id: {
    pt: "*create tem identificador de variavel invalido: {name}",
    es: "*create tiene identificador de variable invalido: {name}",
  },
  create_reserved: {
    pt: "*create usa palavra reservada do ChoiceScript: {name}",
    es: "*create usa palabra reservada de ChoiceScript: {name}",
  },
  create_empty_value: {
    pt: "*create tem valor inicial vazio: {name}",
    es: "*create tiene valor inicial vacio: {name}",
  },
  create_invalid_value: {
    pt: "*create {name} tem valor inicial {type} invalido: {value}",
    es: "*create {name} tiene valor inicial {type} invalido: {value}",
  },
  create_repeat: {
    pt: "startup.txt repete *create para variavel: {name}",
    es: "startup.txt repite *create para variable: {name}",
  },
  create_extra_var: {
    pt: "*create declara variavel ausente nos metadados do projeto: {name}",
    es: "*create declara variable ausente en los metadatos del proyecto: {name}",
  },
  ach_src_invalid_id: {
    pt: "*achievement tem identificador invalido: {name}",
    es: "*achievement tiene identificador invalido: {name}",
  },
  ach_invalid_vis: {
    pt: "*achievement tem visibilidade invalida: {value}",
    es: "*achievement tiene visibilidad invalida: {value}",
  },
  ach_invalid_points_src: {
    pt: "*achievement tem pontos invalidos: {value}",
    es: "*achievement tiene puntos invalidos: {value}",
  },
  ach_src_empty_title: {
    pt: "*achievement tem titulo vazio: {name}",
    es: "*achievement tiene titulo vacio: {name}",
  },
  ach_src_repeat: {
    pt: "startup.txt repete *achievement: {name}",
    es: "startup.txt repite *achievement: {name}",
  },
  ach_src_extra: {
    pt: "*achievement declara conquista ausente nos metadados do projeto: {name}",
    es: "*achievement declara logro ausente en los metadatos del proyecto: {name}",
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
