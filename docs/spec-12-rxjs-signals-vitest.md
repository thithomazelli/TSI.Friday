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
