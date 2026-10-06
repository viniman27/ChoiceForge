# Auditoria de importação real: legibilidade e navegação

## Projeto público usado

- Origem: `dfabulich/choicescript`, branch `main`, pasta `web/mygame/scenes`.
- URL de listagem: `https://api.github.com/repos/dfabulich/choicescript/contents/web/mygame/scenes?ref=main`.
- Fixture versionada: `tests/fixtures/choicescript-public-sample/`.
- Arquivos importados: `startup.txt`, `animal.txt`, `variables.txt`, `gosub.txt`, `ending.txt`, `death.txt`, `choicescript_stats.txt`.
- Uso: somente leitura/download público; nada foi enviado.

## Evidências visuais

- Antes: captura local de auditoria, não versionada.
- Depois inicial: captura local de auditoria, não versionada.
- Depois follow-up (1280×800, zoom de interface 125%): captura local de auditoria, não versionada.
- Depois final (1280×800, zoom de interface 125%): gerada pelo Playwright em `test-results/` durante o teste `readable imported choice fits horizontally without minimap overlap at 125 percent UI zoom`.

Eu inspecionei ambas as imagens. Antes, só a cena ativa tinha preview visual útil; cenas reais como `animal`, `variables` e `gosub` apareciam como `0 nodes`, embora tivessem fonte preservada. A navegação visual ficava pouco descobrível para um projeto multi-cena real. Depois, a cena `animal` mostra grafo preservado não destrutivo com choice/opções/labels/finish, e o painel lateral mostra contagens reais para as cenas importadas.

## Exemplos concretos fonte → grafo observado

### `animal.txt`

Fonte original:

```choicescript
What kind of animal will you be?
*choice
  #Lion
    *goto claws
  #Tiger
    *label claws
    In that case, you'll have powerful claws and a mighty roar!
    *finish
  #Elephant
    Well, elephants are interesting animals, too.
    *finish
```

Depois da correção:

- `animal` não fica mais como cena preservada vazia.
- O preview mostra o nó de `choice`, as opções `Lion`, `Tiger`, `Elephant`, o `*goto claws`, o `*label claws`, passagem e `*finish`.
- O banner deixa claro: o canvas é preview e exporta o `.txt` original até conversão explícita.
- Exportação verificada por ZIP: `animal.txt` exportado é byte-a-byte igual ao original baixado.

### `choicescript_stats.txt`

Fonte original:

```choicescript
*stat_chart
  percent Leadership
  opposed_pair Strength
    Weakness
  text Leadership
  text Strength
```

Antes, a tela acusava erros falsos por casing (`Leadership`, `Strength`) e interpretava `Weakness` como linha inválida de stat chart. Depois, o lint normaliza casing como o runtime ChoiceScript e trata rótulo indentado de `opposed_pair` como label, não como linha de stat.

## Alterações implementadas

- `src/domain/choicescriptImport.ts`
  - Importa e mantém preview visual para todas as cenas preservadas, não só para a cena ativa.
  - Continua preservando `sourceText`, então conversão visual continua explícita e não destrutiva.

- `src/domain/choicescript.ts`
  - Não acusa duplicidade falsa entre a entrada especial `startup.txt` e a cena jogável `startup`.
  - Lint de `choicescript_stats.txt` aceita casing do ChoiceScript e não trata labels de `opposed_pair` como rows inválidas.
  - Exportação de cenas preservadas usa o `sourceText` original diretamente, sem acrescentar newline artificial.
  - Lint de fonte preservada não marca `*page_break` sem label como erro, compatível com o sample oficial.

- `src/components/GraphCanvas.tsx`
  - `fit` voltou a significar encaixar o grafo completo; não força zoom mínimo legível.
  - Adicionados controles separados `Readable` e `Start` para abrir/focar a primeira decisão em zoom legível, sem cortar o nó sob toolbar/banner.
  - `Readable` agora adapta o zoom do nó selecionado/inicial ao canvas utilizável, para que a largura do card caiba no canvas mesmo com painéis e zoom de interface altos.
  - O minimapa é colapsável e inicia colapsado quando o canvas real fica estreito, usando a largura disponível do canvas em vez da largura da janela.
  - A barra inferior pode rolar horizontalmente em telas estreitas/zoom de interface alto para não ficar bloqueada pelo minimapa.

- `src/App.tsx`
  - Abrir uma cena importada preservada mostra o preview visual por padrão em nó significativo, selecionado e legível; `Text` continua abrindo a fonte preservada sem destruir nada.
  - Ao entrar em outra cena via lista/inspector/mapa, seleção e viewport são resetados para o início/primeira decisão daquela cena em vez de herdar pan/zoom de outra cena.

- `tests/domain.test.ts`
  - Cobriu preview não destrutivo de todas as cenas, duplicate `startup`, stats preservado, e exportação preservada.

