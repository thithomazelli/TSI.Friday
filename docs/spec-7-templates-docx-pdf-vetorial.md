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

> **Revisão** (durante a implementação): o desenho original desta seção 3 previa ler o `.docx` e
> desenhar o PDF vetorialmente **no navegador** (`jszip` + `jspdf-autotable`). Depois de discutir
> onde guardar o arquivo de template, o usuário pediu pra também avaliar centralizar a leitura do
> `.docx` e a geração do PDF **no backend** — decisão tomada e confirmada antes de escrever essa
> parte do código (nenhuma linha do motor de renderização client-side chegou a ser escrita). A
> seção abaixo já reflete o desenho revisado. `jszip`/`jspdf-autotable`, instalados durante a
> primeira tentativa, são removidos do `package.json` por não terem mais uso.

### 3.1 Princípio geral

Trocar **o final da esteira e onde ela roda**: em vez de `.html` → string com tokens substituídos
→ screenshot por página → imagem no PDF (tudo no navegador), passa a ser `.docx` (lido do disco
no servidor) → tokens substituídos dentro da estrutura do Word → **parágrafos/tabelas/imagens
desenhados vetorialmente num PDF, no backend** (texto real, sem rasterizar nada) → o navegador só
chama um endpoint e baixa o PDF pronto.

A lógica de negócio que hoje monta os dados de cada documento (linhas de produto, linhas de
trecho, formatação de moeda/data, bloco de assinatura) **migra do Angular pro backend** junto com
isso — deixa de existir em `quote-documents.ts`/`trip-documents.ts`/`order-documents.ts` e passa a
viver num serviço novo (`DocumentPdfGenerationService`), já que agora é o backend quem monta o PDF
e ele já tem a entidade (Quote/Order/Trip) carregada via EF. Isso também é consistente com o
princípio já seguido no resto do projeto (`WebAPI → IoC → Services → Repository → Data →
Contracts`): regra de negócio no `Services`, não no cliente.

O resultado visual final deve ficar equivalente ao que existe hoje — como somos nós que
construímos os 4 `.docx` padrão (substituindo os `.html` padrão semente), garantimos isso na
prática mantendo layout, textos de cláusula, tabelas e posição do letterhead iguais.

**Bibliotecas usadas no backend, ambas gratuitas e sem instalação no servidor** (só pacote NuGet,
sem processo externo, sem LibreOffice): `DocumentFormat.OpenXml` (Microsoft, MIT — lê a estrutura
XML do `.docx`) e `PdfSharpCore` (MIT — desenha texto/tabela/imagem vetorialmente num PDF, o
equivalente do que seria `jsPDF` no navegador).

### 3.2 Escopo de formatação suportado (a decisão central desta spec)

Não existe biblioteca gratuita capaz de renderizar **qualquer** `.docx` (colunas, cabeçalho/
rodapé, caixas de texto, WordArt, etc.) como PDF vetorial fielmente — isso é essencialmente
reimplementar o motor de layout do Word. A saída viável é **restringir o que um template `.docx`
pode usar** a um subconjunto que cobre 100% do que os 4 documentos atuais já usam:

**Suportado** (o que o parser abaixo vai interpretar e desenhar):
- Parágrafos de texto, com negrito / itálico / sublinhado por trecho (`run`).
- Tabelas simples (linhas/colunas, sem células mescladas nem tabelas aninhadas) — cobre as
  tabelas de produtos/trechos e o bloco de totais.
- Imagens inline (a logo/assinatura da Serodio), desde que fora de tabela — direto num parágrafo.
- Quebra de página explícita do Word (`Ctrl+Enter` / "Quebra de página") — substitui o marcador
  `<!-- PAGE_BREAK -->` de hoje.
- Os mesmos placeholders `{{Token}}` de hoje (lista completa abaixo, idêntica à atual), digitados
  como texto normal em qualquer lugar do documento.

**Não suportado** (upload com isso não quebra o app, mas o elemento é ignorado ou sai diferente
do Word): colunas de texto, cabeçalho/rodapé nativo do Word, notas de rodapé, caixas de
texto/WordArt, tabelas mescladas/aninhadas, imagens dentro de célula de tabela (o parser de
tabela só extrai texto — imagem tem que ficar num parágrafo normal, fora da tabela), fontes
customizadas fora de Helvetica/Times/Courier (o `PdfSharpCore` usa fontes-base equivalentes — dá
pra chegar perto do "Arial" atual), alterações rastreadas/comentários do Word.

