# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O projeto

Sistema de gestão comercial (ERP enxuto), fluxo **orçamento → pedido → transação → pagamento**,
mais cadastro de clientes/fornecedores, catálogo de produtos, controle de inadimplência,
relatórios, frota/viagens e templates de documento (PDF). Multi-tenant por branch: `main` é a base
genérica; `serodioturismo` é o fork customizado para um cliente específico (Serodio, locação de
caçambas + turismo) — branches de cliente divergem de `main` e não devem ser confundidos entre si.

**Stack**: .NET 8 / ASP.NET Core Web API + EF Core (MySQL) + ASP.NET Identity/JWT + AutoMapper no
backend; Angular 21 (standalone components, sem `NgModule`) + RxJS + Bootstrap/PrimeNG/Angular
Material/AdminLTE + ag-Grid + ApexCharts no frontend.

## Comandos

**Backend** (a partir da raiz do repo):
```bash
dotnet build TSI.Nexus.sln                 # build completo (todas as camadas)
dotnet test                                  # todos os testes (xUnit/Moq/FluentAssertions)
dotnet test --filter "FullyQualifiedName~BusinessPartnerServiceTests"   # uma classe de teste
dotnet test --filter "FullyQualifiedName~BusinessPartnerService_Remove_ShouldRemoveBusinessPartnerSuccessfully_WhenMethodIsCalledWithAValidObject"  # um teste
dotnet test TSI.Nexus.Services/tests/TSI.Nexus.Services.Tests   # só um projeto de teste
```
Projetos de teste (um por camada): `TSI.Nexus.Contracts.Tests`, `TSI.Nexus.Data.Tests`,
`TSI.Nexus.Repository.Tests`, `TSI.Nexus.Services.Tests`, `TSI.Nexus.IoC.Tests`,
`TSI.Nexus.WebAPI.Tests`.

```bash
cd TSI.Nexus.WebAPI/src/TSI.Nexus.WebAPI
dotnet ef database update    # aplica migrations no MySQL configurado
dotnet run
```

**Frontend** (a partir de `TSI.Nexus.UIApp/`):
```bash
npm start                              # ng serve
npm run build                          # build produção + replace-index-href
npm run watch                          # build watch, configuração development
npm test                               # Karma/Jasmine
npx ng test --include='**/trip.service.spec.ts'   # um spec só
```
Sempre `npx ng ...` (nunca uma CLI global) para garantir a versão do projeto. Não há linter
(ESLint) configurado.

Credenciais/segredos **nunca** vão para `appsettings.json`/`appsettings.Development.json` —
sempre via variável de ambiente, `dotnet user-secrets`, ou `appsettings.Local.json` (gitignored,
copiar de `appsettings.Local.json.example`). Ver README.md para a tabela completa de
variáveis/secrets e o processo de deploy manual via FTP/IIS.

## Princípios de código

Todo código novo (backend e frontend) segue **SOLID** e usa **design patterns** onde eles
simplificam em vez de complicar — não como caixa a marcar, mas porque a base já é construída em
cima disso: a separação em camadas (`WebAPI → IoC → Services → Repository → Data → Contracts`) é
SRP/DIP aplicados na prática, o `Repository<T>` genérico é o Repository pattern, a injeção de
interfaces (`I*Service`, `I*Repository`) via `TSI.Nexus.IoC` é o que viabiliza testar cada camada
isolada com mock. Ao adicionar uma classe/serviço/componente novo, preferir manter essa mesma
disciplina (interface + implementação, responsabilidade única, favorecer composição/injeção a
herança ou a `if/switch` gigante) em vez de atalhos que quebrem esse desenho — é isso que mantém o
código limpo e organizado à medida que o sistema cresce.

## Qualidade obrigatória: testes, segurança e performance

Este projeto já passou por uma auditoria completa de segurança e performance (achados altos e
médios corrigidos: JWT, controle de acesso, path traversal, senha em log, N+1 queries, over-
fetching, paginação, etc.). Regredir qualquer um desses pontos com código novo é tão grave quanto
nunca ter corrigido — as regras abaixo existem pra isso não acontecer de novo, silenciosamente.

