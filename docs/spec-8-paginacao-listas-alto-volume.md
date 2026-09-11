# Spec 8 — Paginação server-side nas listagens de maior volume

> Escrito antes de qualquer código ser tocado, a partir do achado "sem paginação nas listagens"
> registrado na varredura de segurança/performance desta sessão. Aguardando seu "ok" no desenho
> antes de codar, como de praxe no fluxo de specs deste projeto.

## 1. Problema

### 1.1 O que existe hoje

Toda listagem do sistema segue o mesmo padrão: o componente Angular chama `service.getAll()` uma
única vez, recebe **a tabela inteira** (`WebApiResponse<T[]>`) e entrega o array completo pro
`<app-grid>` via `[rowData]`. O `<app-grid>` (`shared/grid/grid.component.ts`) só conhece esse
modo — é sempre `ag-Grid` no Row Model padrão (client-side), sem `datasource`/paginação de
servidor.

No backend, o espelho disso é `FindAll()` em cada serviço — por exemplo
`TripService.FindAll()` (`TripService.cs:270-307`):

```csharp
var trips = await _repository.GetAllAsync(
    true,
    t => t.BusinessPartner,
    t => t.Vehicle,
    t => t.Driver,
    t => t.Transaction,
    p => p.Payments
);
```

Sem `Skip`/`Take` em lugar nenhum — `Repository<T>.GetAllAsync` sempre faz `.ToListAsync()` sobre
a tabela inteira (com os `Include`s pedidos), e o controller (`TripsController.GetAll`) devolve
esse resultado como está. O mesmo padrão se repete, com o mesmo formato de `Include`s pesados, em:

- `QuoteService.FindAll()`
- `OrderService.FindAll()`
- `PaymentService.FindAll()`
- `TransactionService.FindAll()`

Essas são as 5 entidades de maior volume/crescimento contínuo do sistema (toda venda/locação gera
uma linha em cada uma). Hoje isso ainda funciona porque a base de dados é pequena, mas o padrão não
tem limite — a tela e a query crescem juntas com o negócio, sem nunca converter o crescimento em
lentidão visível até um certo ponto, e a partir daí toda operação (abrir a tela, ordenar, buscar)
carrega e serializa a tabela inteira antes de mostrar qualquer coisa.

### 1.2 Por que não é só "adicionar `Skip`/`Take`"

O ag-Grid instalado é só `ag-grid-community` (`package.json` — sem `ag-grid-enterprise`). O Row
Model client-side de hoje não tem como consumir uma API paginada sem trocar de Row Model. A opção
compatível com Community é o **Infinite Row Model** (Server-Side Row Model é recurso Enterprise,
seria custo de licença novo — fora de cogitação aqui). O Infinite Row Model pede um `IDatasource`
com um método `getRows({startRow, endRow, sortModel}, successCallback, failCallback)` — ou seja, a
mudança é författico dos dois lados: o `<app-grid>` precisa aprender um segundo modo de operação, e
o backend precisa de um endpoint que aceite página/tamanho/ordenação e devolva também o total de
registros (pro ag-Grid saber quando parar de pedir mais linhas).

### 1.3 Escopo: só as 5 entidades de maior volume

As outras ~15+ listagens do sistema (produtos, parceiros de negócio, veículos, motoristas,
usuários, feature toggles, etc.) **não entram nesta spec** — são tabelas de crescimento lento
(cadastro, não transação), o achado da varredura foi específico às 5 entidades transacionais
acima, e migrar tudo de uma vez multiplicaria o esforço sem necessidade agora. O `<app-grid>` ganha
o novo modo como **opt-in**: quem não passar as novas properties continua exatamente como está
hoje, client-side, sem nenhuma mudança de comportamento.

## 2. Desenho

### 2.1 Contratos novos (`TSI.Nexus.Contracts`)

`Models/DTOs/PagedRequest.cs`:

```csharp
public class PagedRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
    public string? SortField { get; set; }
    public bool SortDescending { get; set; }
    public string? QuickFilter { get; set; }
}
```

`Models/DTOs/PagedResult.cs`:

```csharp
public class PagedResult<T>
{
    public IEnumerable<T> Items { get; set; } = [];
    public int TotalCount { get; set; }
}
```

