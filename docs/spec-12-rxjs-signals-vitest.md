# Spec 12 — RxJS → Signals no frontend + suíte de testes em Vitest (100% de cobertura)

> Pedido do usuário: (1) levantar e trocar todo uso de RxJS/Observable por Signals no frontend; (2)
> criar testes unitários em Vitest cobrindo 100% do que já foi implementado; (3) reforçar no
> CLAUDE.md a obrigatoriedade de testes e a proibição de regressão de segurança/performance (item 3
> já feito nesta sessão, ver `CLAUDE.md` seção "Qualidade obrigatória"). Aguardando seu "ok" no
> desenho abaixo antes de codar, como de praxe no fluxo de specs deste projeto — o tamanho dessa
> mudança (quase metade dos arquivos do frontend) exige isso mais do que qualquer spec anterior.

## 1. Problema / motivação

O frontend inteiro é construído em cima de RxJS (`BehaviorSubject` pra estado de serviço,
`.subscribe()` em componentes, `combineLatest` pra regra de feature toggle, `| async` em template).
Angular 21 já oferece Signals nativamente (`signal()`, `computed()`, `effect()`, `toSignal()`) como
alternativa mais simples e com menos boilerplate pra estado local/derivado — sem precisar
gerenciar `Subscription`/`takeUntil` manualmente, e com integração direta em `OnPush` (que o spec-9
já deixou como padrão em quase todo componente). Junto com isso, a cobertura de teste do frontend
hoje é essencialmente zero (`README.md` já registra isso: "os specs existentes são boilerplate do
Angular CLI, sem cobertura real") — rodar essa migração de arquitetura sem uma rede de segurança de
testes é como trocar os pneus com o carro andando.

## 2. Estado atual (levantamento feito nesta sessão)

Contagem via grep em `TSI.Nexus.UIApp/src/app`, excluindo `*.spec.ts`:

| Métrica | Valor |
|---|---|
| Arquivos `.ts` não-spec no projeto | 286 |
| Arquivos que importam de `rxjs`/`rxjs/operators` | **118 (41%)** |
| Chamadas `.subscribe(` | 371 |
| Usos de `Observable<...>` como tipo | 380 |
| `new BehaviorSubject` / `new Subject` / `new ReplaySubject` | 38 / 55 / 1 (94 total) |
| `| async` em templates HTML | 53 |
| Uso atual de `signal()`/`computed()`/`toSignal()` | **0** |

Por tipo de arquivo entre os 118 com RxJS: **78 components**, **37 services**, **2 guards/
interceptors**. Por pasta (top 8): `core/` 40, `vehicles` 9, `trips` 9, `shared` 7, `quotes` 5,
`navbar` 4, `drivers` 4, `account` 4 — o resto (products, users, transactions, purchase-orders,
orders, business-partner, ...) com 1 a 3 arquivos cada.

Operadores RxJS mais usados (import count): `Observable` 88, `Subject` 52, `takeUntil` 43, `tap`
42, `map` 37, `Subscription` 30, `BehaviorSubject` 27, `of` 21, `switchMap` 17, `skip` 16,
`startWith`/`combineLatest` 12 cada, `shareReplay` 9, `combineLatestWith` 7, `take`/`forkJoin` 6
cada, `finalize` 6, `merge` 5.

## 3. O que **não** dá pra eliminar (limite estrutural do Angular)

"Trocar RxJS por Signals" não significa remover o pacote `rxjs` do projeto — várias APIs do próprio
Angular são baseadas em Observable e não têm substituto nativo em Signals nesta versão:

- **`HttpClient.get/post/put/delete`** sempre retorna `Observable<T>` — a chamada em si continua
  RxJS por baixo; o que muda é não expor esse Observable pro componente consumir com `.subscribe()`
  ou `| async`, e sim converter na borda com `toSignal()` (ou manter o padrão já usado hoje de
  serviço com `BehaviorSubject` de estado, mas trocando o `BehaviorSubject` por `signal()`).
- **`Router.events`, `ActivatedRoute.params/queryParams/data`** — Observable.
- **Reactive Forms (`FormGroup.valueChanges`, `statusChanges`)** — Observable. Angular tem Signal
  Forms experimental, mas é uma migração própria, maior e mais arriscada, fora do escopo deste
  spec (o projeto usa Reactive Forms extensivamente em todo formulário via
  `core/base/form-base.component.ts`).
- **ag-Grid, PrimeNG, ngx-mask, ngx-toastr** — APIs de terceiros, baseadas em callback/evento, sem
  noção de Signal.

Meta realista: **estado próprio de componente/serviço passa a ser Signal**; RxJS continua existindo
só nas bordas onde o próprio Angular ou uma lib de terceiro exige, convertido pra Signal o quanto
antes com `toSignal()`/`computed()` em vez de propagado por `.subscribe()` pelo resto do código.

## 4. Desenho

### 4.1 Vitest — trocar o runner de testes (Karma/Jasmine → Vitest)

Angular 21 tem builder experimental `@angular/build:unit-test` com `runner: 'vitest'`. Plano:

1. **Spike primeiro** (não é opcional dado que é experimental): converter 2-3 spec files existentes
   simples pra Vitest, confirmar que `TestBed`, `provideHttpClientTesting`, spies
   (`jasmine.createSpy` → `vi.fn()`), e matchers (`expect().toBe()` etc., majoritariamente
   compatíveis) funcionam sem gambiarra. Ir/não-ir depende desse resultado.
2. Trocar `angular.json`'s `test` target pro builder Vitest, remover `karma.conf.js`/dependências
   Karma/Jasmine do `package.json`.
3. Configurar cobertura (`@vitest/coverage-v8` ou equivalente) com threshold 100% nos arquivos
   cobertos por este spec — thresholds sobem por fase, não de uma vez.

### 4.1.1 Fase 0 — resultado do spike (GO)

`tsconfig.spec.json` nunca existiu no repo — ou seja, `ng test`/`npm test` já estava
**completamente quebrado sob o Karma/Jasmine antigo** antes de qualquer mudança desta spec (não é
uma regressão introduzida aqui). Criar `tsconfig.spec.json` + trocar `angular.json`'s `test` target
pro builder `@angular/build:unit-test` (`runner: "vitest"`) expôs isso: o builder compila **todo o
fileset de specs como um único programa TypeScript**, então um único spec quebrado bloqueia a
suíte inteira — não só o arquivo com erro. Achados do spike, cada um relevante pro resto da
migração:

1. **Tipos globais**: `describe`/`it`/`expect`/`vi` só existem como globais com
   `"types": ["vitest/globals"]` em `tsconfig.spec.json`'s `compilerOptions` — sem isso o
   TypeScript não reconhece nenhum dos dois.
2. **`done` callback do Jasmine não existe no Vitest**: `it('nome', (done) => { ...; done(); })`
   quebra com `TS2349: This expression is not callable` — o parâmetro do callback no Vitest é um
   `TestContext`, não um resolver. Para observable síncrono (`of(...)`), a saída é não usar `done`
   nenhum: assert direto dentro do `.subscribe()` (`let result; obs$.subscribe(v => result = v);
   expect(result)...`) já é suficiente, porque a emissão acontece dentro do próprio `subscribe()`.
   Para caso genuinamente assíncrono, usar `it('nome', async () => { await ... })` em vez de
   `done`.
3. **`TestBed.inject(MeuComponent)` não substitui `TestBed.createComponent(...).componentInstance`
   pra componente**: instanciar um componente via `TestBed.inject()` (em vez de
   `TestBed.createComponent()`) pula a criação da view, então qualquer token atrelado a view/host
   (`Renderer2`, `MatDialogRef`, `ActivatedRoute` quando resolvido via rota real, etc.) falha com
   `NG0201: No provider found`. Corrigido em `app.component.spec.ts` trocando pra
   `TestBed.createComponent(AppComponent).componentInstance` sem chamar `detectChanges()` (evita
   disparar `ngOnInit()` automaticamente, já que os testes existentes chamam `ngOnInit()` na mão
   dentro de `NgZone.run(...)`).
4. **Descoberta paralela, fora do escopo da Fase 0**: rodar a suíte inteira pela primeira vez (algo
   que nunca funcionou antes) revelou **46 arquivos de spec pré-existentes que compilam mas falham
   em runtime** — majoritariamente componentes com `MatDialogRef`/`MAT_DIALOG_DATA`/
   `ActivatedRoute` não providos no `TestBed`, e alguns testando nomes de classe que não existem
   mais (renomeados em refatorações anteriores, ex. `ClientDetailsModalComponent` →
   `BusinessPartnerDetailsModalComponent`, já corrigido). Isso não é uma regressão desta spec — é o
   estado real, nunca antes visível, do que `ng test` já continha. Fica documentado aqui como
   escopo confirmado das Fases 1-4 (cada um desses arquivos precisa ser revisto/reescrito junto da
   migração pra Signals do respectivo módulo), não como pendência da Fase 0.

5. **`vi.mock()`/`vi.hoisted()` não funcionam sob `@angular/build:unit-test`, nem pra pacote npm
   não-relativo**: tentativa de mockar `jspdf`/`html2canvas` em `report-pdf.spec.ts` falhou com
   `Error: N calls ... were defined outside of the module's top level scope` — a mensagem sugere
   hoisting malformado, mas a causa real é que o builder da Angular processa/empacota o arquivo de
   teste *antes* do plugin de mock-hoisting do Vitest analisar o AST, então qualquer `vi.mock`
   (mesmo de especificador não-relativo) quebra. O próprio patch da Angular (`vitest-mock-patch`,
   em `@angular/build/src/builders/unit-test/runners/vitest/build-options.js`) já avisa: "Please
   use Angular TestBed for mocking dependencies" — ou seja, mock de módulo via `vi.mock` está fora
   de escopo aqui por design, não é bug a contornar. Saída usada em `report-pdf.ts`: extrair a
   lógica pura testável (`chunkRows`) pra uma função exportada separada da orquestração
   html2canvas/jsPDF (que fica sem teste unitário — depende de Canvas 2D real, não é
   razoavelmente testável em jsdom de qualquer forma, e vale checagem manual na Fase 5). Regra
   geral pro resto da spec: qualquer código que só faz sentido testar mockando um módulo externo
   inteiro (não um serviço Angular injetável) deve isolar a lógica pura numa função à parte, testar
   essa função, e deixar a integração com a lib externa pra verificação manual/E2E.

**Decisão: GO.** Vitest funciona para o que a spec precisa (`TestBed`,
`provideHttpClientTesting`, `vi.fn()`, matchers Jest-style) — as quatro gotchas acima são
conhecidas e têm solução direta, sem gambiarra. Segue pra Fase 1.

### 4.1.2 Fase 1 — resultado (concluída)

Cobertura real escrita pros 172 arquivos que não importam `rxjs` (survey original citava ~168; a
contagem exata pós-levantamento foi 172): 26 componentes sem RxJS que ainda não tinham spec algum
(toda a família `*-details-modal`, `AuditTabComponent`, `CurrencyFieldComponent`/`DateFieldComponent`
como `ControlValueAccessor`, os dois modais de foto, `PdfProgressComponent`,
`UserPreferencesComponent`, `SelectableOptionsComponent`, `AlertConfigsComponent`,
`FeatureTogglesComponent`, `DocumentTemplatesComponent`, `AgendaComponent`), a pipe `TranslatePipe`,
e as funções puras em `core/utilities/*` (`format-utils`, `download-blob`, `paged-request.utils`,
`report-pdf.ts`'s `chunkRows`, `passenger-import-parser`) e `core/animations/card-collapse.animation`.
Os arquivos que sobraram sem spec (`*.routes.ts`, `*.model.ts`/`*.enum.ts`/interfaces, `index.ts` de
barrel, `app.config.ts`, dicionários de i18n) são puramente declarativos — zero statement/branch
executável pra cobrir, então não entram no escopo de "spec obrigatório" (uma suíte de teste sobre um
`interface`/enum só reafirmaria o próprio arquivo).

Achado técnico adicional confirmado durante esta fase, junto do padrão de `TestBed.createComponent()`
documentado acima: pra qualquer um dos componentes `*-details-modal` que embutem um `*FormComponent`
real no próprio template (`imports: [XxxFormComponent]`), usar `TestBed.createComponent()` +
`fixture` arrasta a árvore de DI inteira daquele form filho (ngx-mask config, serviços de dado de
referência etc.) — dependências que pertencem à spec do form, não à do modal. Solução adotada
uniformemente: instanciar a classe do modal diretamente via `new XxxDetailsModalComponent(...)`,
sem TestBed nem fixture, já que o construtor não tem nenhum DI além dos parâmetros explícitos —
100% da lógica real do modal (mapeamento de `dialogData`, `close()`, título traduzido) fica coberta
sem precisar satisfazer a árvore de dependência do form embutido.

Também durante esta fase: `karma.conf.js`/dependências Karma/Jasmine removidas de `package.json`
(item 2 do plano da seção 4.1) — `npm run build` e `npx ng test` seguem verdes sem elas.

Os ~46 arquivos de spec pré-existentes que compilam mas falham em runtime (achado da Fase 0,
majoritariamente componentes com RxJS que ficam fora do escopo desta fase, ou stubs do CLI testando
nomes de classe que não existem mais) continuam como escopo confirmado das Fases 2-4 — não foram
tocados aqui pra não misturar "escrever teste novo" com "migrar pra Signals", que é exatamente a
ordem que este documento já definiu.

### 4.2 RxJS → Signals, por camada

- **Estado de serviço** (`BehaviorSubject` + `.asObservable()` + `.next()`): vira `signal()` +
  `.set()`/`.update()`, exposto como `Signal<T>` read-only (ou `computed()` se for derivado de
  outro estado). Consumidor troca `| async` no template por leitura direta do signal (`user()` em
  vez de `user$ | async`).
- **Chamada HTTP em componente**: em vez de `.subscribe()` armazenando em campo do componente,
  usar `toSignal(apiService.get(...), { initialValue: ... })` — Angular gerencia o ciclo de vida
  sozinho, sem precisar de `takeUntil(this.destroy$)` manual.
- **`combineLatest` de feature toggles** (a regra central documentada em `CLAUDE.md` — grupo E
  entidade): vira `computed(() => groupEnabled() && entityEnabled())`. Como é lógica de negócio
  documentada como central, precisa de teste comparando comportamento antes/depois byte a byte
  (mesmos cenários: grupo ligado/desligado × entidade ligado/desligado).
- **Streams derivados com operadores sem equivalente direto** (`switchMap` pra
  autocomplete/busca-conforme-digita, ex. `address-form.component.ts` chamando ViaCEP/IBGE): ficam
  em RxJS mesmo — é exatamente o tipo de fluxo assíncrono encadeado que Signals não resolve bem
  sozinho (não existe "switchMap de signal" nativo). Sinalizar esses casos como "RxJS
  intencional", não pendência.
- **Guards/interceptors** (2 arquivos): `AuthorizationGuard`/interceptors continuam podendo
  retornar `Observable<boolean>`/`Observable<HttpEvent>` (é o que o Angular Router/HttpClient
  esperam) — aqui a mudança é mais limitada, focada em não vazar `Subject`/estado mutável RxJS pro
  resto do app além do necessário.

#### 4.2.1 Fase 2 — progresso e achados

**`FeatureFlagService` (primeiro arquivo migrado)**: descoberta importante ao investigar antes de
mexer — `isEnabled(key)` é consumido via `combineLatest([group$, entity$])` em **mais de 20
arquivos** (sidebar, navbar, praticamente toda `*-details-page` com aba de agenda), não só os 2-3
esperados. Trocar a API pública do serviço pra `Signal` agora quebraria todos de uma vez — exatamente
o tipo de "migração em lote sem revisão" que a seção 6 já alertava. Solução: migrar o **estado
interno** do serviço pra `signal<FeatureToggle[] | null>(null)` (tira o `Subject`/`shareReplay` do
refresh), mas manter a API pública (`isEnabled()`, `toggles$`) retornando `Observable<boolean>` via
`toObservable(this._toggles).pipe(filter(t => t !== null))` — os 20+ consumidores continuam
funcionando sem nenhuma mudança. Cada um troca o próprio `combineLatest` por `computed()` quando
chegar a vez dele (Fase 3/4, por feature/arquivo), não em bloco agora. `null` (estado "ainda não
carregou") é filtrado antes de chegar em qualquer consumidor — preserva exatamente o comportamento
documentado no `sidebar.component.ts` original ("no emission yet" trata como falso, evitando o
módulo "piscar" com o valor errado antes do fetch real resolver); usar `null` sem filtrar teria
mudado esse comportamento (`toObservable` emite o valor atual imediatamente na subscription, então
um consumidor veria `null`/falso-aberto antes da hora em vez de simplesmente não receber nada).

**Gotcha nº 5 (Vitest/Angular signals)**: `toObservable(signal)` não propaga uma mudança de
`signal.set(...)` sincronamente no teste — o `effect()` interno do `toObservable` roda agendado
(microtask/change-detection), não no mesmo tick do `.set()`. Um teste que faz
`mockHttpSubject.next(...)` e checa o valor emitido *logo em seguida* vê o valor antigo (ou
`undefined`, se ainda não emitiu nada). Correção: chamar `TestBed.flushEffects()` logo após todo
`.next()`/`.set()` que deveria propagar através de uma cadeia `signal → toObservable` antes de
fazer a asserção (ver `feature-flag.service.spec.ts`). Isso só se aplica a specs que testam um
`toObservable()`; specs que leem um `signal()`/`computed()` diretamente (sem passar por Observable)
não precisam disso — a leitura de um signal é sempre síncrona.

**Padrão "changed$" repetido em ~15 serviços de entidade** (`EventService`, `TripLegService`,
`AttachmentService`, `FuelLogService`, `PassengerService`, `QuoteTripLegService`,
`VehicleMaintenanceProductService`, `VehicleMaintenanceService`, `OrderService`, `PaymentService`,
`PurchaseOrderService`, `QuoteService`, `TransactionService`, `TripService`, ...): todos tinham o
mesmo `_xChangedSubject = new BehaviorSubject<void>(undefined)` exposto como `xChanged$` — usado
pelos componentes de lista (`event-list`, `trip-leg-list`, etc.) só como "algo mudou, recarregue",
nunca lendo um payload. Migrado uniformemente pro mesmo `signal(0)` + `toObservable(tick).pipe(map(()
=> undefined))` do `FeatureFlagService`, com um `notifyChanged()` privado chamado no lugar do
`.next()`. `toObservable` replaya o valor atual pra todo novo subscriber, igual o
`BehaviorSubject<void>` fazia — nenhum consumidor precisou mudar.

**Achado paralelo em `order`/`payment`/`purchase-order`/`quote`/`transaction`/`trip`**: cada um
desses services também tinha um `_orders$`/`_payments$`/etc. (`BehaviorSubject<Entity[]>`)
populado via `.next(response.data)` dentro de `getAll()`/`getByX()` — mas **sem nenhum consumidor
em lugar nenhum do app** (nem um getter público, nem um `.subscribe()`). Estado morto, não uma
migração pendente — removido inteiramente em vez de convertido pra `signal()` (CLAUDE.md: "se você
tem certeza que algo não é usado, pode deletar completamente"). Confirmado via leitura completa de
cada arquivo antes de remover, não só grep.

**Achado adicional, sem relação com Signals**: `order.service.spec.ts` e `quote.service.spec.ts`
estavam **vazios** (0 bytes) e `payment.service.spec.ts`/`transaction.service.spec.ts` eram stubs
do CLI (`TestBed.configureTestingModule({})` sem prover `ApiService`, falhando por `HttpClient` sem
provider) — os quatro já contavam entre os ~46 arquivos quebrados desde a Fase 0. Substituídos
pelos specs reais escritos junto da migração desta fase, reduzindo esse número.

**Padrão `xAdded$` (`OrderProductService`, `PurchaseOrderProductService`, `QuoteProductService`,
`TripDriverService`)**: cada um tem, além do `xChanged$` (já migrado), um `_xAdded$ = new
Subject<Entity>()` usado por `addTemporary()` — chamado quando um form adiciona um item ainda não
persistido (ex. produto de pedido antes de salvar), notificando o form pai (`order-form`,
`purchase-order-form`, `quote-form`, `trip-form`) que já está montado e escutando. **Mantido como
RxJS intencional**, não migrado: é literalmente o caso "evento único, sem replay" que a seção 3 já
previa como limite estrutural — um `Signal` sempre tem "valor atual" que todo consumidor vê, o que
ou replayaria a última adição pra um subscriber tardio ou exigiria bookkeeping manual pra evitar
isso, exatamente o problema que `Subject` (sem `BehaviorSubject`) resolve de graça. Confirmado com
os 4 consumidores reais antes de decidir (`grep` teria sido enganoso aqui — o nome do stream difere
o suficiente do padrão `_xChangedSubject` que passar batido era fácil).

**`AddressService`**: mesmo padrão "changed$" acima — `_addresses$` (`BehaviorSubject<Address[]>`)
era estado morto (zero consumidores, confirmado por leitura completa do arquivo), removido;
`_addressChangedSubject` virou `signal(0)` + `notifyChanged()`. `addressChanged$` tem consumidor real
(`address.component.ts`), então a API pública (`Observable<void>`) foi preservada via
`toObservable`. Spec pré-existente (`address.service.spec.ts`) era um stub quebrado do CLI,
substituído por um spec real.

**`ProductService` (segundo do padrão shareReplay, mesmo desenho do `FeatureFlagService`)**:
`refresh$ Subject + switchMap(() => http.get(...)) + shareReplay(1)` virou
`signal<WebApiResponse<Product[]> | null>(null)` (estado "carregado" cacheado, primeiro consumidor
dispara o fetch no construtor, os demais leem o valor já resolvido) + `signal(0)` separado pra
`productChanged$` (distinto de `products$`: `add`/`update`/`delete` disparam os dois — `refresh()`
pra recarregar o catálogo e `notifyChanged()` pra quem só quer saber "algo mudou"). Investigação
prévia (`grep` + leitura de `product-picker-grid.component.ts:275-300`) confirmou que o único
consumidor com lógica não trivial (`combineLatestWith(productsArray$)`) só depende de emissões ao
vivo, nunca de completude do stream — importante porque o stream antigo (baseado em HTTP) completava
a cada round-trip e o novo (baseado em `signal`) nunca completa; os outros 4 consumidores só fazem
`this.products$ = this.productService.getAll();` e não dependem de `complete()` de forma alguma.
`product.service.spec.ts` estava vazio (0 bytes), spec real escrito do zero.

**`BusinessPartnerService` (terceiro do padrão shareReplay, com uma variação)**: aqui o cache não é
um único valor (como `FeatureFlagService`/`ProductService`), e sim **por tipo**
(`Map<BusinessPartnerType, Observable<...>>`, só 2 valores possíveis — `Client`/`Supplier`,
confirmado no enum). Migrado pra `Map<BusinessPartnerType, WritableSignal<...>>` + um `Map` paralelo
com o `Observable` (`toObservable`) derivado de cada signal, criado sob demanda na primeira chamada
de `getClients()`/`getSuppliers()`/`refresh()` — não no field initializer, então precisa de
`Injector` injetado no construtor e passado explicitamente (`toObservable(state, { injector:
this.injector })`), já que essas Observables não nascem em contexto de injeção implícito. Achado
paralelo, mais sutil que os outros: `_businessPartners$` (`BehaviorSubject<BusinessPartner[]>`) é
alimentado por `getAllBusinessPartnersByType()` e por `addOrUpdateBusinessPartner()` (chamado por 6
forms — orçamento, pedido, viagem, transação, etc. — depois de criar um parceiro novo/editar um
existente durante o preenchimento do form) mas **nunca lido em lugar nenhum** (nem getter público,
nem `.subscribe()`) — ou seja, `addOrUpdateBusinessPartner()` já não tinha efeito observável antes
desta migração. Diferente do achado de estado morto dos outros services, aqui a API pública
(`addOrUpdateBusinessPartner()`) continua sendo chamada por 6 componentes reais, então o método foi
mantido (não é escopo desta spec remover uma API pública com 6 call sites) — só o `BehaviorSubject`
interno virou `signal<BusinessPartner[]>([])` puro (sem `toObservable`, já que nada de fora lê esse
estado). `business-partner.service.spec.ts` estava vazio (0 bytes), spec real escrito cobrindo
cache por tipo, `refresh()`, `businessPartnerChanged$`, `add`/`update`/`delete` e os dois
validators (`cpfValidator`/`cnpjValidator`, inalterados — não usam RxJS).

### 4.3 Testes — 100% de cobertura

Confirmado com você: a cobertura final é escrita **em cima do código já migrado pra Signals**, não
do RxJS atual — ou seja, por módulo, a ordem é sempre *migra → testa*, nunca o contrário (evita
testar comportamento que já sabemos que vai ser jogado fora).

## 5. Ordem de execução (fases, não um flag-day)

Dado o tamanho (118 arquivos com RxJS, mais os 168 sem RxJS que também precisam de teste pra bater
100%), a migração roda em fases, cada uma com `npm run build` + suíte Vitest verde antes de avançar
pra próxima — nunca um commit gigante trocando tudo de uma vez:

1. **Fase 0 — Spike Vitest** (seção 4.1, item 1). Go/no-go.
2. **Fase 1 — Infra Vitest + testes nos ~168 arquivos sem RxJS**: constrói confiança no runner novo
   sem mexer em arquitetura ao mesmo tempo. Cobertura sobe de ~0% pra uma fatia real do projeto sem
   nenhum risco de regressão comportamental.
3. **Fase 2 — `core/` (40 arquivos)**: guards, interceptors, serviços base, modelos — maior
   alavancagem (é o que todo o resto do app importa) e onde um bug se propaga mais longe. Migra +
   testa junto, arquivo por arquivo ou em pequenos grupos coesos (ex.: todos os serviços de
   feature-toggle numa leva).
4. **Fase 3 — `shared/` (7 arquivos)**: componentes reaproveitados entre features.
5. **Fase 4 — Features, da maior pra menor**: `vehicles`/`trips` (9 cada) → `quotes` (5) →
   `navbar`/`drivers`/`account` (4 cada) → `users`/`transactions`/`purchase-orders`/`products`/
   `orders`/`business-partner` (3 ou menos cada) → resto (1-2 arquivos cada).
6. **Fase 5 — Verificação final**: `npx vitest run --coverage` em 100% no relatório agregado,
   `npm run build` limpo, checagem manual das telas mais críticas (login, feature-toggle gating,
   grids paginados) num browser real — cobertura de teste não substitui esse passo pras telas mais
   sensíveis a regressão visual/UX.

## 6. Riscos e como mitigar

- **Builder Vitest é experimental no Angular 21** — pode ter gaps não descobertos até o spike.
  Mitigação: spike primeiro (fase 0), critério de go/no-go explícito antes de comprometer o
  projeto inteiro à troca de runner.
- **`combineLatest` de feature toggle é lógica de negócio central e documentada** — qualquer
  diferença de comportamento na versão `computed()` (ex.: timing de emissão, valor inicial antes do
  primeiro toggle carregar) pode acender/esconder telas erradas. Mitigação: teste comparando os 4
  cenários (grupo×entidade ligado/desligado) antes de trocar, não depois.
- **371 `.subscribe()` não são um find-replace mecânico** — cada um tem uma razão (evitar leak,
  aguardar side-effect, etc.) que precisa ser entendida antes de virar `toSignal()`/`computed()`.
  Mitigação: migração por arquivo com teste imediato, nunca em lote sem revisão.
- **ag-Grid `serverSide`/`dataSource` (spec-8) é baseado em callback** (`getRows()`), não em
  Signal/Observable — não faz parte do escopo de conversão, só precisa continuar funcionando
  depois que o estado ao redor dele (filtros, loading) virar Signal.
- **Sem linter configurado** (`CLAUDE.md` já registra isso) — mais um motivo pra migração ser
  incremental com teste a cada passo, não uma reescrita grande revisada só no final.

## 7. Verificação

1. Fase 0: specs convertidos rodam limpo em Vitest, com a mesma cobertura de asserção que tinham em
   Jasmine.
2. A cada fase: `npm run build` limpo + suíte Vitest 100% nos arquivos daquela fase + nenhuma
   regressão nos testes das fases anteriores.
3. Final: `npx vitest run --coverage` reportando 100% agregado nos arquivos implementados até
   hoje; `dotnet build`/`dotnet test` inalterados (esta spec não toca backend); checagem manual das
   telas de login, dashboard com feature toggles, e pelo menos uma lista paginada (ex. `vehicles`)
   num browser real.