- **Teste é parte da entrega, não um extra**: nenhuma tarefa — backend ou frontend, feature nova ou
  ajuste em código existente — está concluída sem teste automatizado cobrindo o que mudou. No
  backend isso já era regra (ver "Unit test obrigatório" abaixo); no frontend vale exatamente
  igual: todo componente/serviço/guard/interceptor novo, e toda mudança de comportamento em um já
  existente, ganha (ou atualiza) seu spec correspondente. "Vou testar manualmente e não escrever o
  spec" não é uma opção válida — só reduz cobertura junto com o resto do código que já não tem.
- **Nunca introduzir uma vulnerabilidade nova**: antes de considerar qualquer código pronto,
  checar contra as classes de falha já encontradas nesta base — autenticação/autorização faltando
  ou fraca (`[Authorize]`/roles corretos, nunca confiar em dado vindo do cliente pra decidir
  permissão), path traversal em qualquer código que monte caminho de arquivo a partir de input,
  segredo/senha/token em log ou em resposta de API, injeção (SQL via string concatenada, XSS via
  `innerHTML`/`bypassSecurityTrust*` sem sanitização), CORS/cookie mal configurado. Na dúvida se
  algo é sensível, tratar como se fosse.
- **Nunca introduzir uma regressão de performance nova**: os padrões já estabelecidos existem
  porque já causaram problema real antes — `AsNoTracking()` em leitura, paginação server-side
  (`GetPagedAsync`) em qualquer listagem com volume real (nunca `GetAllAsync`/`QueryAsync` sem
  limite pra uma tela nova), agregação em SQL em vez de trazer tudo pra memória e somar em C#/TS,
  nunca N+1 (uma query por item de uma lista dentro de um loop) onde um `Include`/join resolve.
  Qualquer desvio desses padrões num código novo precisa de uma razão explícita, não só "funcionou
  no teste local com poucos dados".

## Arquitetura do backend

Camadas como projetos .NET separados, dependência em uma direção só:
```
WebAPI → IoC → Services → Repository → Data → Contracts
```
- **Contracts**: modelos, DTOs, enums, interfaces — sem dependências de outras camadas.
- **Data**: `DbContext` (EF Core), interceptors (auditoria, ajuste automático de estoque),
  migrations, seed (`DatabaseSeeder.cs` roda sempre e só insere o que não existe; `DemoDataSeeder`
  é opcional via flag `SeedDemoData`, só roda em banco vazio e fora de `Production`).
- **Repository**: repositório genérico `Repository<T>` sobre o `DbContext`.
- **Services**: regra de negócio, um serviço por domínio.
- **IoC**: DI + AutoMapper (`MappingProfile.cs`).
- **WebAPI**: controllers REST, JWT, Swagger (dev).

### Sistema de feature toggles (módulos)

Tabela `FeatureToggle` (`Key`, `Name`, `Description`, `GroupKey` nullable, `Enabled`). Dois tipos
de chave, ambos em `FeatureToggleKeys.cs` (`TSI.Nexus.Contracts`):
- **Group keys** (`GroupKey = null`): os 5 módulos top-level — `FleetModule`, `FinanceModule`,
  `QuotesModule`, `SalesOrdersModule`, `AttachmentsModule`.
- **Entity keys** (`GroupKey` = a chave do grupo dono): controle fino dentro de um módulo.

