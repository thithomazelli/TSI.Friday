# Spec 10 — JWT de `localStorage` para cookie `httpOnly`

> Escrito a partir do item "Token JWT em localStorage" da Auditoria de Segurança & Performance
> (Alto, pendente). Aguardando seu "ok" no desenho antes de codar, como de praxe no fluxo de specs
> deste projeto.

## 1. Problema

Hoje o JWT inteiro vive em `localStorage` (`account.service.ts:setUser`, chave
`environment.userKey` = `nexusAppUser`), dentro do objeto `User` serializado. Qualquer XSS futuro no
app rouba o token com uma linha de JS (`localStorage.getItem('nexusAppUser')`), e como o app renova
o token sozinho em background (`startAutoLogout` → `attemptRenewalOrLogout` → `refreshUser`), uma
sessão roubada pode se renovar indefinidamente sem precisar de nova senha. Nenhum XSS foi encontrado
nesta varredura — o risco é condicional a um XSS futuro, mas o impacto (sequestro total de conta,
indefinidamente) justifica fechar essa porta preventivamente.

Um cookie `httpOnly` resolve isso na raiz: JavaScript não consegue ler o valor do cookie, então um
XSS não tem mais como exfiltrar o token, mesmo que consiga executar código arbitrário na página.

## 2. Estado atual (mapeado nesta sessão)

- **Emissão**: `JwtService.CreateJWT` (`TSI.Nexus.Services/Services/JwtService.cs`) gera a string do
  JWT. `UserManagerService.CreateApplicationUserDto(user, includeJwt)` (linha ~714-726) é o único
  ponto que monta `UserDto.JWT = _jwtService.CreateJWT(user, roles)` — usado por `Login`,
  `RefreshUserToken` e (via `includeJwt: false`) outros fluxos que retornam `UserDto` sem token.
- **Transporte**: `UserDto.JWT` vai no corpo da resposta JSON de `POST /api/account/login` e
  `GET /api/account/refresh-user-token`. O frontend (`account.service.ts:setUser`) guarda o objeto
  inteiro (incluindo o JWT) em `localStorage`.
- **Anexação em requisições**: `jwt.interceptor.ts` lê `user.jwt` do `AccountService.user$` e seta
  manualmente o header `Authorization: Bearer <token>` em toda requisição HTTP saindo do app.
- **Validação no backend**: `Program.cs` configura `AddJwtBearer` padrão, que só lê o header
  `Authorization` — não há suporte a ler token de cookie hoje.
- **Decodificação client-side do próprio token**: `account.service.ts` decodifica o payload do JWT
  (`atob` + `JSON.parse` na parte 2) em três lugares — `isTokenExpired` (checa `exp`),
  `startAutoLogout` (agenda um `setTimeout` até `exp` pra tentar renovar), e `setUser` (extrai
  `role`/`roles` do claim, embora `UserDto.Role` já venha direto no corpo da resposta — essa parte é
  redundante e cai fora com a migração).
- **Consumidores de `getJWT()`**: `app.component.ts` (bootstrap: decide se restaura sessão ou
  redireciona pro login) e `error.interceptor.ts` (fluxo de renovação em resposta a um 401).
- **Logout**: só existe no frontend (`account.service.ts:logout`) — limpa o `localStorage` e navega
  pro login. Não existe endpoint de logout no backend hoje.
- **CORS**: já configurado com `AllowCredentials().WithOrigins(<ClientUrl>)` — uma única origem
  fixa, credentials habilitado. Ou seja, a infraestrutura pra cookie cross-origin (SPA em
  `:4300`/domínio do Angular, API em domínio próprio) já está pronta; falta só o Angular mandar
  `withCredentials: true` nas chamadas (`HttpClient` não manda cookie automaticamente sem isso).
- **HTTPS**: `environment.ts` (prod) e `environment.development.ts` (via cert de dev) apontam pra
  `appUrl` em HTTPS nos dois ambientes — cookie `Secure` pode ser fixo `true` sem quebrar dev local.

## 3. Desenho

### 3.1 Backend — emitir o JWT como cookie, não mais no corpo

