# admin implementation plan
## dynamic content via cloudflare workers + kv

_research compiled 2026-03-10_

---

## context

hourihan.xyz is a static site on Cloudflare Pages. the goal is to add a write path for ideas, devlogs, and blogs from any device — without touching GitHub or triggering a deploy. content is treated as **data**, not code. the repo holds the application; KV holds the posts.

---

## sources consulted

- [Building a To-Do List with Workers and KV](https://blog.cloudflare.com/building-a-to-do-list-with-workers-and-kv/) — cloudflare blog (canonical reference)
- [How to Use Cloudflare Workers KV for Edge Storage](https://oneuptime.com/blog/post/2026-01-27-cloudflare-workers-kv/view) — oneuptime.com, jan 2026
- [Cloudflare Workers KV Introduction](https://dev.to/fllstck/cloudflare-workers-kv-introduction-1oo) — dev.to
- [Protecting Your Internal Apps with Cloudflare Access](https://blog.saintmalik.me/cloudflare-access-workers-for-internal-apps/)
- [HTTP Basic Authentication · Cloudflare Workers docs](https://developers.cloudflare.com/workers/examples/basic-auth/)
- [Environments · Cloudflare Workers docs](https://developers.cloudflare.com/workers/wrangler/environments/)
- [KV Environments · Cloudflare Workers KV docs](https://developers.cloudflare.com/kv/reference/environments/)
- [Choosing a data or storage product · Cloudflare Workers docs](https://developers.cloudflare.com/workers/platform/storage-options/)
- [Workers + Static Assets (full-stack)](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/)

---

## key findings

### KV is the right storage choice

KV is read-heavy and eventually consistent — perfect for a personal blog where you write rarely and read constantly. the eventual consistency delay (~60 seconds for global propagation) is irrelevant for a single-author site.

**free tier limits:** 100K reads/day, 1K writes/day, 1GB storage. will never be hit on a personal site.

**hard limits to know:**
- key size: 512 bytes max
- value size: 25 MB max
- 1 write per second per unique key (not a concern here)
- metadata field: up to 1024 bytes (useful for post index — store title, date, type without fetching full body)

**migration path:** when ready to move to D1 or a self-hosted database, the Worker is the only thing that changes. the static site and admin page are untouched.

### KV namespace isolation per environment

KV bindings are **non-inheritable** in wrangler.toml. they must be defined separately for each environment. use the same `binding` name in code; only the namespace `id` differs.

```toml
name = "hourihan-cms"

# default (dev) — safe to experiment
[[kv_namespaces]]
binding = "CONTENT"
id = "DEV_NAMESPACE_ID"

[env.production]
route = "hourihan.xyz/api/*"

[[env.production.kv_namespaces]]
binding = "CONTENT"
id = "PROD_NAMESPACE_ID"
```

local dev uses `wrangler dev`, which simulates KV locally — no real namespace needed.

### Cloudflare Access for auth (recommended over Basic Auth)

**Cloudflare Access** (Zero Trust, free for up to 50 users) protects `/admin` at the CF layer — before the request reaches the Worker. you configure it in the Zero Trust dashboard:

1. create an Access Application scoped to `hourihan.xyz/admin*`
2. attach GitHub OAuth as the identity provider
3. define a policy: allow only your GitHub account email
4. session duration: set to something comfortable (e.g. 7 days) for phone use

the Worker code does not need to handle auth at all. access injects `cf-access-authenticated-user-email` as a header — optionally log it, nothing more.

**why not Basic Auth:** cloudflare's own docs recommend against it and explicitly suggest Access instead. Basic Auth credentials can leak and require managing a secret.

### Pages is being deprecated in favour of Workers + Static Assets

cloudflare deprecated Cloudflare Pages as a separate product in April 2025. it's being folded into Workers with static assets. existing Pages projects continue working, but new functionality is being built into the Workers model. the `wrangler.toml` `assets` field handles static file serving.

this means the eventual architecture (`wrangler.toml` with `assets = { directory = "." }`) is already where cloudflare is heading. no urgency to migrate now, but worth knowing.

---

## data model

two KV entry types:

**post entry** — keyed by `post:{id}`
```json
{
  "id": "abc123",
  "title": "some title",
  "body": "markdown content here",
  "type": "idea | devlog | blog",
  "date": "2026-03-10"
}
```

**index entry** — single key `index`, value is a JSON array
```json
[
  { "id": "abc123", "title": "some title", "type": "devlog", "date": "2026-03-10" },
  { "id": "def456", "title": "another post", "type": "idea", "date": "2026-03-08" }
]
```

use the KV **metadata field** to store the index entry data alongside the full post value — this lets `CONTENT.list({ prefix: "post:" })` return titles and dates without fetching full bodies.

on every write: update `post:{id}` and re-write the `index` key. on every delete: remove `post:{id}` and re-write the `index` key.

---

## worker routes

```
GET  /api/posts          → returns index (array of lightweight entries)
GET  /api/posts/:id      → returns full post body
POST /api/posts          → creates a post (auth-gated via Access)
PUT  /api/posts/:id      → updates a post (auth-gated via Access)
DELETE /api/posts/:id    → deletes a post (auth-gated via Access)
```

routing pattern (no framework needed for this few routes):

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    if (pathname === "/api/posts" && method === "GET")
      return handleList(env);
    if (pathname.startsWith("/api/posts/") && method === "GET")
      return handleGet(env, pathname.replace("/api/posts/", ""));
    if (pathname === "/api/posts" && method === "POST")
      return handleCreate(request, env);
    if (pathname.startsWith("/api/posts/") && method === "PUT")
      return handleUpdate(request, env, pathname.replace("/api/posts/", ""));
    if (pathname.startsWith("/api/posts/") && method === "DELETE")
      return handleDelete(env, pathname.replace("/api/posts/", ""));

    return new Response("Not Found", { status: 404 });
  }
};
```

CORS headers needed if the static site and worker are on different origins during dev.

---

## admin page

a plain HTML form at `/admin` — consistent with the rest of the site. protected by Cloudflare Access (not the Worker itself).

fields:
- title (text input)
- type (select: idea / devlog / blog)
- body (textarea, markdown)
- submit → `POST /api/posts`

no markdown preview required to start. the submit handler is plain `fetch()`. on success, redirect to the relevant listing page.

this page is a static file served by Pages — it only gains a `<script>` block with `fetch()` calls. no build step.

---

## how the static pages change

each content page (ideas, devlogs, blog) adds a `fetch('/api/posts')` call on load, filters by `type`, and renders the list. individual post pages add a `fetch('/api/posts/:id')` call.

rendering stays in vanilla JS. no framework. consistent with the rest of the site.

---

## implementation sequence

1. **create KV namespaces** — one for dev, one for prod, via the Cloudflare dashboard or `wrangler kv namespace create`
2. **scaffold the Worker** — `wrangler init`, configure `wrangler.toml` with both namespaces and environments
3. **implement read routes first** (`GET /api/posts`, `GET /api/posts/:id`) — deploy and verify
4. **implement write routes** (`POST`, `PUT`, `DELETE`)
5. **configure Cloudflare Access** — Zero Trust dashboard, GitHub OAuth, scope to `/admin*`
6. **build the admin page** — plain HTML form, `fetch()` POST to the Worker
7. **wire up existing pages** — add `fetch()` calls to ideas, meta/logs, blog pages to pull from KV
8. **test the full write → read flow** — write a post via admin, verify it appears on the public page

---

## gotchas

| gotcha | mitigation |
|---|---|
| eventual consistency — write won't appear instantly | don't re-fetch after write; update local state in the admin UI |
| KV bindings non-inheritable in wrangler.toml | define bindings under both root and `[env.production]` |
| secrets also non-inheritable | `wrangler secret put X --env production` separately |
| worker name in non-default env becomes `name-envname` | use the suffixed name for any service bindings |
| Cloudflare Access session expiry on phone | set session duration to 7d in Zero Trust dashboard |
| `wrangler types` doesn't generate KV types for env blocks | known bug [#9709](https://github.com/cloudflare/workers-sdk/issues/9709) — skip TS types for KV for now |

---

## what doesn't change

- the static site deploy process (GitHub push → Pages auto-deploy) is untouched
- no package.json, no build step added to the static site
- the Worker is a separate deployment — `wrangler deploy --env production`
- content in KV is independent of the repo — writing a post never touches GitHub
