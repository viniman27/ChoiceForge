# Trabalhar com um projeto ChoiceScript existente

## Importar sem reconstruir o jogo

Use **Arquivo → Abrir/importar arquivos** no navegador para selecionar `.txt`, `.zip` ou um projeto ChoiceForge `.json`. No aplicativo desktop, **Arquivo → Abrir projeto/importar JSON** abre JSON nativo, e **Arquivo → Importar cenas de texto** continua disponível para fontes `.txt`/`.zip`. Para um projeto completo, selecione `startup.txt` e todas as cenas juntas, ou use **Arquivo → Importar pasta de cenas**.

Uma cena `.txt` isolada é adicionada ao projeto aberto. Se já existir uma cena com o mesmo nome normalizado, a substituição exige confirmação. Importar um projeto completo substitui o projeto atual após confirmação; salve seu projeto antes.

## Texto, prévia e edição visual

Clique no nome da cena na lista para abri-la. Cenas importadas preservam seu código original para exportação.

No editor de texto, **Show graph preview** gera uma prévia dos nós sem abandonar o código original. Salve alterações de texto antes de gerar a prévia. O mapa geral mostra cenas; o editor mostra os nós da cena selecionada.

**Convert to visual editing** é uma operação diferente: troca a fonte utilizada na exportação pelo grafo editável. O parser visual não representa todas as construções ChoiceScript; a conversão pede confirmação e pode perder estruturas não suportadas. Faça backup antes. Desfazer restaura o estado anterior.

A prévia tem limites de segurança por cena: 8.000 linhas e 750.000 caracteres. Ao excedê-los, a interface informa o erro e mantém o código original; não é necessário recriar a cena para continuar editando/exportando como texto. Esses limites não garantem fidelidade da conversão visual.

## Acessibilidade e espaço de trabalho

Os menus **Arquivo** e **Interface** têm seta visível, borda persistente e navegação por teclado: Enter/Espaço abre, Seta para baixo entra no primeiro item, Escape fecha e devolve foco ao botão. O menu **Interface** oferece zoom da interface, redefinição e opções para mostrar/ocultar os painéis laterais. Há atalhos Ctrl/Cmd +, Ctrl/Cmd - e Ctrl/Cmd 0 fora dos campos de edição. O zoom do grafo continua sendo independente.

Idioma, tema e densidade continuam como seletores nativos rotulados na barra superior. Eles preservam o comportamento de teclado e leitor de tela do navegador/sistema; mover esses controles para um menu ARIA misturado deixaria o padrão de seleção menos confiável.

A barra superior quebra linhas em vez de deixar ações fora da janela. Para ampliar a área de trabalho mantendo fontes grandes, oculte um painel; ele pode ser reaberto pelo mesmo menu.

## Salvar e exportar são operações diferentes

- **Salvar projeto**: arquivo JSON editável no ChoiceForge. No navegador, o menu baixa o arquivo; o salvamento rápido/local continua existindo.
- **Salvar projeto como...**: aparece no menu no desktop, onde há destino nativo distinto. No navegador, o download JSON único evita duplicar o mesmo fluxo.
- **Exportar ZIP ChoiceScript**: código ChoiceScript e projeto para continuar trabalhando; não é o pacote HTML autossuficiente.
- **Exportar jogo jogável**: ZIP contendo `index.html`, runtime local e arquivos de mídia. Extraia o ZIP antes de abrir `index.html`. Caso o navegador restrinja arquivos locais, sirva a pasta com um servidor HTTP local, conforme o README do ZIP.
- **Exportar grafo DOT**: somente a representação Graphviz do grafo.

O pacote jogável não inclui o JSON editorial do ChoiceForge. Publicação e uso comercial continuam sujeitos à licença e aos termos do runtime ChoiceScript. A exportação não substitui Quicktest/Randomtest nem valida todas as rotas da história.

## Verificação de desenvolvimento

- `npm test`
- `npm run test:ui`
- `npm run test:browser` (instale Chromium com `npx playwright install chromium`)
- `npm run build`

No Node 26, se jsdom falhar por `localStorage` indefinido, execute os testes UI com `NODE_OPTIONS=--no-experimental-webstorage` no Git Bash. Testes de navegador não substituem a validação de DPI e diálogos no executável Tauri. O build nativo requer Rust/Cargo e a toolchain Windows apropriada.