Isso precisa ficar visível pra quem for editar o template — texto de ajuda ao lado do botão
"Atualizar" na tela de administração (seção 3.6) listando o que é suportado.

> **Revisão (pós-implementação)**: o papel timbrado (faixa do topo, rodapé, QR code, ícones,
> contato) era uma imagem JPG **embutida no assembly** de `TSI.Nexus.Services`
> (`DocumentPdfGenerationService.RenderDocument`), fora do alcance do admin — mesmo editando o
> `.docx`, essa arte nunca mudava, porque não fazia parte do template. Passou a ser um
> `DocumentTemplate` como os outros 4, só que do tipo `Letterhead` e conteúdo `.jpg` em vez de
> `.docx` (mesmo arquivo em disco, mesmo endpoint de Upload/Download, mesma tela de admin) — dá pro
> admin trocar a arte sem precisar mexer em código. Cabeçalho/rodapé/imagem de fundo *nativos do
> Word* continuam fora de escopo (seção 3.2) — o que mudou foi só de onde vem a imagem de fundo que
> o motor já desenhava, não uma nova capacidade de leitura do `.docx`. Detalhes na seção 3.3.

### 3.3 Onde o `.docx` mora — arquivo em disco, não blob no banco

`DocumentTemplate` continua existindo como registro (`Id`/`Type`/`Name`/`FileName`/datas) pra
listar na tela de administração, mas **o conteúdo do arquivo sai do banco e vai pro disco**,
seguindo a mesma convenção já usada por `Attachment`
(`AttachmentService.ResolveBasePath`/`TSI.Nexus.Services/Services/AttachmentService.cs`): caminho
base configurável via `appsettings`/variável de ambiente, fora da pasta que o deploy manual por
FTP substitui, com fallback pra um diretório relativo à raiz do repositório em desenvolvimento.
Isso evita duas coisas ao mesmo tempo: builds de banco desnecessariamente grandes, e o risco de um
deploy apagar um template customizado (o mesmo cuidado que já existe pra anexos).

- Nome do arquivo em disco é **fixo por tipo** (`Quote.docx`, `Contract.docx`,
  `ServiceOrder.docx`, `SalesOrder.docx`, `Letterhead.jpg`) — um upload novo **sobrescreve** o
  arquivo existente, não cria um segundo arquivo. `Letterhead` é o único tipo com extensão `.jpg`
  em vez de `.docx` (`DocumentTemplateService.GetFileExtension`); `DocumentTemplatesController`
  valida a assinatura JPEG em vez de ZIP/`word/document.xml` só pra esse tipo.
- `DocumentTemplate.Content` (a coluna `byte[]`/`longblob` introduzida na primeira tentativa desta
  spec) é **removida** — o model volta a não ter conteúdo, só metadados.
- `IDocumentTemplateService.UploadContent`/`Download` passam a ler/escrever esse arquivo fixo em
  vez de uma coluna do banco.
- `DocumentTemplatesController.Upload` mantém a mesma validação de assinatura `.docx` (ZIP +
  `word/document.xml`) antes de gravar.
- Seed: em vez de inserir bytes numa coluna, `DocumentTemplateSeeder` garante que o arquivo padrão
  exista em disco (copia do recurso embutido pro caminho configurado, só se ainda não existir) e
  garante a linha `DocumentTemplate` (metadados) no banco.

### 3.4 Backend passa a montar E renderizar o PDF (`DocumentPdfGenerationService`)

Novo serviço, na camada `Services` (mesma regra de sempre: interface em `Contracts`,
implementação em `Services`, registrado no `NativeInjector`), com um método por tipo de documento
— `GenerateQuotePdf(quoteId)`, `GenerateContractPdf(tripId)`, `GenerateServiceOrderPdf(tripId)`,
`GenerateSalesOrderPdf(orderId)` — cada um:

1. Carrega a entidade (Quote/Trip/Order) com os relacionamentos necessários via `IRepository<T>`
   (produtos, trechos, parceiro de negócio, veículo) — a mesma consulta que os componentes Angular
   fazem hoje pra exibir a tela de detalhes, só que agora no backend.
