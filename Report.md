# Authentication Security Review

## Scope
Review focused on `server.js` and the authentication-related paths it exposes or invokes, especially `mmp/pmr.js`, `middlewares/responseMiddleware.js`, `middlewares/jsonDecryptDezipMiddleware.js`, `encryption/aesUtils.js`, `xmpp/xmppConnection.js`, and `.env`.

## Executive Summary
The application does not implement a first-party user authentication layer for its own API. In `server.js`, application routes are mounted directly with no authentication or authorization middleware, so backend CRUD, GraphQL, XMPP, PMR, and TAK-facing routes are broadly reachable once the service is exposed. The only clear token-based authentication flow in the codebase is an outbound OAuth 2.0 client-credentials exchange in `mmp/pmr.js` used to call an external PMR service.

## Current Authentication Model
### Inbound application authentication
- No API login endpoint was found for this app.
- No request authentication middleware was found in `server.js` before route registration (`server.js:172-254`, `server.js:346-350`).
- No JWT verification, session middleware, cookie parsing, Passport, or bearer-token validation was found anywhere in the backend.

### Outbound authenticated integration
- Local entry point: `POST /api/pmr/:id` mounted from `api.use('/api', pmrRoutes)` in `server.js:243`.
- External token endpoint: `https://mm.medis.org.uk/identity/connect/token` in `mmp/pmr.js:153-164`.
- External protected API endpoint: `https://mm.medis.org.uk/api/api/pmrs/create-app11e` in `mmp/pmr.js:293-301`.

## Authentication Suggestions
1. Add inbound authentication at the API boundary in `server.js`.
Use either JWT bearer authentication for SPA/API traffic or server-managed secure cookies if the frontend and backend are same-site.

2. Add authorization, not just authentication.
Sensitive routes such as `/ips`, `/ips/all`, `/graphql`, `/xmpp`, `/tak`, and `/api/pmr/:id` should require role or scope checks.

3. Prefer OpenID Connect or OAuth 2.1 with an external identity provider.
For a web app, authorization code flow with PKCE is a better fit than inventing custom login/session behavior.

4. Keep machine-to-machine credentials out of source.
Move `client_id`, `client_secret`, AES keys, and XMPP credentials into managed secrets storage with rotation.

5. Use short-lived access tokens and explicit server-side session policy.
If browser users need sessions, use secure, `HttpOnly`, `SameSite` cookies or short-lived JWT access tokens with refresh-token rotation.

6. Separate transport/security concerns from custom payload encryption.
Rely on HTTPS/TLS for transport confidentiality and use standard auth/session controls; the custom AES wrapper should not substitute for access control.

## Secrets And Key Material
### Hardcoded in source
- PMR OAuth client credentials are hardcoded in `mmp/pmr.js:155-159`.
`client_id: 'IPS1'` and `client_secret: '009efe3d-7553-4ee6-acb4-f548790d63e9'` are used to obtain an access token for the external PMR API.

- AES key material is hardcoded in `encryption/aesUtils.js:6-7` and also in `encryption/aesUtils_old.js:5-6`.
The key is used for request/response encryption and decryption in the custom middleware flow.

- The response layer can deliberately return the AES key to the client when `Accept-Extra: includeKey` is present (`middlewares/responseMiddleware.js:88-90`).
This defeats the purpose of symmetric secret protection because the encrypted payload and the decryption key are sent together.

- XMPP fallback credentials are hardcoded in `xmpp/xmppConnection.js:95-100`.
Defaults include service URL, username, password, and room name, which means the app can still boot with known static credentials if environment variables are absent.

### Stored in `.env`
- `.env:1` stores `DB_CONN`, used by `server.js:163-166` to connect to MongoDB.
- `.env:3-7` stores XMPP service, domain, username, password, and room.
- `.env:8` stores `TAK_HOST`.

These values are operational secrets or infrastructure connection details. They should be treated as sensitive and kept out of source control, with deployment-time injection from a secrets manager.

## Step-By-Step Authentication Operation
### Actual token flow present in the code
1. A client calls `POST /api/pmr/:id` on this app (`server.js:243`, `mmp/pmr.js:80`).
2. The handler resolves the IPS record by `id` from backend storage (`mmp/pmr.js:97-103`).
3. The handler performs an OAuth 2.0 client-credentials request to `https://mm.medis.org.uk/identity/connect/token` (`mmp/pmr.js:153-164`).
4. The request body is URL-encoded and contains:

```text
grant_type=client_credentials
client_id=IPS1
client_secret=<shared secret>
scope=medmmapi
```

5. The external identity service returns an `access_token`, which the backend stores only in local process memory as `const accessToken = tokenResponse.data.access_token` (`mmp/pmr.js:165`).
6. The backend then sends the PMR XML to `https://mm.medis.org.uk/api/api/pmrs/create-app11e` with `Authorization: Bearer <access_token>` (`mmp/pmr.js:293-301`).
7. The PMR response is returned to the caller. No session is created for the app user, and no token is persisted for reuse.

### What is missing for session management
- No application session is established for users of this web app.
- No cookie-based session store exists.
- No app-issued JWT exists.
- No refresh-token handling exists.
- No route-level token verification exists.

In practice, the app currently uses a transient machine token only for one outbound integration call; it does not use tokens to manage end-user sessions.

## Security Risks Observed
### High risk
- No authentication or authorization is enforced for core backend routes in `server.js`.
This appears to expose data access and mutation endpoints without identity checks.

- Hardcoded PMR client secret in source (`mmp/pmr.js:157-159`).
Anyone with repository or deployment artifact access can reuse the credential.

- Hardcoded symmetric AES key in source (`encryption/aesUtils.js:7`).
Compromise of the codebase compromises all payload protection based on that key.

- Optional `includeKey` behavior returns encryption key material in API responses (`middlewares/responseMiddleware.js:88-90`).
This nullifies confidentiality for that mode.

### Medium risk
- Request logging in `server.js:116-121` prints full request headers.
If authorization headers or sensitive custom headers are introduced later, they may be written to logs.

- Global permissive CORS in `server.js:104` and Socket.IO `origin: '*'` in `server.js:387-389` broaden browser access unnecessarily.

- XMPP credentials are present both in `.env` and as insecure code defaults (`xmpp/xmppConnection.js:95-100`).

- The custom encryption layer may create a false sense of security while access control remains absent.

### Low risk / design concerns
- `DB_CONN` in `.env` does not show authentication parameters, which may indicate an unauthenticated local MongoDB deployment depending on environment (`.env:1`).
- The app starts multiple network surfaces from the same process, including REST, GraphQL, WebSocket, XMPP, and gRPC, increasing attack surface without a visible unified auth policy.

## Recommended Next Actions
1. Add centralized auth middleware in `server.js` and protect all non-public routes by default.
2. Move PMR, AES, XMPP, and database secrets into managed secret storage; rotate any exposed values.
3. Remove `includeKey` response behavior entirely.
4. Replace hardcoded/fallback credentials with required environment variables and fail closed when missing.
5. Introduce a documented end-user auth model, preferably OIDC with authorization code + PKCE for the web app and bearer-token verification in the API.
