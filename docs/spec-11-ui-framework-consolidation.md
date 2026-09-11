# Spec 11 — Consolidação dos frameworks de UI (Bootstrap/AdminLTE/Material/PrimeNG)

> Escrito a partir do item "4 frameworks de UI carregados ao mesmo tempo" da Auditoria de Segurança
> & Performance (Médio, pendente). Aguardando seu "ok" antes de codar qualquer coisa — e, neste
> caso, o mapeamento feito abaixo muda a recomendação em relação ao que a auditoria original
> sugeria, então o primeiro "ok" que preciso é sobre o que vale a pena tentar.

## 1. O que a auditoria original dizia

"4 frameworks de UI carregados ao mesmo tempo (Bootstrap + AdminLTE + Angular Material + PrimeNG) —
peso de CSS real e global, ainda que o uso de cada um seja razoavelmente contido na prática (Material
é quase só modal + autocomplete; PrimeNG, 3 arquivos)." Isso foi escrito como uma estimativa rápida
durante a varredura geral, sem mapear caso a caso — o que segue é esse mapeamento, feito de fato
antes de propor qualquer remoção.

## 2. Mapeamento real de uso (feito nesta sessão)

### 2.1 Bootstrap + AdminLTE

Base do layout inteiro (sidebar, navbar, cards, `form-floating`/`input-group` em todo formulário,
`btn`/`badge` em toda tela). Não são candidatos a remoção — são o esqueleto visual do app definido
como padrão obrigatório no próprio CLAUDE.md ("Inputs de formulário: `form-floating` dentro de um
`input-group`..."). Fora de escopo desta spec.

### 2.2 Angular Material — **muito mais usado do que a estimativa original**

```
52 arquivos importam de '@angular/material/dialog'
13 arquivos importam de '@angular/material/autocomplete'
 1 arquivo importa de '@angular/material/core'
```

O `@angular/material/dialog` não é um uso pontual — é **o motor de modal de todo o app**. `ModalService`
(`core/services/modal/modal.service.ts`) embrulha `MatDialog`/`MatDialogRef`, e é essa camada que
toda tela usa pra abrir form/details-modal, seguindo o padrão obrigatório do CLAUDE.md ("Adicionar
sempre abre modal... Editar sempre abre modal..."). Os 52 arquivos são exatamente os componentes de
form e details-modal de cada entidade do sistema — ou seja, tocar nisso é tocar a base de interação
de praticamente toda tela do app, não uma feature isolada.

`@angular/material/autocomplete` aparece em 13 form components (campos de busca/seleção — cliente,
veículo, motorista, etc.).

**Conclusão sobre o Material: não é "quase só modal" no sentido de "uso pequeno e isolado" — é
"quase só modal" no sentido de "é o modal de tudo".** Removê-lo significa reescrever a abertura de
modal do app inteiro (52 pontos de chamada + a própria `ModalService`) para outra biblioteca (ex.:
`ng-bootstrap`, já que Bootstrap já está carregado, ou um overlay custom) — uma migração do porte da
spec-9 (OnPush rollout), só que com risco de regressão visual/funcional mais alto por afetar o fluxo
principal de edição de dado de cada entidade.

### 2.3 PrimeNG — uso real e mais contido, mas não trivial

Só 2 arquivos importam diretamente de pacotes `primeng/*`:

- `shared/components/date-field/date-field.component.ts` — usa `primeng/datepicker` (`DatePicker`).
  Esse componente é o `app-date-field` citado no CLAUDE.md como campo genérico obrigatório pra
  qualquer data em qualquer formulário do app — **usado indiretamente em dezenas de telas**, mesmo
  só 1 arquivo importar PrimeNG de fato.
- `shared/attachments/attachments.component.ts` — usa `primeng/api` (`MenuItem`), `primeng/bind`,
  `primeng/button`, `primeng/tooltip`, `primeng/contextmenu`, `primeng/dialog`, `primeng/inputtext`.
  É a UI de árvore de pastas/arquivos do painel de Anexos (usado como aba 1-N em várias entidades,
  por trás de um único componente compartilhado).

`app.config.ts` registra `providePrimeNG(...)` globalmente (tema + locale pt-BR pro datepicker).

**Conclusão sobre o PrimeNG:** blast radius bem menor que o Material (2 arquivos-fonte reais, não
52), mas ainda não é "trocar e pronto" — o datepicker é usado por todo formulário do app através de
`app-date-field`, e o painel de Anexos usa 5 componentes PrimeNG diferentes pra montar uma UI de
árvore de arquivos com menu de contexto, que não tem equivalente pronto no Bootstrap puro.

## 3. Recomendação

- **Não remover o Angular Material.** O peso de CSS/JS que ele adiciona é real, mas pequeno
  perto do risco de reescrever a abertura de modal de todo o sistema — e o ganho de performance
  disso é marginal comparado ao esforço e à superfície de regressão (52 arquivos, o fluxo mais usado
  do app). Não há uma ação de baixo risco aqui; é reescrever ou manter.
- **PrimeNG é o candidato mais defensável a reavaliar**, mas mesmo assim exige:
  - um datepicker substituto (nativo do Bootstrap não existe pronto; ou HTML5 `<input type=date>` com
    o `CurrencyFormatDirective`-like wrapper próprio, ou outra lib leve só pra isso), testado contra
    todo formulário que usa `app-date-field`;
  - reconstruir a árvore de pastas/context-menu/dialog dos Anexos sem PrimeNG (Bootstrap não tem
    componente de árvore de arquivos pronto — seria código novo, não só troca de import).
- Dado o mapeamento acima, **minha recomendação é não tocar em nenhum dos dois agora**: o item
  "4 frameworks simultâneos" da auditoria é real como observação de peso de bundle, mas nenhuma das
  duas remoções paga o risco/esforço pelo ganho, e a própria auditoria original já reconhecia isso
  ("uso de cada um razoavelmente contido"). Se a prioridade for reduzir peso de bundle, o retorno
  melhor está em lazy-loading mais agressivo do que já existe (ex.: `providePrimeNG` e o CSS do
  Material já só carregam onde importados, já que o app é 100% standalone com lazy loading por
  feature) do que em remover uma dependência inteira.

## 4. Se decidir seguir mesmo assim

Caso prefira seguir com a remoção do PrimeNG apesar da recomendação acima, o próximo passo — antes
de qualquer código — seria uma spec própria só pra isso (spec-12), escopando:
1. Escolha do datepicker substituto e prova de conceito em `app-date-field` isolado.
2. Escolha de como reconstruir o painel de Anexos (árvore + context menu + dialog) sem PrimeNG.
3. Plano de migração tela a tela com verificação visual, no mesmo formato de fases da spec-9.

Isso não está feito aqui porque depende da sua decisão sobre a recomendação da seção 3 primeiro.

## 5. Decisão

Caminho 1 aceito: manter Angular Material e PrimeNG como estão — nenhum dos dois é peso morto
(Material é o motor de modal do app inteiro; PrimeNG sustenta o campo de data compartilhado e o
painel de Anexos), e o risco/esforço de removê-los não compensa o ganho de bundle. Nenhuma alteração
de código decorre desta spec. Item marcado como resolvido/avaliado na Auditoria de Segurança &
Performance.