2. Monta o dicionário de tokens escalares e os blocos dinâmicos (linhas de produto, linhas de
   trecho, bloco de assinatura) — **migra a lógica hoje em `quote-documents.ts`/
   `trip-documents.ts`/`order-documents.ts`** (formatação de moeda/data, rótulos de
   forma de pagamento etc.) pro C#.
3. Lê o `.docx` do tipo correspondente (seção 3.3) e usa `DocumentFormat.OpenXml` pra abrir sua
   estrutura (parágrafos, `run`s, tabelas, imagens) sem precisar reimplementar leitura de ZIP/XML
   na mão.
4. Substitui tokens escalares dentro do texto dos `run`s — mesma normalização já prevista
   (concatenar o texto dos `run`s de um parágrafo antes de procurar `{{Token}}`, pra não perder um
   token que o Word quebrou em vários `run`s por autocorreção) — e troca cada parágrafo/linha de
   tabela que seja só um placeholder de bloco (`{{ProductRows}}` etc.) pelo conteúdo montado no
   passo 2.
5. Desenha o resultado vetorialmente com `PdfSharpCore` (`XGraphics`): texto com quebra de linha
   manual (mede cada palavra com `XGraphics.MeasureString` e decide a quebra), tabela com uma
   rotina própria de layout em colunas (sem equivalente pronto ao `jspdf-autotable` nessa lib,
   então é código novo, mas o mesmo formato de tabela simples da seção 3.2), imagem via
   `XGraphics.DrawImage`. Cursor Y por página; ao ultrapassar a altura útil, chama `AddPage()`
   automaticamente — uma quebra de página explícita do Word (`<w:br w:type="page"/>`) faz o mesmo.
6. Compõe o letterhead (`assets/img/serodio/letterhead-a4.jpg` — mesmo arquivo de hoje, uma cópia
   dele acessível ao backend) em cada página via `XGraphics.DrawImage` antes do conteúdo.
7. Retorna os bytes do PDF pronto.

Novos endpoints (`Admin`/autenticado, mesma política de autorização das telas de detalhe de cada
entidade): `GET api/Quotes/{id}/Pdf`, `GET api/Orders/{id}/Pdf`,
`GET api/Trips/{id}/ContractPdf`, `GET api/Trips/{id}/ServiceOrderPdf` — cada um devolve o PDF
(`Content-Type: application/pdf`) pronto pra download.

### 3.5 Frontend — só chama o endpoint e baixa o arquivo

`quote-documents.ts`/`trip-documents.ts`/`order-documents.ts` e `letterhead-pdf.ts` são
**removidos** — não sobra lógica de montagem de documento nem geração de PDF no Angular pros
quatro fluxos com letterhead. `emitQuote()`/`emitContract()`/`emitServiceOrder()`/
`emitSalesOrder()` (nos `*-details-page.component.ts`) passam a:

1. Abrir o modal de progresso (`ModalService.showPdfProgress`, sem mudança) e chamar
   `progress.setIndeterminate()` — como a geração agora é uma chamada HTTP única (não mais N
   capturas por página), não existe um "página X de Y" real pra mostrar; o indicador vira um
   spinner indeterminado até a resposta chegar, o que é honesto com o que está acontecendo.
2. Chamar o novo endpoint (`ApiService.get(..., { responseType: 'blob' })`), montar um link de
   download temporário com o blob retornado (`URL.createObjectURL`) e disparar o download.
3. `progress.success(...)`/`progress.error(...)` conforme o resultado da chamada.

Isso é mais simples do que o pipeline client-side original: não tem mais `jszip`/
`jspdf-autotable`/parsing/desenho no navegador — só uma chamada HTTP e um download de blob,
exatamente como qualquer outro download de arquivo já feito no app (ex.: `Download/{type}` de
`document-templates.component.ts`).

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
- `TSI.Nexus.Contracts/Models/DocumentTemplate.cs` — remove `Content`; mantém metadados.
- `TSI.Nexus.Data/Migrations/*` — nova migration removendo a coluna `Content`.
- `TSI.Nexus.Contracts/Interfaces/IDocumentTemplateService.cs` +
  `TSI.Nexus.Services/Services/DocumentTemplateService.cs` — `UploadContent`/`Download` passam a
  ler/escrever o arquivo em disco (caminho configurável, nome fixo por tipo) em vez da coluna.
