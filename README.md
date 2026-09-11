# TSI.Nexus

Sistema de gestão comercial (ERP enxuto) desenvolvido para uma empresa de locação/venda de produtos (caçambas e serviços de descarte/reciclagem). Cobre o fluxo completo de **orçamento → pedido → transação → pagamento**, além de cadastro de clientes/fornecedores, catálogo de produtos, controle de inadimplência e relatórios.

## Stack

**Backend** — .NET 8 / ASP.NET Core Web API, Entity Framework Core (MySQL), ASP.NET Identity + JWT, AutoMapper.

**Frontend** — Angular 21, RxJS para estado, Bootstrap + PrimeNG + Angular Material + AdminLTE, ag-Grid, ApexCharts.

## Arquitetura

O backend é organizado em camadas, cada uma como um projeto .NET separado:

```
WebAPI  → IoC → Services → Repository → Data → Contracts
```

- **Contracts** — modelos, DTOs, enums e interfaces (camada pura, sem dependências).
- **Data** — `DbContext` (EF Core), interceptors (auditoria, ajuste automático de estoque), migrations e seed de dados.
- **Repository** — repositório genérico (`Repository<T>`) sobre o `DbContext`.
- **Services** — regras de negócio, um serviço por domínio (produtos, pedidos, orçamentos, pagamentos, usuários, etc.).
- **IoC** — configuração de injeção de dependência e AutoMapper.
- **WebAPI** — 18 controllers REST, autenticação JWT, Swagger (dev).

O frontend (`TSI.Nexus.UIApp`) é um app Angular modular, com um módulo lazy-loaded por feature (contas, parceiros de negócio, pedidos, orçamentos, pagamentos, produtos, transações, usuários, relatórios) e uma camada `core/` com guards, interceptors, serviços de API e modelos compartilhados.

## Funcionalidades principais

- Cadastro de parceiros de negócio (pessoa física ou jurídica), com endereços e anexos
- Catálogo de produtos (venda/locação) com fotos
- Orçamentos (quotes) convertíveis em pedidos
- Pedidos, transações e pagamentos, com cálculo de descontos/totais
- Job automático de identificação de itens/pagamentos em atraso
- Dashboard com indicadores e relatórios
- Autenticação com JWT, papéis de usuário (Admin/User), confirmação de e-mail e reset de senha por e-mail (Mailjet)

## Rodando o projeto

**Backend:**
```bash
cd TSI.Nexus.WebAPI/src/TSI.Nexus.WebAPI
dotnet restore
dotnet ef database update   # aplica as migrations no MySQL configurado
dotnet run
```

**Frontend:**
```bash
cd TSI.Nexus.UIApp
npm install
npm start
```

> `appsettings.json` / `appsettings.Development.json` não contêm mais credenciais reais — os valores devem ser fornecidos via variáveis de ambiente (o ASP.NET Core sobrescreve a configuração automaticamente), via `dotnet user-secrets` ou via um arquivo `appsettings.Local.json` local (já no `.gitignore`, nunca é commitado — copie `appsettings.Local.json.example` para `appsettings.Local.json` e preencha os valores reais):
>
> | Variável / chave | Corresponde a |
> |---|---|
> | `ConnectionStrings__DefaultConnection` | Connection string do MySQL (produção, ou a instância na nuvem usada localmente) |
> | `ConnectionStrings__HomologConnection` | Connection string do MySQL de homologação |
> | `JWT__Key` | Chave de assinatura dos tokens JWT |
> | `MailJet__ApiKey` | API Key do Mailjet |
> | `MailJet__SecretKey` | Secret Key do Mailjet |
> | `Seed__AdminPassword` | Senha inicial da conta `admin` (Master) — opcional; em Production, se não for definida, o `DatabaseSeeder` gera uma senha aleatória e a registra uma única vez no log de inicialização |
> | `Seed__ThiagoPassword` / `Seed__LeonardoPassword` | Senha inicial das contas Admin nomeadas — mesma regra acima |
>
> Nota: o `Program.cs` só lê `ConnectionStrings:DefaultConnection` — `HomologConnection`/`LocalConnection` existem no `appsettings.json` só como referência, não são usados no código.

### Dados de demonstração