Em `CreateApplicationUserDto` (`UserManagerService.cs`), em vez de só devolver o JWT dentro do DTO,
o controller (`AccountController.Login`/`RefreshUserToken`) seta um cookie na resposta:

```csharp
Response.Cookies.Append("nexus_auth", jwt, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,
    Expires = tokenExpiresAtUtc,
});
```

`SameSite=Strict` (não `Lax`/`None`) porque é uma SPA de origem única contra uma API de origem
única, sem necessidade de navegação cross-site autenticada — `Strict` é a postura anti-CSRF mais
forte disponível sem custo funcional aqui, e substitui a necessidade de um esquema de token
anti-CSRF separado (double-submit cookie, etc.) somado ao CORS já restrito a uma origem.

`UserDto.JWT` deixa de ser preenchido (fica `null`/removido do DTO) — o corpo da resposta não leva
mais o token. Em vez dele, `UserDto` ganha `TokenExpiresAtUtc` (um `DateTime`, não sensível): o
frontend precisa saber quando o token expira pra agendar a própria renovação, mas não precisa mais
do valor do token pra isso. `JwtService.CreateJWT` já calcula `expires` internamente — só precisa
expor esse valor também (assinatura muda pra retornar os dois, ou um método `GetExpiry` par).

### 3.2 Backend — ler o token do cookie na validação