- `TSI.Nexus.WebAPI/Controllers/DocumentTemplatesController.cs` — mantém a validação de
  assinatura `.docx` no `Upload`.
- `TSI.Nexus.Data/Seed/DocumentTemplateSeeder.cs` — garante o arquivo padrão em disco (copiado do
  recurso embutido) + a linha de metadados no banco.
- `TSI.Nexus.Data/Seed/DocumentTemplates/{orcamento,contrato,ordem-de-servico,pedido-de-venda}.docx`
  — os 4 arquivos binários já criados (autoria manual, replicando o texto/layout do HTML atual).
- `TSI.Nexus.Contracts/Interfaces/IDocumentPdfGenerationService.cs` (novo).
- `TSI.Nexus.Services/Services/DocumentPdfGenerationService.cs` (novo) — parsing OOXML + desenho
  vetorial (`DocumentFormat.OpenXml` + `PdfSharpCore`), lógica de montagem de tokens/blocos
  migrada de `quote-documents.ts`/`trip-documents.ts`/`order-documents.ts`.
- `TSI.Nexus.WebAPI/Controllers/QuotesController.cs`/`OrdersController.cs`/`TripsController.cs` —
  novos endpoints `GET .../Pdf` (ou `ContractPdf`/`ServiceOrderPdf` pra `Trip`).
- `TSI.Nexus.IoC/NativeInjector.cs` — registra `IDocumentPdfGenerationService`.
- `TSI.Nexus.Services.csproj`/`TSI.Nexus.Services.Tests.csproj` — adiciona `DocumentFormat.OpenXml`
  e `PdfSharpCore` (NuGet, gratuitas, sem instalação no servidor).

**Frontend**
- `TSI.Nexus.UIApp/src/app/core/utilities/letterhead-pdf.ts` (removido).
- `TSI.Nexus.UIApp/src/app/core/utilities/document-template-renderer.ts` (removido).
- `TSI.Nexus.UIApp/src/app/quotes/utilities/quote-documents.ts`,
  `TSI.Nexus.UIApp/src/app/trips/utilities/trip-documents.ts`,
  `TSI.Nexus.UIApp/src/app/orders/utilities/order-documents.ts` (removidos).
- `quote-details-page`/`trip-details-page`/`order-details-page` (`.component.ts`) — chamam o novo
  endpoint e baixam o blob retornado, com `progress.setIndeterminate()`.
- `TSI.Nexus.UIApp/src/app/document-templates/document-templates.component.html` — `accept` do
  input + texto de ajuda.
- `TSI.Nexus.UIApp/src/app/core/models/document-template.model.ts` — sem campo de conteúdo (nunca
  foi consumido como texto no frontend; segue só como bytes via download/upload).
- `TSI.Nexus.UIApp/package.json` — remove `jszip`/`jspdf-autotable` (instaladas na primeira
  tentativa desta spec, sem uso depois da centralização no backend).

## 5. Verificação

- Construir os 4 `.docx` padrão (já feito) e comparar visualmente (mesmo método de spec-6:
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
- Testar que um redeploy simulado (rebuild/republish da API) não apaga um template já
  customizado — confirma que o caminho de armazenamento em disco está fora da pasta publicada.
- Medir tempo de geração antes/depois pros 4 fluxos (mesma ressalva de spec anterior: este
  sandbox tem timing pouco confiável — usar o navegador local real do usuário como referência
  final, não só o container de dev).
- `dotnet test` limpo (testes novos pro `DocumentPdfGenerationService` — substituição de token,
  detecção de bloco, paginação por quebra explícita — e pro `DocumentTemplateService`/
  `DocumentTemplatesController` com armazenamento em disco).

## 6. Fora de escopo (reafirmando o que já estava decidido)

- Editor WYSIWYG embutido, preview antes de salvar upload, histórico de versões — já eram fora
  de escopo em `document-templates-design.md`, continuam fora aqui.
- Suporte a qualquer elemento OOXML fora do subconjunto da seção 3.2 — colunas, cabeçalho/rodapé
  nativo, caixas de texto, tabelas mescladas.
- Migração automática de um template `.html` já customizado em produção pro novo `.docx` — vira
  trabalho manual do admin depois do deploy.