Para popular um banco **vazio** com dados fake (business partners, produtos, orçamentos, pedidos,
frota, etc.) e apresentar a aplicação sem cadastrar tudo na mão, defina `"SeedDemoData": true` no
`appsettings.Local.json` e suba o backend. O seed só roda se: (1) a tabela `BusinessPartner`
estiver vazia, e (2) o ambiente não for `Production` — em qualquer outro caso ele não faz nada,
mesmo com a flag ligada. Veja `TSI.Nexus.Data/src/TSI.Nexus.Data/Seed/DemoDataSeeder.cs`.

### CI/CD

Todo push em `main` dispara `.github/workflows/deploy.yml`, que builda e publica via FTP:
- **Frontend**: `npm run build` → publica `TSI.Nexus.UIApp/dist/tsi.nexus.uiapp/browser/` em `/www/app/`.
- **Backend**: `dotnet publish` (self-contained, win-x64) → publica em `/www/api/`. O `web.config` de produção é gerado a cada deploy a partir de `web.config.Production.example.xml`, com os segredos injetados via `envsubst` a partir dos GitHub Actions Secrets — nenhum valor real fica no repositório.
- Os anexos enviados por usuários (`attachments/`) e os logs do processo (`stdout*`) ficam excluídos do deploy do backend, pra não serem apagados a cada publicação.

Secrets necessários (`Settings → Secrets and variables → Actions` no GitHub):

| Secret | Valor |
|---|---|
| `FTP_SERVER` | Host do FTP |
| `FTP_USERNAME` | Usuário do FTP |
| `FTP_PASSWORD` | Senha do FTP |
| `CONNECTIONSTRINGS_DEFAULT` | Connection string completa do MySQL de produção |
| `CONNECTIONSTRINGS_HOMOLOG` | Connection string completa do MySQL de homologação |
| `JWT_KEY` | Chave de assinatura dos tokens JWT |
| `MAILJET_API_KEY` | API Key do Mailjet |
| `MAILJET_SECRET_KEY` | Secret Key do Mailjet |

### Deploy manual (fallback, caso precise publicar sem o CI/CD)

Como o backend é publicado via IIS (`hostingModel="OutOfProcess"`, veja `TSI.Nexus.WebAPI/src/TSI.Nexus.WebAPI/web.config`), as variáveis de ambiente do servidor são configuradas dentro do próprio `web.config`, no bloco `<environmentVariables>` — não é necessário acesso a shell/RDP, só FTP:

1. Copie `TSI.Nexus.WebAPI/src/TSI.Nexus.WebAPI/web.config.Production.example.xml` para `web.config.Production.xml` (esse nome já está no `.gitignore` — nunca será commitado).
2. Preencha os valores reais das variáveis (connection strings, `JWT__Key`, `MailJet__ApiKey`/`SecretKey`).
3. Envie esse conteúdo por FTP como o `web.config` do servidor — **não** suba o `web.config` gerado pelo build, que não tem nenhum segredo. Qualquer alteração no `web.config` já faz o IIS reciclar o processo sozinho, sem precisar reiniciar nada manualmente.
4. Guarde o `web.config.Production.xml` (com os valores reais) só localmente, fora do Git.

## Testes

```bash
dotnet test          # backend (xUnit/Moq/FluentAssertions)
cd TSI.Nexus.UIApp && npm test   # frontend (Karma/Jasmine)
```

## Status e débito técnico conhecido

Projeto ativo, migrado do Bitbucket para o GitHub preservando todo o histórico de commits. Pontos conhecidos a endereçar:

- **Segurança**: credenciais antigas (banco, JWT, Mailjet) foram removidas dos arquivos e do histórico de commits — mas por terem sido expostas em algum momento, precisam ser **rotacionadas** (senha do MySQL, chave JWT, chaves do Mailjet) caso ainda não tenha sido feito.
- **Cobertura de testes**: sólida no backend para os módulos mais antigos, mas ausente no módulo de Orçamentos (o mais recente) e nos serviços de autenticação/anexos. No frontend, os specs existentes são boilerplate do Angular CLI, sem cobertura real.
- **Serviço em segundo plano duplicado**: há implementações duplicadas de `OverdueStatusBackgroundService` registradas simultaneamente, rodando a verificação de atraso em agendas diferentes e sobrepostas.
- **Stack de UI**: Bootstrap, PrimeNG, Angular Material e AdminLTE convivem no mesmo frontend — candidato a consolidação.
- **CI/CD**: build e deploy automatizados via GitHub Actions (`.github/workflows/deploy.yml`); ainda falta rodar os testes automatizados como gate antes do deploy.