- `tests/browser/import.spec.ts`
  - Novo teste Playwright importa projeto multi-cena realista via UI, abre preview de `animal`, valida nós/opções, zoom legível e exportação original.

## Limitações restantes

- O parser ainda é pragmático, não AST ChoiceScript completo. Blocos complexos podem virar preview aproximado, mas a fonte original preservada continua sendo a fonte de exportação.
- `Fit` agora pode produzir visão pequena em cenas horizontais; isso é intencional porque `Fit` encaixa tudo. Use `Readable`/`Start` para navegação de leitura com foco adaptado ao canvas.
- Em 1280×800 com zoom de interface 125%, o preview `animal` fica legível, o nó de choice selecionado cabe horizontalmente no canvas, o inspector mostra o nó selecionado e o minimapa inicia colapsado sem cobrir `Elephant`.
- A cena `startup` do sample oficial ainda pode mostrar avisos/diagnósticos de estilo de fonte preservada, mas os falsos erros principais vistos nesta auditoria foram removidos.

## Comandos/resultados reais

- Download público via GitHub API:
  - `animal.txt 979`, `choicescript_stats.txt 129`, `death.txt 773`, `ending.txt 790`, `gosub.txt 677`, `startup.txt 3443`, `variables.txt 1249`.

- RED/GREEN focado domínio:
  - Antes da correção: novos testes falharam para preview de cenas preservadas, duplicate `startup` e stats preservado.
  - Depois: `npm test -- --test-name-pattern="imports every preserved scene|duplicate scene name|preserved stats lint|imports ChoiceScript archives|lints preserved startup and stats"` → `421 pass, 0 fail`.

- Verificação completa:
  - `npm test` → `421 pass, 0 fail`.
  - `NODE_OPTIONS=--no-experimental-webstorage npm run test:ui -- --reporter=dot` → `14 files passed, 123 tests passed` (com o aviso jsdom/CodeMirror `getClientRects`, já conhecido, sem falha).
  - `NODE_OPTIONS=--no-experimental-webstorage npm run test:browser -- --output=test-results/readability-followup` → `36 passed`.
  - `npm run build` → `tsc && vite build` concluído; `✓ built in 1.69s`.
  - `git diff --check` → exit 0; apenas aviso existente de line ending em `src-tauri/Cargo.toml`.

- Browser focado:
  - `npm run test:browser -- --grep "real multi-scene import" --output=test-results/real-project-audit-focused` → `1 passed`.
  - Follow-up: `NODE_OPTIONS=--no-experimental-webstorage npm run test:browser -- --grep "explicit conversion|cancelling visual|deferred scene|real multi-scene" --output=test-results/readability-followup-targeted` → `4 passed`.
  - Final RED: `NODE_OPTIONS=--no-experimental-webstorage npm run test:browser -- --grep "readable imported choice fits" --output=test-results/readability-final-child-red` → falhou antes da correção porque o bbox direito do choice ficou em `891.25`, maior que o canvas `823.5`.
  - Final GREEN focado: `NODE_OPTIONS=--no-experimental-webstorage npm run test:browser -- --grep "readable imported choice fits" --output=test-results/readability-final-child` → `1 passed`.
  - Final browser completo: `NODE_OPTIONS=--no-experimental-webstorage npm run test:browser -- --output=test-results/readability-final-child` → `37 passed`.
  - Final UI direcionado: `NODE_OPTIONS=--no-experimental-webstorage npm run test:ui -- --run tests/ui/sourcePreviewFlow.test.tsx tests/ui/TopBar.test.tsx` → `2 files passed, 8 tests passed`.
  - Final build: `npm run build` → `tsc && vite build` concluído; `✓ built in 1.60s`.
  - Inspeção visual final Playwright em 1280×800 com zoom de interface 125% gerou `choiceforge-readability-final.png`: choice `animal` cabe horizontalmente no canvas, inspector preenchido com o texto do nó, minimapa colapsado sem cobrir `Elephant`.
  - Inspeção manual Playwright em 1280×800 com zoom de interface 125% gerou `choiceforge-readability-followup.png`: choice `animal` em 100%, não cortado, inspector preenchido com o texto do nó; minimapa ainda cobre parte inferior do grafo em canvas estreito.
  - Checagem de play/source no sample real: abriu Play, iniciou `animal`, selecionou `Lion`, chegou ao texto `powerful claws`, fechou o player e retornou ao source `animal.txt` via UI com `*choice/#Tiger` presente.

- Exportação byte-a-byte do projeto público via UI:
  - `startup.txt OK`
  - `animal.txt OK`
  - `variables.txt OK`
  - `gosub.txt OK`
  - `ending.txt OK`
  - `death.txt OK`
  - `choicescript_stats.txt OK`
