# Templates .docx + geração de PDF vetorial instantânea

> Segue o mesmo racional de `docs/spec-6-relatorios-pdf-paginado.md` (paginação real em vez de
> screenshot único) e estende `docs/document-templates-design.md` (templates editáveis pelo
> cliente). Cobre Orçamento, Contrato, Ordem de Serviço e Pedido de Venda — os 4 documentos com
> letterhead que hoje viram PDF via `html2canvas`.

## 1. Motivação

Depois do ajuste de performance em `letterhead-pdf.ts` (spec anterior, não documentada em
arquivo — letterhead renderizado uma vez + `scale: 1.5`), a geração desses 4 documentos ainda não
é instantânea: cada página é uma captura `html2canvas` (rasterização), inerentemente mais lenta
que desenhar texto/tabela vetorial. Ao investigar uma extensão pra Relatórios (`spec-6`, esse sim
resolvido com paginação + captura por página), ficou claro que dar o mesmo salto de velocidade
pros 4 documentos com letterhead exige trocar `html2canvas` por geração vetorial — e isso só é
viável se o conteúdo do template para de ser HTML livre (que aceita qualquer CSS) e passa a ser
um formato mais restrito e estruturado.

Ao mesmo tempo, veio um segundo pedido, independente mas que se resolve junto: hoje o admin edita
o template baixando um `.html` e editando manualmente as tags — inacessível pra quem não conhece
HTML. Trocar o formato do arquivo de template pra **.docx** (Word) resolve os dois problemas de
uma vez: Word é o editor que o usuário final já conhece, e um `.docx` (parágrafos, tabelas,
imagens, negrito/itálico) tem estrutura suficientemente previsível pra desenhar vetorialmente
sem precisar de `html2canvas`.

**Restrição confirmada com o usuário**: nada de instalar software no servidor de produção (sem
LibreOffice headless, sem processo externo) e nada de biblioteca paga (sem Aspose/GroupDocs). A
conversão continua **inteiramente no navegador**, como hoje.

## 2. Estado atual (confirmado por investigação no código)

- `DocumentTemplate.Content` (`TSI.Nexus.Contracts/Models/DocumentTemplate.cs`) é uma coluna
  `longtext` guardando o HTML inteiro do template, com 4 registros (`Type` único): `Quote`,
  `Contract`, `ServiceOrder`, `SalesOrder`.
- Controller (`DocumentTemplatesController.cs`) expõe `Download/{type}` (retorna `Content` como
  `text/html`) e `Upload/{type}` (lê o arquivo enviado como texto UTF-8 via `StreamReader` e
  substitui `Content` inteiro) — assume texto em todo o caminho, não suporta binário.
- `DocumentTemplateSeeder.cs` guarda o HTML padrão de cada tipo como literal de string C#.
- No frontend, `renderDocumentTemplate()`/`splitTemplatePages()`
  (`core/utilities/document-template-renderer.ts`) fazem substituição de `{{Token}}` por
  `split/join` ingênuo em uma string, e split por um marcador literal `<!-- PAGE_BREAK -->` —
  zero HTML parsing real.
- `buildQuotePages`/`buildContractPages`/`buildServiceOrderPages`/`buildSalesOrderPages`
  (`quote-documents.ts`, `trip-documents.ts`, `order-documents.ts`) buscam o template, montam os
  blocos dinâmicos em código (linhas de produto, bloco de assinatura) e retornam `string[]` de
  páginas HTML.
- `downloadLetterheadPdf()` (`core/utilities/letterhead-pdf.ts`) recebe esse `string[]`, monta
  cada página como `.pdf-page` (210mm x 297mm, letterhead de fundo), tira um screenshot
  `html2canvas` por página e monta o PDF com `jsPDF.addImage()` — ou seja, o PDF final é uma
  sequência de imagens JPEG, uma por página.
- Admin UI (`document-templates.component.ts/html`) é só download/upload de arquivo — sem editor
  embutido, sem preview — `accept=".html,text/html"` no input de arquivo.
- Não existe hoje nenhuma geração de PDF no backend — tudo roda no navegador com `html2canvas` +
  `jspdf` (dependências já usadas por spec-6 também).

## 3. Desenho proposto

### 3.1 Princípio geral