**Regra central, documentada no próprio arquivo**: um registro só é exibido quando **tanto** o
toggle de entidade **quanto** o de grupo estiverem ligados (`combineLatest([group, entity])` no
frontend). Ao adicionar uma nova entidade/tela/alerta gateável, o padrão é: nova chave em
`FeatureToggleKeys.cs` (dupla — C# e o espelho TS em `core/models/feature-toggle.model.ts`), seed
em `DatabaseSeeder.cs` com o `GroupKey` correto, checagem `combineLatest` no componente Angular
(ver `RentalReport` em `sidebar.component.ts` ou os alertas de navbar em `navbar.component.ts`
como referência). Preferir um toggle **dedicado e de escopo estreito** por novo elemento de UI em
vez de reaproveitar um toggle de entidade já existente com efeito colateral em outras telas — ver
`docs/spec-1-alertas-por-modulo.md`, seção 2.1, para o raciocínio completo por trás dessa escolha.

Painel admin (`feature-toggles` feature, Master-only) tem duas visões sobre os mesmos dados: "por
grupo" lista só os 5 toggles de grupo; "detalhada" agrupa os toggles de entidade sob o grupo dono
(`groupKey === group.key`), com o switch desabilitado se o grupo estiver desligado.

Desenho completo em `docs/feature-toggle-design.md`.

### Padrões de código obrigatórios no backend

- **XML doc**: toda interface (`Contracts/Interfaces`) documenta seus métodos com `///` seguindo o
  padrão já usado nos arquivos existentes; a implementação em `Services` importa esse texto via
  `/// <inheritdoc />` em vez de duplicar a doc (ver `BusinessPartnerService.cs` como referência).
  Controllers seguem o mesmo padrão de XML doc nos endpoints.
- **Regions**: estruturar a classe nas mesmas regions já usadas nos arquivos existentes do mesmo
  tipo (ex.: `#region Properties`, `#region Public methods` num service) — manter a mesma ordem,
  não inventar uma organização nova por arquivo.
- **Unit test obrigatório**: todo código novo de backend (services, principalmente) precisa de
  teste cobrindo a implementação, no projeto de teste da camada correspondente (`dotnet test` deve
  passar limpo antes de considerar o trabalho concluído).
- **Seed de novo módulo**: sempre que uma entidade/módulo novo for introduzido, alimentar o seed
  inicial (`DatabaseSeeder.cs` para dados estruturais sempre presentes, ou `DemoDataSeeder.cs` para
  dados de exemplo) para que a nova implementação já nasça com dados pra testar/demonstrar.

## Arquitetura do frontend

`TSI.Nexus.UIApp/src/app` — **100% standalone components**, sem `NgModule` (bootstrap via
`app.config.ts` + `bootstrapApplication`, rotas via `app.routes.ts` com `loadChildren` apontando
para `*.routes.ts` por feature, não para módulos). Um `*-shared.module.ts`/`.module.ts` residual
ainda aparece em alguns diretórios (`orders`, `trips`, `business-partner`, `order-products`, etc.)
— são cascas vazias (`declarations: []`) que sobraram da migração, não recriar esse padrão em
código novo; todo componente novo é standalone e declara seus próprios `imports: [...]`.

- **`core/`**: guards (`AuthorizationGuard` — `CanActivateChild`, lê `route.data['roles']` e
  `route.data['featureFlag']`, este último aceitando `string | string[]`, com `.every()` sobre
  `FeatureFlagService.isEnabled()`), interceptors (JWT, erro), serviços de API, modelos/enums
  compartilhados, i18n, pipes/diretivas (`ClickDirective`/`appClick`, `TranslatePipe`,
  `CurrencyFormatDirective`).
- **`shared/`**: componentes reaproveitados entre features (`app-date-field`, `app-currency-field`,
  `app-link-field`, `app-grid` sobre ag-Grid, `app-photo`, etc.) — importados diretamente por quem
  usa, não via barrel module.
- Cada feature de domínio (`orders`, `quotes`, `trips`, `payments`, `business-partner`, `products`,
  `vehicles`, `users`, `reports`, `feature-toggles`, `document-templates`, ...) é lazy-loaded via
  `loadChildren`/`loadComponent` em `app.routes.ts`, cada uma com seu próprio `*.routes.ts`.
- **i18n**: `TranslatePipe` + `TranslationService`, pt-BR/en/es.
- **Tema**: dark/light mode, preferência persistida em `User.theme`.

### Padrões de tela obrigatórios no frontend

- **Unit test obrigatório**: mesmo espírito do backend (ver "Qualidade obrigatória" acima) — todo
  componente/serviço/guard/interceptor novo, e toda mudança de comportamento relevante em um já
  existente, ganha spec correspondente (`npm test` deve passar limpo antes de considerar o
  trabalho concluído).
- **Organização de pastas/nomenclatura**: seguir a mesma estrutura já usada nas outras features —
  `<feature>/components/<entidade>-list`, `<entidade>-form`, `<entidade>-details-modal` (ou
  `-details-page`), etc. (ver `business-partner/components/` como referência:
  `business-partner-form`, `business-partner-details-modal`, `business-partner-details-page`).
- **Componentes por entidade/módulo**: o component base na raiz da feature é a **lista**; dentro
  de `components/`, um component pro **form**, um pro **modal** e um pros **detalhes**.
- **Botões padrão**: Adicionar sempre abre modal (form dentro de modal); Editar sempre abre modal
  (mesmo form, modo edição); Visualizar sempre vai pros detalhes (modal ou página de detalhes,
  nunca abre o form).
- **Campos genéricos obrigatórios**: usar sempre os componentes compartilhados pra data
  (`app-date-field`), link (`app-link-field`), moeda (`app-currency-field`) — nunca reimplementar
  esse tipo de campo local a uma feature.
- **Grids de relacionamento 1-N**: qualquer aba de uma entidade que mostre dados de uma relação
  1-N usa `app-grid`, com os mesmos botões e funcionalidades (add/edit/view, etc.) já usados nas
  outras entidades — não criar uma tabela/lista customizada pra isso.
- **Inputs de formulário**: `form-floating` dentro de um `input-group`, com o ícone no
  `input-group-text` à direita do campo (ver `business-partner-form.component.html`).
- **Validação visual**: campos obrigatórios usam `[class.is-invalid]="isInvalid('campo')"` /
  `[class.is-valid]="isValid('campo')"` (herdados de `core/base/form-base.component.ts`) —
  vermelho quando inválido, verde quando válido, igual ao resto dos formulários.
- Dentro de uma entidade, respeitar o mesmo template/estrutura de tela já usado em todas as
  outras (mesma ordem de seções, mesmos padrões de header/ações) — não introduzir um layout novo
  pra uma entidade sem justificativa.

**Antes de considerar uma tela nova/alterada concluída, checar essa lista de padrões explicitamente
— inclusive (e principalmente) quando o ponto de partida é um componente já existente**, seja de
uma sessão anterior, seja escrito às pressas mais cedo na mesma sessão. Código já existente não é
prova de que segue o padrão: já aconteceu de um modal com `<form>` inline (em vez de componente de
form separado) e uma lista com `<table>` custom (em vez de `app-grid`) servirem de base pra um
ajuste incremental, e o ajuste herdou as duas violações sem ninguém perceber até o usuário notar
visualmente. Tratar "bate com o arquivo que já estava lá" como suficiente é o erro — o critério é
"bate com os bullets acima", e vale auditar o arquivo-base contra eles antes de estender.

### Convenções recorrentes desta sessão

- Filtro de intervalo de datas em relatórios: área de filtro escondida por padrão, animação
  `cardCollapseAnimation` ao abrir/fechar (ver `order-products` "Relatório Locações" e
  `fleet-report`).
- Estado de loading em botões de submit (ex.: login): a desabilitação funcional já costuma vir de
  `ClickDirective`/`appClick` — ao reportar um botão "não parece desabilitado", checar primeiro se
  falta só o estilo `:disabled` no CSS, não a lógica.
- Alertas de notificação da navbar (`navbar/components/*-notification`) cada um busca seus próprios
  dados sem serviço compartilhado; a visibilidade de cada sino é centralizada em
  `NavbarComponent` (não duplicada dentro de cada componente de notificação), seguindo a mesma
  regra grupo+entidade dos feature toggles.

## Fluxo de trabalho de specs

Mudanças maiores/específicas de cliente passam por um doc em `docs/spec-N-*.md` ou
`docs/*-design.md` **antes** do código: contexto, desenho, arquivos a alterar, verificação. Specs
existentes documentam decisões já tomadas (`feature-toggle-design.md`,
`standalone-migration-design.md`, `document-templates-design.md`, `ajustes-pos-deploy-serodio.md`)
— consultar antes de redesenhar algo que já foi decidido, e checar se a doc já tem uma seção
"Implementado" antes de assumir que é só um plano. **Não implementar uma spec nova sem o "ok"
explícito do usuário sobre o desenho escrito** — só codar depois da validação, mesmo que a
próxima mensagem pareça confirmar o design.