### 2.2 `IRepository<T>` — um método novo, não uma reescrita

Em vez de generalizar ordenação por nome de coluna dentro do repositório genérico (exigiria Dynamic
LINQ ou reflection — uma dependência nova e um jeito de escapar do controle de tipos que este
projeto não usa em nenhum outro lugar), o repositório só ganha a paginação mecânica; que coluna
ordenar continua sendo decisão do serviço, que já conhece o shape da entidade:

```csharp
Task<(IList<T> Items, int TotalCount)> GetPagedAsync(
    int skip,
    int take,
    Expression<Func<T, bool>>? filter,
    Func<IQueryable<T>, IOrderedQueryable<T>>? orderBy,
    bool asNoTracking,
    params Expression<Func<T, object>>[] includes
);
```

Implementação em `Repository<T>` — aplica `Where` (se houver filtro), `Include`s, conta o total
**antes** do `Skip`/`Take` (`CountAsync` na mesma query filtrada, sem os `Include`s — evita juntar
as tabelas relacionadas só pra contar linhas), depois `OrderBy` (usa a mesma regra padrão por
`CreateDate` já usada em todo repositório, se o serviço não passar uma), `Skip(skip).Take(take)`,
`ToListAsync()`.

### 2.3 Serviço — um método novo por entidade, ao lado do `FindAll()` existente

`FindAll()`/`GetAll` **não são removidos** — outras telas (comboboxes de seleção, relatórios,
exportações) continuam chamando a versão "tudo de uma vez" e não precisam de paginação. Cada um
dos 5 serviços ganha:

```csharp
Task<WebApiResponse<PagedResult<TripDto>>> FindAllPaged(PagedRequest request);
```

Dentro, um mapeamento pequeno e explícito de `SortField` pra expressão de ordenação — mesmo
espírito de um "dicionário de opções conhecidas", não um `switch` gigante:

```csharp
private static readonly Dictionary<string, Func<IQueryable<Trip>, IOrderedQueryable<Trip>>> SortMap = new()
{
    ["tripNumber"] = q => q.OrderBy(t => t.TripNumber),
    ["date"] = q => q.OrderBy(t => t.Date),
    // ...campos que a coluna do grid já expõe hoje
};
```

`QuickFilter`, quando presente, vira um `Where` sobre os 2-3 campos que a busca rápida do grid já
cobre hoje pra aquela entidade (ex.: `TripNumber`, `Route`, nome do parceiro de negócio via
`t.BusinessPartner.Name.Contains(...)`) — documentado por entidade na implementação, não um "buscar
em todas as colunas" genérico (o quick filter do ag-Grid client-side não tem equivalente 1:1
translatable pra SQL sem side de dynamic LINQ; esse é o trade-off assumido aqui).

### 2.4 Controller — endpoint novo, ao lado do `GetAll` existente

```csharp
[HttpGet]
[Route("GetAllPaged")]
public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
{
    var webApiResponse = await _tripService.FindAllPaged(request);
    return Ok(webApiResponse);
}
```

### 2.5 Frontend — `<app-grid>` ganha um segundo modo, opt-in

Novos `@Input()`s em `GridComponent<T>`:

```ts
@Input() serverSide = false;
@Input() dataSource?: (request: PagedRequest) => Observable<PagedResult<T>>;
```

Quando `serverSide` é `true`: `gridOptions.rowModelType = 'infinite'` e um `IDatasource` interno
implementa `getRows(params)` — converte `params.startRow`/`endRow` em `page`/`pageSize`,
`params.sortModel[0]` (se houver) em `sortField`/`sortDescending`, chama `dataSource(request)`,
resolve com `params.successCallback(result.items, result.totalCount)`. Quando `serverSide` é
`false` (padrão, sem tocar nenhuma tela existente), o componente funciona exatamente como hoje —
`rowData` client-side, nenhuma mudança de comportamento pras ~15+ outras listagens.

`PagedRequest`/`PagedResult<T>` viram modelos TS espelhados em `core/models/`, igual ao padrão já
usado pra outros contratos compartilhados.