`AddJwtBearer` em `Program.cs` ganha um `OnMessageReceived` que lê o cookie quando o header
`Authorization` não vier setado:

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        if (string.IsNullOrEmpty(context.Token) &&
            context.Request.Cookies.TryGetValue("nexus_auth", out var cookieToken))
        {
            context.Token = cookieToken;
        }
        return Task.CompletedTask;
    },
};
```

Isso mantém compatibilidade com qualquer chamada via header `Authorization` (Swagger, testes manuais
com Postman/curl) sem exigir cookie, e passa a aceitar o cookie como via principal pro app real.

### 3.3 Backend — endpoint de logout

Hoje não existe backend pra logout porque não havia nada pro servidor "esquecer" (o token vivia só
no cliente). Com `httpOnly`, o JS não consegue apagar o cookie sozinho — precisa de um endpoint que
devolva o cookie expirado:

```csharp
[HttpPost("logout")]
public IActionResult Logout()
{
    Response.Cookies.Delete("nexus_auth");
    return Ok();
}
```

### 3.4 Frontend — parar de manusear o token diretamente

- `api.service.ts`: toda chamada (`get`/`getBlob`/`post`/`put`/`delete`) ganha
  `withCredentials: true` nas opções do `HttpClient`, pra o browser anexar o cookie automaticamente.
- `jwt.interceptor.ts`: **removido**. Não há mais header pra montar manualmente — o cookie viaja
  sozinho em toda requisição pra mesma origem da API. Remover o registro do interceptor onde ele é
  provido hoje (`app.config.ts` ou equivalente).
- `User` (model): campo `jwt: string` sai, entra `tokenExpiresAtUtc: string | Date`.
- `account.service.ts`:
  - `isTokenExpired(token)` vira `isTokenExpired(expiresAtUtc: Date | string | null)` — mesma
    comparação contra `Date.now()` + `clockSkewToleranceMs`, sem decodificar nada.
  - `startAutoLogout(token)` vira `startAutoLogout(expiresAtUtc)` — mesmo cálculo de `timeout`, sem
    decodificar nada.
  - `setUser`: cai o bloco inteiro de decodificação do JWT pra extrair `role`/`roles` (já vem pronto
    em `user.role` no DTO — simplificação de bônus, não o objetivo principal). Chama
    `startAutoLogout(user.tokenExpiresAtUtc)` em vez de passar o token.
  - `getJWT()` **removido** — não existe mais um token acessível em JS pra devolver.
  - `refreshUser()` perde o parâmetro `jwt` (não precisa mais montar `Authorization` manualmente —
    o cookie vai sozinho); vira só um POST/GET sem corpo especial, com `withCredentials`.
  - `logout()`: chama `POST /api/account/logout` (novo endpoint) além de limpar o `localStorage` e
    navegar — mesmo se a chamada falhar (rede fora), o estado local já foi limpo, então segue com a
    navegação de qualquer forma (mesma tolerância a falha que já existe hoje no método).
- `app.component.ts` e `error.interceptor.ts`: trocam as chamadas a `getJWT()` +
  `isTokenExpired(jwt)` + `refreshUser(jwt)` pela leitura de `tokenExpiresAtUtc` do usuário atual
  (via `user$`) + `refreshUser()` sem argumento.

### 3.5 Fora do escopo, deliberadamente

- Nenhuma mudança na duração do token (`JWT:ExpiresInMinutes`, hoje 15 min) — a spec só muda onde o
  token mora, não por quanto tempo ele vale.
- Revogação/blacklist de token continua fora do escopo (item separado da auditoria, decidido nesta
  sessão como "não implementar agora" — mitigado pela expiração curta).
- Nenhuma proteção anti-CSRF adicional além de `SameSite=Strict` + CORS de origem única — ver
  justificativa em 3.1. Se no futuro a API precisar aceitar chamadas de outra origem (app mobile,
  integração externa), essa decisão precisa ser revisitada.

## 4. Arquivos a alterar

**Backend:**
- `TSI.Nexus.Services/src/TSI.Nexus.Services/Services/JwtService.cs` — expor a expiração calculada
- `TSI.Nexus.Services/src/TSI.Nexus.Services/Services/UserManagerService.cs` —
  `CreateApplicationUserDto`, parar de preencher `JWT` no DTO, preencher `TokenExpiresAtUtc`
- `TSI.Nexus.Contracts/src/TSI.Nexus.Contracts/Models/DTOs/UserDto.cs` — trocar `JWT` por
  `TokenExpiresAtUtc`
- `TSI.Nexus.WebAPI/src/TSI.Nexus.WebAPI/Controllers/AccountController.cs` — `Login`/
  `RefreshUserToken` setam o cookie; novo endpoint `Logout`
- `TSI.Nexus.WebAPI/src/TSI.Nexus.WebAPI/Program.cs` — `OnMessageReceived` lendo o cookie

**Frontend:**
- `core/services/api/api.service.ts` — `withCredentials: true`
- `core/interceptors/jwt.interceptor.ts` — removido; tirar do provider em `app.config.ts`
- `core/services/account/account.service.ts` — conforme 3.4
- `core/interceptors/error.interceptor.ts` — trocar uso de `getJWT()`/token por `tokenExpiresAtUtc`
- `app.component.ts` — idem
- `core/models/account/user.ts` — `jwt` → `tokenExpiresAtUtc`

**Testes:** `jwt.interceptor.spec.ts` é removido junto com o interceptor; testes de
`JwtServiceTests.cs`/`UserManagerServiceTests.cs` que hoje verificam o `JWT` no DTO passam a
verificar `TokenExpiresAtUtc` e a ausência de `JWT`.

## 5. Verificação

1. `dotnet test` limpo (services afetados: Jwt, UserManager) + `dotnet build` do WebAPI.
2. Login manual: DevTools → Application → Cookies mostra `nexus_auth` com `HttpOnly` marcado;
   Local Storage não contém mais o token (só `tokenExpiresAtUtc` e o resto do perfil).
3. Navegar por 2-3 telas autenticadas (dashboard, uma lista, um formulário) confirmando que as
   chamadas API continuam autenticadas sem qualquer header `Authorization` manual (cookie
   carregando sozinho).
4. Fechar e reabrir a aba (sessão persiste via cookie até a expiração) e testar logout (cookie some
   do DevTools após `POST /api/account/logout`, próxima chamada API retorna 401).
5. Deixar o token expirar (ou reduzir `JWT:ExpiresInMinutes` temporariamente pra 1 min em dev) e
   confirmar que a renovação automática em background continua funcionando sem o token exposto em
   JS em nenhum momento.
6. Confirmar que uma chamada `curl -H "Authorization: Bearer <token>"` direta (sem cookie) ainda
   autentica — garante que o `OnMessageReceived` não quebrou o caminho por header pra
   Swagger/ferramentas manuais.