Trocar **apenas o final da esteira**: em vez de `.html` → string com tokens substituídos →
screenshot por página → imagem no PDF, passa a ser `.docx` → tokens substituídos dentro da
estrutura do Word → **parágrafos/tabelas/imagens desenhados vetorialmente no jsPDF** (texto real,
sem rasterizar nada). As funções que hoje montam os dados de cada documento
(`buildQuotePages`/`buildContractPages`/etc.) **não mudam sua lógica de negócio** — continuam
formatando moeda/data e montando as linhas de produto/trecho exatamente como hoje. Só muda o que
elas entregam no final: em vez de `string[]` de HTML, entregam o dicionário de tokens direto pro
novo pipeline `.docx`.

O resultado visual final deve ficar equivalente ao que existe hoje — como somos nós que
construímos os 4 `.docx` padrão (substituindo os `.html` padrão semente), garantimos isso na
prática mantendo layout, textos de cláusula, tabelas e posição do letterhead iguais.

### 3.2 Escopo de formatação suportado (a decisão central desta spec)

Não existe biblioteca gratuita, 100% client-side, capaz de renderizar **qualquer** `.docx`
(colunas, cabeçalho/rodapé, caixas de texto, WordArt, etc.) como PDF vetorial fielmente — isso é
essencialmente reimplementar o motor de layout do Word. A saída viável é **restringir o que um
template `.docx` pode usar** a um subconjunto que cobre 100% do que os 4 documentos atuais já
usam:

**Suportado** (o que os parsers abaixo vão interpretar e desenhar):
- Parágrafos de texto, com negrito / itálico / sublinhado por trecho (`run`).
- Tabelas simples (linhas/colunas, sem células mescladas nem tabelas aninhadas) — cobre as
  tabelas de produtos/trechos e o bloco de totais.
- Imagens inline (a logo/assinatura da Serodio).
- Quebra de página explícita do Word (`Ctrl+Enter` / "Quebra de página") — substitui o marcador
  `<!-- PAGE_BREAK -->` de hoje.
- Os mesmos placeholders `{{Token}}` de hoje (lista completa abaixo, idêntica à atual), digitados
  como texto normal em qualquer lugar do documento.

**Não suportado** (upload com isso não quebra o app, mas o elemento é ignorado ou sai diferente
do Word): colunas de texto, cabeçalho/rodapé nativo do Word, notas de rodapé, caixas de
texto/WordArt, tabelas mescladas/aninhadas, fontes customizadas fora de Helvetica/Times/Courier
(o jsPDF usa essas 3 por padrão — dá pra chegar perto do "Arial" atual com Helvetica), alterações
rastreadas/comentários do Word.

Isso precisa ficar visível pra quem for editar o template — texto de ajuda ao lado do botão
"Atualizar" na tela de administração (seção 3.6) listando o que é suportado.

### 3.3 Backend — `DocumentTemplate` passa a guardar binário

- **Migration EF Core**: coluna `Content` de `longtext` para binário (`LONGBLOB` no MySQL,
  mapeado como `byte[]` em `DocumentTemplate.cs`). Migração de dados: como o conteúdo muda de
  formato inteiramente (HTML → docx), não existe conversão automática linha-a-linha — a migration
  só altera o tipo da coluna; o reseed (seção 3.4) é quem repovoa com os `.docx` novos.