Cada um dos 5 serviços de domínio (`trip.service.ts`, `quote.service.ts`, `order.service.ts`,
`payment.service.ts`, `transaction.service.ts`) ganha:

```ts
getAllPaged(request: PagedRequest): Observable<PagedResult<Trip>> {
  return this.apiService
    .get<WebApiResponse<PagedResult<Trip>>>(`${this._baseEndPoint}/getAllPaged`, { params: toHttpParams(request) })
    .pipe(map((response) => response.data!));
}
```

E os 5 componentes de listagem trocam `[rowData]="trips"` por `[serverSide]="true"
[dataSource]="pagedDataSource"` (um método/arrow do componente que chama `tripService.getAllPaged`).

### 2.6 Ordem de migração

1. **Trip** primeiro, de ponta a ponta (repositório → serviço → controller → grid → lista) —
   valida o padrão inteiro com uma entidade só antes de replicar.
2. Confirmado o padrão, repetir a mesma forma (mesmos nomes de método, mesmo shape de contrato)
   pra **Quote, Order, Payment, Transaction**, nessa ordem.

### 2.7 Fora do escopo, deliberadamente

- Nenhuma das outras ~15+ listagens muda — continuam client-side, como estão.
- Filtros de coluna do ag-Grid (hoje só client-side) não ganham equivalente server-side nesta
  spec — só a busca rápida (quick filter), e limitada aos campos já documentados por entidade.
- `FindAll()`/`GetAll` de nenhuma das 5 entidades é removido ou alterado — continuam servindo quem
  já os consome hoje (dropdowns, relatórios, exportações de PDF).
- Nenhuma mudança de schema de banco.

## 3. Arquivos a criar/alterar

**Backend** (por entidade, repetido 5x na ordem da seção 2.6):
- `TSI.Nexus.Contracts/.../DTOs/PagedRequest.cs`, `PagedResult.cs` (novos, únicos — compartilhados)
- `TSI.Nexus.Contracts/.../Interfaces/IRepository.cs` — método `GetPagedAsync` novo
- `TSI.Nexus.Repository/.../Repository.cs` — implementação de `GetPagedAsync`
- `TSI.Nexus.Contracts/.../Interfaces/I{Entity}Service.cs` — método `FindAllPaged` novo
- `TSI.Nexus.Services/.../{Entity}Service.cs` — implementação + `SortMap` da entidade
- `TSI.Nexus.WebAPI/.../Controllers/{Entity}sController.cs` — endpoint `GetAllPaged`
- Testes unitários novos nos 3 projetos de teste correspondentes (`Repository.Tests`,
  `Services.Tests`, `WebAPI.Tests`)

**Frontend**:
- `TSI.Nexus.UIApp/src/app/core/models/paged-request.ts`, `paged-result.ts` (novos)
- `TSI.Nexus.UIApp/src/app/shared/grid/grid.component.ts` — modo `serverSide` + `IDatasource`
- `.../core/services/{trip,quote,order,payment,transaction}/*.service.ts` — `getAllPaged()`
- `.../{trips,quotes,orders,payments,transactions}.component.ts` — troca de `rowData` por
  `serverSide`/`dataSource`

## 4. Verificação

1. `dotnet build`/`dotnet test` limpos após cada entidade migrada (não só no final).
2. `ng build` (produção) limpo.
3. Ao vivo (ambiente local): abrir a tela de Viagens, confirmar no Network que a request inicial
   já vai com `page`/`pageSize` (não a tabela inteira), rolar o grid pra baixo e confirmar que
   dispara uma nova request pedindo a página seguinte, ordenar por uma coluna e confirmar que a
   request troca `sortField`/`sortDescending` em vez de reordenar em memória.
4. Confirmar que uma tela que **não** foi migrada (ex.: Produtos) continua idêntica — mesma
   requisição `GetAll` de sempre, sem paginação, sem regressão.
5. Confirmar que um consumidor de `FindAll()`/`GetAll` que não é a tela de listagem (ex.: o
   combobox de viagem em algum formulário, se existir; ou a exportação de relatório) continua
   funcionando sem alteração.
6. Repetir 3-5 para cada uma das outras 4 entidades ao migrá-las.
