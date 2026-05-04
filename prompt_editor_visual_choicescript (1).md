# Prompt: Editor Visual Desktop para ChoiceScript (estilo Twine)

## 1. Contexto e Visão do Produto

Quero que você projete e implemente uma **aplicação desktop multiplataforma (Windows, macOS, Linux)** chamada provisoriamente **"ChoiceForge"** (sinta-se livre para sugerir outro nome), cujo propósito é ser o **melhor editor visual existente para histórias interativas escritas em ChoiceScript**.

A aplicação deve ser para o ChoiceScript o que o **Twine** (https://twinery.org) é para histórias hipertextuais: uma ferramenta visual, baseada em nós, que permite a um autor — mesmo sem experiência em programação — escrever, organizar, testar, depurar e exportar um jogo de ficção interativa **completo, de ponta a ponta**, sem precisar tocar em arquivos `.txt` manualmente (mas com a opção de fazê-lo quando quiser).

**Referências obrigatórias de leitura antes de começar:**
- Repositório oficial: https://github.com/dfabulich/choicescript
- Introdução oficial: https://www.choiceofgames.com/make-your-own-games/choicescript-intro/
- Comandos importantes: https://www.choiceofgames.com/make-your-own-games/important-choicescript-commands-and-techniques/
- Tela de stats: https://www.choiceofgames.com/make-your-own-games/customizing-the-choicescript-stats-screen/
- ChoiceScript avançado: https://www.choiceofgames.com/make-your-own-games/choicescript-advanced/
- Testes automatizados: https://www.choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically/
- Exportação e publicação: https://www.choiceofgames.com/make-your-own-games/exporting-and-publishing-your-game/

A aplicação deve gerar arquivos **100% compatíveis com o runtime oficial do ChoiceScript**, prontos para serem hospedados pela Choice of Games ou exportados como HTML autônomo.

---

## 2. Pilha Tecnológica Sugerida (justifique se mudar)

- **Framework:** Tauri (preferencial, por leveza) ou Electron como alternativa.
- **Frontend:** React + TypeScript + Vite.
- **Editor de grafo / nós:** React Flow (xyflow) ou Rete.js.
- **Editor de texto embutido nos nós:** CodeMirror 6 ou Monaco, com **highlight customizado de sintaxe ChoiceScript**.
- **Persistência:** projeto salvo como diretório no disco (estrutura idêntica à pasta `web/mygame/` do ChoiceScript), mais um arquivo `project.json` com metadados visuais (posições dos nós, cores, tags, anotações do autor).
- **Estado global:** Zustand ou Redux Toolkit.
- **Testes:** Vitest + Playwright para E2E.
- **Empacotamento:** instaladores para `.exe`, `.dmg` e `.AppImage`/`.deb`.

---

## 3. Conceitos do ChoiceScript que o Editor DEVE Modelar

A aplicação precisa entender e renderizar **todos** os comandos da linguagem. Lista mínima e não-negociável:

### 3.1 Estrutura geral
- `*title`, `*author`, `*ifid` (com geração automática de IFID).
- `*scene_list` — gerenciado visualmente (ordem das cenas, drag-and-drop).
- Cenas = arquivos `.txt` separados na pasta `mygame/`. **Codificação obrigatória: UTF-8** (preservar acentos `ñáéçãõ` corretamente).
- Indentação: a aplicação **gera indentação consistente automaticamente** (escolha do usuário entre espaços ou tabs no início do projeto, e impõe a regra durante todo o projeto — espaços e tabs não podem ser misturados no mesmo arquivo).

### 3.2 Fluxo
- `*choice` e `*fake_choice` com `#opções` aninhadas.
- `*goto`, `*label`, `*goto_scene`, `*finish`, `*ending`.
- `*page_break` (com texto customizado opcional do botão).
- `*gosub`, `*gosub_scene`, `*return` (subrotinas).
- `*save_checkpoint` / `*restore_checkpoint`.

### 3.3 Variáveis e lógica
- `*create` (somente no topo de `startup.txt`) e `*temp` (em qualquer cena).
- Tipos: número, texto (string), booleano (`true`/`false`).
- `*set` com operadores: `+`, `-`, `*`, `/`, parênteses obrigatórios para operações compostas.
- **Fairmath:** `%+` e `%-` (operadores percentuais 0–100).
- `*if`, `*elseif`, `*else` com operadores: `=`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`, `not` (com parênteses obrigatórios).
- Interpolação `${variavel}` no texto narrativo.
- Multireplace `@{variavel opção1|opção2|opção3}`, com suporte a expressões parentesadas.

### 3.4 Opções condicionais
- `*if (condição) #Opção` (esconde a opção).
- `*selectable_if (condição) #Opção` (mostra cinza/desabilitada).
- `*hide_reuse`, `*disable_reuse`, `*allow_reuse`.

### 3.5 Outros
- `*input_text` (com modificador `allow_blank`) e `*input_number`.
- `*image` com alinhamento (`left`, `right`, `none`) e texto alternativo para acessibilidade.
- `*comment` (anotações do autor que não aparecem no jogo).
- `*achievement` e `*achieve` (sistema de conquistas).
- `*stat_chart` na tela de stats (text, percent, opposed_pair).
- `*rand` para números aleatórios.

---

## 4. Interface do Usuário — Especificação Detalhada

### 4.1 Layout principal (3 painéis)

```
┌─────────────────┬─────────────────────────────────┬─────────────────┐
│                 │                                 │                 │
│  PAINEL         │   CANVAS DE GRAFO               │  PAINEL         │
│  ESQUERDO       │   (área principal)              │  DIREITO        │
│                 │                                 │                 │
│  - Cenas        │   - Nós (passages/labels)       │  - Inspetor do  │
│  - Variáveis    │   - Conexões (gotos, choices)   │    nó           │
│    globais      │   - Minimapa                    │    selecionado  │
│  - Achievements │   - Zoom / pan                  │  - Editor de    │
│  - Assets       │   - Auto-layout                 │    texto rico   │
│  - Busca global │                                 │  - Validação    │
│                 │                                 │                 │
└─────────────────┴─────────────────────────────────┴─────────────────┘
                  │                                 │
                  │  BARRA INFERIOR                 │
                  │  - Console de erros / warnings  │
                  │  - Status (autosave, encoding)  │
                  └─────────────────────────────────┘
```

### 4.2 Canvas de Grafo (o coração da aplicação)

Cada **nó** representa um trecho lógico da história. Tipos de nós com cores e ícones distintos:

| Tipo de nó             | O que contém                                      | Cor sugerida |
|------------------------|---------------------------------------------------|--------------|
| **Passage** (trecho)   | Texto narrativo entre comandos                    | Azul         |
| **Choice**             | Bloco `*choice` ou `*fake_choice` com #opções     | Roxo         |
| **Conditional**        | `*if` / `*elseif` / `*else`                       | Amarelo      |
| **Variable Set**       | Um ou mais `*set`                                 | Verde        |
| **Label**              | `*label` — alvo de `*goto`                        | Cinza        |
| **Goto / Goto Scene**  | Saltos                                            | Seta dourada |
| **Subroutine call**    | `*gosub` / `*gosub_scene` / `*return`             | Laranja      |
| **Scene transition**   | `*finish`                                          | Vermelho     |
| **Ending**             | `*ending` (Play Again)                            | Preto        |
| **Checkpoint**         | `*save_checkpoint` / `*restore_checkpoint`        | Ciano        |
| **Image / Page break** | `*image`, `*page_break`                           | Neutra       |

**Conexões (arestas):**
- Conexões de `*choice` saem de cada `#opção` e levam ao próximo nó.
- Conexões de `*goto` aparecem como **linhas tracejadas** distintas das de fluxo natural.
- Conexões para outras cenas (`*goto_scene`, `*gosub_scene`) aparecem com um ícone de "porta" e mostram a cena de destino na ponta.
- Setas com **rótulos editáveis** mostrando a condição (quando aplicável).

**Funcionalidades obrigatórias do canvas:**
- Auto-layout (força dirigida ou hierárquico) com botão "Reorganizar".
- Minimapa com a visão geral do grafo da cena atual.
- Zoom (Ctrl+roda do mouse) e pan (espaço + arrastar).
- Seleção múltipla, copiar/colar, agrupar nós em "regiões" coloridas com label.
- Busca dentro do grafo (Ctrl+F) que destaca e dá zoom no nó encontrado.
- **Detecção visual de problemas:**
  - Nós órfãos (sem ninguém apontando para eles) → contorno tracejado.
  - Nós sem saída (não terminam em `*finish`, `*goto`, `*goto_scene`, `*ending`) → contorno vermelho pulsante.
  - Labels referenciados que não existem → ícone de erro na conexão.
  - Variáveis usadas mas não criadas → sublinhado vermelho no inspetor.
- Comentários flutuantes (sticky notes) que o autor pode adicionar ao canvas, sem virar `*comment` no código.

### 4.3 Painel Esquerdo

**Aba "Cenas":**
- Lista todas as cenas (arquivos `.txt`).
- Drag-and-drop para reordenar a `*scene_list`.
- Botões: criar, renomear, duplicar, excluir cena.
- Indicador visual de qual cena é a `startup`.
- Indicador de cenas que NÃO estão na `*scene_list` (alcançáveis só via `*goto_scene`).

**Aba "Variáveis":**
- Tabela de todas as variáveis `*create`, com nome, tipo inferido (number/string/bool), valor inicial, descrição (campo livre do autor).
- Tabela separada para `*temp` (com a cena onde foram declaradas).
- Botão para adicionar variável (gera `*create` automaticamente em `startup.txt`).
- Coluna "usada em" com lista de cenas/nós que leem ou escrevem aquela variável (rastreabilidade reversa).

**Aba "Achievements":**
- Editor visual completo: ID, título, descrição pré e pós-conquista, pontos, visível/oculto.
- Gera os blocos `*achievement` corretos em `startup.txt`.

**Aba "Stats Screen":**
- Editor WYSIWYG da `choicescript_stats.txt`.
- Adicionar barras de stat (`percent`), barras opostas (`opposed_pair`), texto (`text`), com pré-visualização ao vivo.

**Aba "Assets":**
- Imagens importadas para a pasta `mygame/`.
- Pré-visualização, dimensões, e botão "Inserir como `*image`" no nó selecionado.

**Busca global (Ctrl+Shift+F):**
- Busca em todos os textos, nomes de variáveis, labels, opções, em todas as cenas.
- Substituir em massa com pré-visualização das alterações.

### 4.4 Painel Direito (Inspetor)

Quando um nó é selecionado, mostra:
- Editor de texto rico para o conteúdo narrativo, com:
  - **Sintaxe highlight** para `${var}`, `@{...}`, `*comandos`.
  - **Autocompletar** nomes de variáveis, labels e cenas existentes.
  - Atalho para inserir `${variavel}` (Ctrl+Espaço lista as variáveis em escopo).
  - Validação em tempo real (variável não criada, label inexistente).
- Para nós `*choice`: tabela editável de #opções com colunas para condição (`*if` / `*selectable_if`), reuse (`*hide_reuse` / `*disable_reuse` / `*allow_reuse`), e destino.
- Para nós `*set`: construtor visual da expressão (não exige digitação manual da fórmula).
- Para nós `*if`: construtor visual de condições com seletor de variável + operador + valor, com suporte a `and`, `or`, `not` aninhados.
- Aba "Código" mostrando o ChoiceScript bruto que aquele nó gera (somente leitura ou editável, à escolha do usuário).

### 4.5 Modo "Texto Bruto" (alternativa ao visual)

Toggle por cena para alternar entre **modo grafo** e **modo texto** (editor CodeMirror em tela cheia da cena). Edições em qualquer modo refletem instantaneamente no outro (parser bidirecional).

---

## 5. Funcionalidades Robustas Esperadas

### 5.1 Parser e Linter
- Parser ChoiceScript completo, escrito em TypeScript, com AST navegável.
- Linter em tempo real reportando:
  - Indentação inconsistente.
  - Variáveis não criadas, labels inexistentes, cenas referenciadas inexistentes.
  - Caminhos sem `*finish` / `*goto` / `*goto_scene` / `*ending`.
  - Opções de `*choice` vazias.
  - `*create` fora de `startup.txt`.
  - `*set` em variável não criada.
  - Loops infinitos potenciais (mesmo `*goto` repetido sem alteração de estado).
  - Branches inalcançáveis.

### 5.2 Play-test integrado
- Botão "Jogar" que abre uma janela embutida com o **runtime oficial do ChoiceScript** rodando o jogo.
- Painel lateral durante o play-test mostrando: variáveis ao vivo, label/cena atual, caminho percorrido (breadcrumb), histórico de escolhas.
- Botão "Saltar para este nó" no editor que inicia o play-test diretamente daquele ponto, com possibilidade de **predefinir valores de variáveis** para testar caminhos específicos.
- "Random test" e "Quick test" (os modos automatizados oficiais do ChoiceScript) integrados, com relatório visual de cobertura por nó.

### 5.3 Importação e Exportação
- **Importar** projeto ChoiceScript existente (pasta `mygame/` com `.txt`) e renderizar como grafo automaticamente.
- **Exportar:**
  - Pasta `mygame/` 100% compatível, pronta para rodar com `run-server.bat` / `serve.command`.
  - HTML autônomo (usando o exportador oficial).
  - Backup `.zip` do projeto inteiro (cenas + `project.json`).

### 5.4 Histórico, undo/redo, autosave
- Undo/redo ilimitado por sessão.
- Autosave a cada 30 segundos (configurável).
- Histórico de versões local (snapshots diários, 30 dias).
- Integração opcional com Git (commit, diff visual entre versões da mesma cena).

### 5.5 Estatísticas do projeto (dashboard)
- Total de palavras, total de cenas, total de nós, total de escolhas, número médio de opções por escolha, número de finais alcançáveis, profundidade máxima de aninhamento, distribuição de palavras por cena.
- Mapa de calor das cenas mais conectadas.

### 5.6 Acessibilidade e Internacionalização
- Interface em **Português (Brasil), Inglês e Espanhol** no mínimo.
- Atalhos de teclado totalmente customizáveis.
- Tema claro e escuro.
- Suporte a leitor de tela.
- Fonte do editor configurável (incluindo opções para dislexia, p. ex. OpenDyslexic).

---

## 6. Arquitetura e Qualidade do Código

- Código modular, com separação clara entre: **parser/AST**, **modelo de domínio**, **camada de UI**, **camada de persistência**.
- Cobertura de testes mínima de 70% no parser e no modelo.
- Documentação interna (JSDoc/TSDoc) em todos os módulos públicos.
- README rico com:
  - Instruções de build para cada plataforma.
  - Diagrama da arquitetura.
  - Guia de contribuição.
  - Roadmap.

---

## 7. Entregáveis Esperados

1. **Estrutura completa do projeto** com `package.json`, configs do Tauri/Electron, Vite, TypeScript, ESLint, Prettier.
2. **Parser ChoiceScript** funcional cobrindo todos os comandos listados na seção 3.
3. **Modelo de domínio** (TypeScript types/classes) que representa um projeto ChoiceScript inteiro em memória.
4. **UI completa** dos três painéis e do canvas de grafo, com pelo menos os tipos de nó da seção 4.2.
5. **Inspetor de nó** funcional para passages, choices e conditionals.
6. **Play-test** embutido funcional.
7. **Importação e exportação** de pasta `mygame/`.
8. **Linter em tempo real** com pelo menos 5 das verificações da seção 5.1.
9. **Pelo menos um projeto de exemplo** dentro da aplicação ("Tutorial: Sua primeira história"), demonstrando a maioria dos comandos.
10. **Instaladores empacotados** para Windows, macOS e Linux.

---

## 8. Plano de Execução Sugerido (você pode ajustar)

Por favor, ao começar, **proponha primeiro um plano de execução em fases** (MVP → expansões), me apresente para aprovação, e só então comece a implementar. Sugiro:

- **Fase 1 (MVP):** parser + canvas básico + nós Passage e Choice + edição de texto + import/export.
- **Fase 2:** variáveis (`*create`, `*set`, `*if`), inspetor visual, linter básico.
- **Fase 3:** play-test integrado, multireplace, fairmath, conditionals avançados.
- **Fase 4:** subroutines, achievements, stats screen, imagens.
- **Fase 5:** dashboard de estatísticas, Git, i18n, acessibilidade, polish geral.

---

## 9. Princípios de Design (não-negociáveis)

1. **Compatibilidade total** com o ChoiceScript oficial — nada do que o editor gera pode quebrar no runtime padrão.
2. **Visual primeiro, código sempre acessível** — o autor nunca é forçado ao texto bruto, mas pode acessá-lo sempre.
3. **Erros visíveis, não silenciosos** — qualquer problema que impeça o jogo de rodar é mostrado claramente, com link para o nó culpado.
4. **Performance:** o canvas precisa rodar suave com **5.000+ nós** (uma novela interativa séria pode ter isso).
5. **Sem lock-in:** o projeto fica salvo como pasta `.txt` legível por humanos. O autor pode abandonar o editor e continuar no bloco de notas se quiser.

---

## 10. Comece Agora

Antes de escrever qualquer código:

1. Confirme que entendeu todos os requisitos acima.
2. Apresente o **plano em fases** com estimativa de complexidade por fase.
3. Apresente um **diagrama de arquitetura** (módulos e suas dependências).
4. Apresente um **mockup textual ou ASCII** da tela principal.
5. Aguarde meu OK para iniciar a Fase 1.

Capricha. Quero uma ferramenta que a comunidade Choice of Games adote como padrão de fato.
