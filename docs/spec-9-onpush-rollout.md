# Spec 9 — Rollout de `ChangeDetectionStrategy.OnPush`

> Escrito antes de qualquer código ser tocado, a partir do item "componentes sem OnPush" registrado
> na varredura de performance desta sessão (task #62). Aguardando seu "ok" no desenho antes de
> codar, como de praxe no fluxo de specs deste projeto. A metade "formatadores compartilhados" da
> mesma task já foi feita separadamente (refatoração mecânica, sem risco de comportamento) e não faz
> parte desta spec.

## 1. Problema

### 1.1 Estado atual

128 componentes standalone no app; **9** já usam `ChangeDetectionStrategy.OnPush`
(`orders.component.ts`, `products.component.ts`, `transactions.component.ts` entre eles) — o
restante roda na estratégia `Default`, que revalida a árvore inteira a cada evento assíncrono
(clique, timer, resposta HTTP) em qualquer lugar do app, não só onde a mudança de fato ocorreu. Numa
tela com grids grandes (ag-Grid) e várias abas/formulários simultâneos, isso é trabalho de detecção
de mudança descartado a cada interação — o tipo de custo que só cresce com o tamanho do app.

### 1.2 Por que não é só adicionar a flag em todo componente

`OnPush` muda a regra: o componente só revalida quando (a) um `@Input()` recebe uma **referência**
nova (não uma mutação do mesmo objeto/array), (b) um evento disparado de dentro do próprio template,
ou (c) alguém chama `ChangeDetectorRef.markForCheck()`/`detectChanges()` explicitamente. Nenhum
componente hoje usa `ChangeDetectorRef` fora dos 9 já em OnPush — ou seja, **nenhum dos componentes
restantes foi preparado para essa regra**, e um grupo relevante depende ativamente do padrão que
OnPush quebra:

- **Mutação de array/objeto vinculado por `@Input()`**: `trip-form.component.ts:160`
  (`this.data.tripDrivers.push(tripDriver)`), `quote-form.component.ts:173,390`
  (`push`/`splice` em `quoteProducts`), `business-partner-form.component.ts:208,331`
  (`this.data!.addresses.push(...)`), `shared/attachments/attachments.component.ts:243,644,679`
  (`push` em `currentFolder.children`/`rootFolder.files`). Em `Default`, a mutação é pega porque
  Angular revalida de qualquer jeito; em `OnPush`, a referência do array não mudou — a view
  simplesmente não atualiza, silenciosamente, sem erro.
- **Timers que atualizam estado vinculado ao template**: `setTimeout` em `trip-form.component.ts`
  (linhas 335, 603, 690), `quote-form.component.ts` (330, 548, 575),
  `shared/attachments/attachments.component.ts:184`. Um callback de `setTimeout` roda fora do fluxo
  de eventos que `OnPush` observa — sem `markForCheck()`, a mudança fica presa até o próximo
  evento que *por acaso* dispare detecção em outro lugar da árvore.

`attachments.component.ts` em particular é um componente compartilhado usado por várias features —
uma quebra ali não fica isolada a uma tela.

Aplicar `OnPush` em bloco, sem tratar esses casos primeiro, troca "grid um pouco mais lento" por
"campo que não atualiza na tela até o usuário navegar pra outro lugar" — uma regressão pior que o
problema original e muito mais difícil de notar em revisão (não quebra o build, não aparece em
teste unitário salvo que o teste force `detectChanges()`).

## 2. Desenho

### 2.1 Fase 1 — componentes já seguros, sem alteração de código além da flag

Os componentes de **lista** (`*.component.ts` na raiz de cada feature: `vehicles`, `drivers`,
`purchase-orders`, `quotes`, `payments`, `trips`, e outros no mesmo molde) seguem o padrão já
comprovado pelos 9 componentes atualmente em OnPush: recebem dados via `subscribe()` de um
`Observable` e reatribuem `this.rowData = response.data` (troca de referência, não mutação),
delegando toda a interação de UI para o `<app-grid>` (que já dispara seus próprios eventos Angular
normalmente, cobertos por OnPush sem problema). Amostra verificada nesta sessão (`vehicles`,
`drivers`, `purchase-orders`, `quotes`, `payments`, `trips`) não mostrou mutação in-place nem timer
tocando estado do template — mesmo formato dos componentes já em OnPush hoje.

Migração: adicionar `changeDetection: ChangeDetectionStrategy.OnPush` no `@Component`, sem qualquer
outra mudança. Cada componente migrado é testado manualmente (lista carrega, filtro/paginação client
side do grid funciona, abrir/editar/excluir via modal atualiza a lista) antes de seguir pro próximo.

### 2.2 Fase 2 — componentes de formulário com mutação in-place, refatorados antes de ganhar OnPush

Lista (não exaustiva — auditar irmãos no mesmo padrão ao chegar nesta fase, ex. `order-form`,
`purchase-order-form`, `transaction-form`, `event-form`, prováveis candidatos pelo mesmo molde de
`@Input() data` + grid de itens 1-N):

- `trips/components/trip-form/trip-form.component.ts`
- `quotes/components/quote-form/quote-form.component.ts`
- `business-partner/components/business-partner-form/business-partner-form.component.ts`
- `shared/components/attachments/attachments.component.ts`

Para cada um: trocar `array.push(x)` / `array.splice(i, 1)` por reatribuição
(`this.data.tripDrivers = [...this.data.tripDrivers, tripDriver]`, e equivalente para remoção via
`.filter()`), e cada `setTimeout` que atualiza estado do template ganha um
`this.cdr.markForCheck()` ao final do callback (injetando `ChangeDetectorRef` no construtor, mesmo
padrão que qualquer outro componente Angular usa pra isso). Só depois dessa refatoração o componente
recebe a flag `OnPush`. Cada componente desta fase é testado manualmente: adicionar/remover item da
lista 1-N reflete na tela imediatamente, e qualquer fluxo que passe pelo `setTimeout` (ex.: mensagem
de sucesso temporária, debounce de busca) continua aparecendo/desaparecendo no tempo certo.

### 2.3 Fora do escopo, deliberadamente

- Componentes fora da amostra verificada nas fases acima **não** ganham OnPush nesta spec — cada um
  entra em uma fase futura só depois de passar pela mesma auditoria (grep por `.push(`/`.splice(`
  em campos que sejam `@Input()`, por `setTimeout`/`setInterval`, e confirmação manual de que não há
  mutação in-place não coberta).
- Nenhuma mudança de comportamento visível é intencional — o objetivo é reduzir trabalho de
  detecção de mudança descartado, não mudar o que a tela mostra.
- `ChangeDetectorRef` não é adicionado preventivamente em componentes que não precisam (Fase 1) —
  só onde a Fase 2 identifica um `setTimeout`/callback fora do fluxo de eventos Angular.

## 3. Arquivos a alterar

**Fase 1** (por componente, mesmo padrão em cada um):
- `<feature>/<feature>.component.ts` — import de `ChangeDetectionStrategy`, flag no `@Component`

**Fase 2** (por componente, mesmo padrão em cada um):
- `<feature>/components/<entidade>-form/<entidade>-form.component.ts` (ou equivalente) — troca de
  mutação in-place por reatribuição, `ChangeDetectorRef` injetado + `markForCheck()` nos callbacks
  assíncronos, flag `OnPush` no `@Component`

## 4. Verificação

1. `ng build --configuration production` limpo após cada componente migrado.
2. Por componente da Fase 1: abrir a lista, confirmar que carrega/filtra/pagina (client-side) sem
   diferença visual, abrir modal de adicionar/editar/excluir e confirmar que a lista reflete a
   mudança imediatamente após o modal fechar.
3. Por componente da Fase 2: adicionar e remover um item da grid de relacionamento 1-N (ex.:
   motorista da viagem, produto do orçamento, endereço do parceiro, anexo) e confirmar atualização
   imediata na tela; disparar o fluxo que passa pelo `setTimeout` identificado (mensagem temporária,
   debounce, etc.) e confirmar que aparece/some no tempo esperado.
4. Nenhum teste automatizado de frontend existe hoje neste projeto para estes componentes
   (`ng test` depende de configuração ausente no ambiente — fora do escopo desta spec); a
   verificação é manual, componente a componente, como descrito acima.