- `IDocumentTemplateService.UploadContent` passa a receber `byte[]` em vez de `string`.
- `DocumentTemplatesController`:
  - `Download/{type}`: `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
    `FileName` passa a terminar em `.docx`.
  - `Upload/{type}`: lê o `IFormFile` como bytes (sem `StreamReader`/`Encoding.UTF8`); **valida
    que é um `.docx` de fato** antes de salvar — assinatura ZIP (`PK\x03\x04`) + presença de
    `word/document.xml` dentro do zip (checagem leve, sem precisar abrir a lib de parsing no
    backend) — rejeita com 400 qualquer outra coisa (incluindo um `.html` — é isso que "trava"
    o upload só pra Word, conforme pedido). Fica igual pro Admin-only já existente.
- **Consequência a assumir**: qualquer template já customizado hoje em produção (upload manual
  anterior de um `.html` alterado) fica obsoleto quando essa mudança for pro ar — o admin precisa
  recriar manualmente essas edições no novo `.docx` padrão depois do deploy. Não há como
  converter automaticamente um HTML customizado antigo pro novo `.docx` padrão.

### 3.4 Seed — 4 arquivos `.docx` reais no lugar dos literais de string

`DocumentTemplateSeeder.cs` para de ter HTML como const string C#; passa a ler 4 arquivos `.docx`
binários (um por `DocumentTemplateType`) empacotados como recurso embutido/arquivo no projeto
`TSI.Nexus.Data` (ex.: `Seed/DocumentTemplates/orcamento.docx`, `contrato.docx`,
`ordem-de-servico.docx`, `pedido-de-venda.docx`) e grava os bytes na coluna `Content` no primeiro
seed (mesma regra de hoje: só insere se não existir, nunca sobrescreve edição do admin).

Esses 4 `.docx` precisam ser **criados como parte da implementação**, replicando fielmente o
texto/tabelas/posição de logo dos 4 HTML atuais (seção 5 do `DatabaseSeeder`/
`DocumentTemplateSeeder` tem o conteúdo integral de cada um hoje) — mesmos placeholders, mesma
ordem de cláusulas, mesmo texto. É o trabalho manual mais sensível da implementação: qualquer
divergência de texto entre o `.html` antigo e o `.docx` novo é uma regressão visível pro cliente.

Placeholders por tipo (sem alteração — mesmos nomes, mesmo significado):
- **Quote**: `{{QuoteNumber}}`, `{{ClientName}}`, `{{ClientDocument}}`, `{{ClientAddress}}`,
  `{{QuoteDate}}`, `{{ProductRows}}` *(bloco)*, `{{TotalPrice}}`, `{{PaymentCondition}}`,
  `{{PaymentMethod}}`, `{{CompanyContactName}}`, `{{CompanyWhatsapp}}`, `{{SignatureBlock}}`
  *(bloco)*.
- **Contract**: `{{TripNumber}}`, `{{CompanyLegalName}}`, `{{CompanyCnpj}}`,
  `{{CompanyAddress}}`, `{{ContratanteName}}`, `{{ContratanteDocument}}`,
  `{{ContratanteAddress}}`, `{{TotalPrice}}`, `{{LimiteKm}}`, `{{KmExcedente}}`,
  `{{DiariaExtra}}`, `{{LegRows}}` *(bloco)*, `{{VehicleInfo}}`, `{{TripDate}}`, `{{Sinal}}`,
  `{{Saldo}}`, `{{SignatureBlock}}` *(bloco)*.
- **ServiceOrder**: `{{TripNumber}}`, `{{DriverName}}`, `{{VehicleInfo}}`, `{{TripDate}}`,
  `{{Route}}`, `{{DistanceKm}}`, `{{PassengerCount}}`, `{{CommissionRow}}` *(bloco, pode vir
  vazio)*, `{{CompanyWhatsapp}}`, `{{CompanyContactName}}`, `{{CompanyLegalName}}` — a imagem de
  assinatura deixa de ser um placeholder de `src` (`{{CompanySignaturePath}}`) e passa a ser uma
  imagem real inserida no `.docx`, já que agora o pipeline lê imagens nativamente.
- **SalesOrder**: `{{OrderNumber}}`, `{{ClientName}}`, `{{ClientDocument}}`,
  `{{ClientAddress}}`, `{{OrderDate}}`, `{{ProductRows}}` *(bloco)*, `{{TotalPrice}}`,
  `{{PaymentMethod}}`, `{{CompanyContactName}}`, `{{CompanyWhatsapp}}`, `{{SignatureBlock}}`
  *(bloco)*.

Os blocos (`ProductRows`, `LegRows`, `SignatureBlock`, `CommissionRow`) continuam sendo montados
em código, mas agora como **uma tabela/parágrafos OOXML gerados dinamicamente** (função helper no
novo utilitário do frontend) e inseridos no lugar do parágrafo/tabela-placeholder correspondente
— não como string HTML.

### 3.5 Frontend — novo pipeline vetorial (`core/utilities/docx-pdf.ts`)

Novas dependências (ambas MIT, client-side, sem custo — respeitam a restrição confirmada):
- **`jszip`** — descompacta o `.docx` (que é só um .zip com XML dentro); não precisa de nenhuma
  lib de parsing OOXML pesada porque o `DOMParser` nativo do navegador já lê o XML.
- **`jspdf-autotable`** — desenha tabelas vetoriais direto no `jsPDF` (parceiro oficial do
  `jspdf`, já usado no projeto).

Pipeline de `downloadDocxPdf(docxBytes, tokens, blockBuilders, filename, onProgress?)`:
1. `jszip` abre os bytes, lê `word/document.xml` (texto do documento) e `word/media/*` (imagens),
   junto com `word/_rels/document.xml.rels` (pra resolver qual imagem cada `<w:drawing>`
   referencia).
2. `DOMParser` percorre `document.xml` parágrafo por parágrafo (`w:p`), *normalizando* os `run`s
   (`w:r`) de cada parágrafo num texto único antes de procurar `{{Token}}` — o Word
   frequentemente quebra um único `{{ClientName}}` em vários `w:r` (por causa de autocorreção),
   então a substitução não pode ser feita `run` a `run` ingenuamente, senão perde o token no
   meio. Depois de substituído, o texto final do parágrafo é desenhado com a formatação
   predominante do parágrafo (simplificação assumida: se o parágrafo misturar negrito e não
   negrito no meio de um token substituído, o resultado usa o estilo que cobre a maior parte do
   parágrafo — perda aceitável, documentos atuais não fazem isso dentro de um placeholder).
3. Blocos (`{{ProductRows}}` etc.) são detectados como um parágrafo/tabela-placeholder sozinho
   numa linha e substituídos pela tabela/parágrafos gerados em código (mesmo dado de hoje:
   `quote.quoteProducts`, `trip.tripLegs` etc.), não por texto simples.
4. Cada parágrafo/tabela normalizado é desenhado no `jsPDF`: texto via `pdf.text()` com
   `pdf.setFont('helvetica', style)`, tabela via `autoTable`, imagem via `pdf.addImage()` — com
   um cursor Y por página; ao passar da altura útil da página, chama `pdf.addPage()`
   automaticamente (paginação por conteúdo real, não mais por marcador manual — uma quebra de
   página explícita do Word força `addPage()` do mesmo jeito).
5. O letterhead (`SERODIO_COMPANY.letterheadPath`) é colocado uma vez por página via
   `pdf.addImage()` **antes** do conteúdo de cada página (mesma imagem, sem reprocessar nada —
   princípio já usado hoje, só que sem precisar de canvas intermediário).
6. `onProgress?.(current, total)` chamado por página, alimentando o mesmo modal de progresso já
   existente (`ModalService.showPdfProgress`, sem nenhuma mudança nessa parte).

`letterhead-pdf.ts` (`html2canvas`) é removido depois que os 4 fluxos migrarem — não sobra
nenhum consumidor.

`buildQuotePages`/`buildContractPages`/`buildServiceOrderPages`/`buildSalesOrderPages` mudam a
assinatura de retorno (token dictionary em vez de `string[]` de HTML), mas toda a lógica de
formatação de moeda/data/labels dentro deles fica idêntica.

`document-template-renderer.ts` (`renderDocumentTemplate`/`splitTemplatePages`) é removido — a
substituição de token passa a viver dentro de `docx-pdf.ts`, específica do formato OOXML.

### 3.6 Admin UI — trocar só a extensão aceita

- `document-templates.component.html`: input de upload passa de
  `accept=".html,text/html"` para
  `accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"`.
- Adicionar uma linha de texto de ajuda (abaixo do botão "Atualizar", mesmo padrão visual de
  outros textos de apoio da tela) resumindo o escopo suportado (seção 3.2) — pra quem for editar
  saber que colunas/cabeçalho nativo/caixa de texto não vão aparecer no PDF.
- "Baixar" continua igual na estrutura, só passa a entregar o `.docx` de fato (o navegador já
  abre isso direto no Word/LibreOffice Writer do usuário).
- Segue tudo que já era decidido em `document-templates-design.md` (Admin-only, sem editor
  embutido, sem preview, sem histórico de versões) — nada disso muda aqui.

## 4. Arquivos a criar/alterar

**Backend**
- `TSI.Nexus.Contracts/Models/DocumentTemplate.cs` — `Content` de `string` para `byte[]`.
- `TSI.Nexus.Data/Migrations/*` — nova migration (`longtext` → `LONGBLOB`).
- `TSI.Nexus.Contracts/Interfaces/IDocumentTemplateService.cs` +
  `TSI.Nexus.Services/Services/DocumentTemplateService.cs` — `UploadContent(type, fileName,
  byte[] content)`.
- `TSI.Nexus.WebAPI/Controllers/DocumentTemplatesController.cs` — `Download`/`Upload` em bytes +
  validação de assinatura `.docx` no `Upload`.
- `TSI.Nexus.Data/Seed/DocumentTemplateSeeder.cs` — lê os 4 `.docx` em vez de literais HTML.
- `TSI.Nexus.Data/Seed/DocumentTemplates/{orcamento,contrato,ordem-de-servico,pedido-de-venda}.docx`
  — novos arquivos binários (autoria manual, replicando o texto/layout do HTML atual).

**Frontend**
- `TSI.Nexus.UIApp/src/app/core/utilities/docx-pdf.ts` (novo) — pipeline vetorial completo.
- `TSI.Nexus.UIApp/src/app/core/utilities/letterhead-pdf.ts` (removido).
- `TSI.Nexus.UIApp/src/app/core/utilities/document-template-renderer.ts` (removido).
- `TSI.Nexus.UIApp/src/app/quotes/utilities/quote-documents.ts`,
  `TSI.Nexus.UIApp/src/app/trips/utilities/trip-documents.ts`,
  `TSI.Nexus.UIApp/src/app/orders/utilities/order-documents.ts` — trocam o retorno de `string[]`
  pra dicionário de tokens + builders de bloco; chamadores (`quote-details-page`,
  `trip-details-page`, `order-details-page`) passam a chamar `downloadDocxPdf` em vez de
  `downloadLetterheadPdf`.
- `TSI.Nexus.UIApp/src/app/document-templates/document-templates.component.html` — `accept` do
  input + texto de ajuda.
- `TSI.Nexus.UIApp/src/app/core/models/document-template.model.ts` — `content` deixa de ser
  string (não é mais consumido como texto no frontend; segue só como bytes via download/upload).
- `TSI.Nexus.UIApp/package.json` — adiciona `jszip`, `jspdf-autotable`.

## 5. Verificação

- Construir os 4 `.docx` padrão e comparar visualmente (mesmo método de spec-6:
  `pdftoppm` PDF→PNG) o PDF gerado pelo novo pipeline contra o PDF gerado hoje pelo
  `html2canvas`, pra cada um dos 4 tipos — parágrafo de texto, tabela de produtos/trechos,
  bloco de assinatura com imagem, quebra de página.
- Testar um contrato de trip com múltiplos `tripLegs` (hoje gera 4 páginas via
  `<!-- PAGE_BREAK -->`) — confirmar que a paginação por conteúdo real bate com a paginação
  manual de hoje (mesma quantidade de páginas, conteúdo no lugar certo).
- Testar upload de um `.docx` editado manualmente (trocar um texto de cláusula) e confirmar que
  o PDF gerado reflete a edição.
- Testar upload de um arquivo `.html` (ou qualquer não-`.docx`) e confirmar que o backend rejeita
  com 400, sem sobrescrever o template atual.
- Medir tempo de geração antes/depois pros 4 fluxos (mesma ressalva de spec anterior: este
  sandbox tem timing pouco confiável — usar o navegador local real do usuário como referência
  final, não só o container de dev).
- `dotnet test` limpo (novo teste de validação de upload não-docx no
  `DocumentTemplateService`/`DocumentTemplatesController`, camada `TSI.Nexus.Services.Tests`/
  `TSI.Nexus.WebAPI.Tests`).

## 6. Fora de escopo (reafirmando o que já estava decidido)

- Editor WYSIWYG embutido, preview antes de salvar upload, histórico de versões — já eram fora
  de escopo em `document-templates-design.md`, continuam fora aqui.
- Suporte a qualquer elemento OOXML fora do subconjunto da seção 3.2 — colunas, cabeçalho/rodapé
  nativo, caixas de texto, tabelas mescladas.
- Migração automática de um template `.html` já customizado em produção pro novo `.docx` — vira
  trabalho manual do admin depois do deploy (seção 3.3).
