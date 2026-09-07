# Spec 6 — Paginação real na geração de PDF de Relatórios

> Escrito antes de qualquer código ser tocado, com base na investigação de performance já feita
> nesta sessão (achado registrado como tarefa sugerida separada). Aguardando seu "ok" no desenho
> antes de codar, como de praxe no fluxo de specs deste projeto.

## 1. Problema

### 1.1 O que existe hoje

`ReportsComponent.generatePDF()` (`reports.component.ts:217-296`) clona `#print-section` inteiro —
cabeçalho, filtros, a `<table>` com **todas** as linhas de `filteredData` e a seção de totais — num
`<div>` escondido, e entrega esse clone de uma vez só pro `html2pdf.js`, que faz **uma única
chamada `html2canvas()`** sobre o clone inteiro antes de fatiar em páginas de PDF.

Confirmado ao vivo via Playwright: sem filtro de data aplicado, a tela renderiza **529 linhas de
pagamento**, produzindo uma DOM de **~34.223px de altura**. `html2canvas` tenta rasterizar isso de
uma vez (um canvas de ~1190×51000px na escala atual de 1.5x) — trabalho que cresce linearmente com
o volume de dados, sem limite, e que arrisca travar a aba ou estourar memória à medida que a base
de pagamentos cresce (o teste que expôs isso teve o contexto do navegador fechado/travar no meio da
tentativa de gerar o PDF com o dataset completo).

Esse é um problema **diferente e mais sério** do que o já corrigido em orçamentos/pedidos/contratos
nesta sessão (papel timbrado redecodificado a cada página) — Relatórios nem usa esse mecanismo, não
tem timbrado. Aqui o problema é estrutural: um documento de N linhas vira **um único canvas
gigante** em vez de várias páginas de tamanho normal.

`printSection()` (botão "Imprimir", `window.print()`) **não** sofre disso — a paginação ali é feita
nativamente pelo motor de impressão do navegador via CSS (`@media print`), sem rasterizar nada.
Só o botão "Gerar PDF" (download) é afetado, e é o único que este spec toca.

### 1.2 Design

Nova função utilitária `TSI.Nexus.UIApp/src/app/core/utilities/report-pdf.ts`, espelhando a
arquitetura já usada e comprovada em `letterhead-pdf.ts` (captura por página + `jsPDF`), mas sem a
composição de timbrado (Relatórios não é um documento de marca, é uma tabela):

1. Em vez de mandar a tabela inteira pro `html2pdf.js`, as linhas (`<tr>`) do `<tbody>` já clonado
   são divididas em blocos de **N linhas por página** (constante `ROWS_PER_PAGE`, valor inicial
   **30** — ajustável depois se alguma combinação de conteúdo estourar a altura de uma página A4 na
   prática; é uma tabela com células curtas, não parágrafos, então a altura por linha é bem
   previsível).
2. Para cada bloco, monta um elemento de página com:
   - **Página 1**: o cabeçalho completo já existente hoje (título + linha de intervalo de datas
     "De X até Y" que já é montada em `generatePDF()`).
   - **Páginas seguintes**: um cabeçalho leve ("Relatório Financeiro — Página X de Y"), pra quem
     folhear o PDF impresso saber onde está sem repetir o cabeçalho cheio.
   - Em toda página: uma `<table>` nova com o mesmo `<thead>` (clonado do original) + as linhas
     daquele bloco — cabeçalho de coluna sempre visível, nunca só na primeira página.
   - **Só na última página**: a seção de totais (Total Recebido / Total Pago / Total) logo abaixo
     da tabela, exatamente como aparece hoje ao final do relatório na tela.
3. Cada página é capturada isoladamente via `html2canvas` (mesmas opções já em uso:
   `scale: 1.5, useCORS: true`), e as páginas são montadas num único PDF multi-página via `jsPDF` —
   o mesmo padrão sequencial de `downloadLetterheadPdf`, só sem a etapa de composição de timbrado.
4. `onProgress(pageIndex, totalPages)`: em `reports.component.ts`, a barra indeterminada
   (`progress.setIndeterminate()`) usada hoje é trocada por progresso real
   (`progress.setProgress(...)`), ficando consistente com orçamentos/pedidos/contratos — que já
   mostram "Página X de Y" real.

**Fora do escopo, deliberadamente:**
- A tela em si não muda — continua mostrando todas as linhas filtradas de uma vez, sem paginação
  visual on-screen. O problema e a correção são só no caminho de exportação pra PDF.
- `printSection()` fica como está (não tem o problema).
- Nome do arquivo (`relatorio.pdf`) mantido como está.
- Nenhuma mudança de backend, banco, ou de outras entidades.

## 2. Arquivos a criar/alterar

- **Novo**: `TSI.Nexus.UIApp/src/app/core/utilities/report-pdf.ts` — a função de captura
  paginada + montagem do PDF.
- `TSI.Nexus.UIApp/src/app/reports/reports.component.ts` — `generatePDF()` reescrito pra usar o
  novo utilitário no lugar da chamada direta a `html2pdf.js`; progresso real no lugar do
  indeterminado.

## 3. Verificação

1. `ng build` (produção) limpo.
2. Teste com os dados semeados atuais sem filtro de data (529 linhas): confirmar que a geração não
   trava o navegador, o PDF final tem múltiplas páginas, cada uma com cabeçalho de coluna e linhas
   corretas, e a última página termina com a seção de totais.
3. Teste com um filtro de data que resulte em poucas linhas (menos que `ROWS_PER_PAGE`): confirmar
   que ainda gera 1 página normal, sem página em branco extra nem quebra estranha.
4. Conferir visualmente (convertendo o PDF de volta pra imagem, como já fiz pro contrato) que o
   conteúdo bate com o que aparece na tela — mesmas colunas, mesmos valores, mesmos totais.
5. Confirmar que o modal de progresso mostra "Página X de Y" avançando de verdade durante a geração.
