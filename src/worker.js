import { DurableObject } from "cloudflare:workers";

// ---------------------------------------------------------------------------
// The hat. One Durable Object instance holds the entire draw.
//
// On the first draw we secretly pre-arrange everyone into one big random loop
// (A -> B -> C -> ... -> A). Each person "pulling a paper" just reveals their
// slot. That guarantees: nobody gets themselves, nobody is ever left with only
// their own name at the end, and every name is pulled exactly once.
// ---------------------------------------------------------------------------
export class Hat extends DurableObject {
  async load(names) {
    const sig = names.join("\u0001");
    let s = await this.ctx.storage.get("state");
    if (!s || s.sig !== sig) {
      // First run, or the list of names was edited: start a fresh hat.
      s = { sig, pairs: makeLoop(names), drawn: {} };
      await this.ctx.storage.deleteAll(); // drop old preview cards too
      await this.ctx.storage.put("state", s);
    }
    return s;
  }

  async status(names) {
    const s = await this.load(names);
    return { drawn: Object.keys(s.drawn) };
  }

  async draw(names, name, token) {
    const s = await this.load(names);
    if (!names.includes(name)) return { error: "Unknown name" };
    const prev = s.drawn[name];
    if (prev) {
      // Same phone coming back: show them their paper again.
      if (token && prev.token === token) return { target: s.pairs[name], token, v: prev.v, again: true };
      return { error: `${name} has already pulled a name from the hat.` };
    }
    const t = crypto.randomUUID();
    const v = t.slice(-8); // short version tag, busts WhatsApp's preview cache
    s.drawn[name] = { token: t, v, at: Date.now() };
    await this.ctx.storage.put("state", s);
    return { target: s.pairs[name], token: t, v, drawnCount: Object.keys(s.drawn).length };
  }

  // The drawer's phone uploads a snapshot of their unfolded paper; it becomes
  // the WhatsApp preview image for their share link.
  async setCard(names, name, token, bytes) {
    const s = await this.load(names);
    const d = s.drawn[name];
    if (!d || d.token !== token) return { error: "Not your paper" };
    await this.ctx.storage.put(`card:${name}`, bytes);
    d.card = true;
    await this.ctx.storage.put("state", s);
    return { ok: true };
  }

  async getCard(name) {
    return (await this.ctx.storage.get(`card:${name}`)) || null;
  }

  async share(names, who) {
    const s = await this.load(names);
    const d = s.drawn[who];
    return { drawn: Object.keys(s.drawn), target: d ? s.pairs[who] : null, v: d?.v, card: !!d?.card };
  }

  async reset() {
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }
}

function makeLoop(names) {
  const a = [...names];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  const pairs = {};
  a.forEach((n, i) => (pairs[n] = a[(i + 1) % a.length]));
  return pairs;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function config(env) {
  const names = [...new Set(String(env.NAMES || "").split(",").map((n) => n.trim()).filter(Boolean))];
  return { names, title: env.TITLE || "The Hat" };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { names, title } = config(env);

    // Mounted under a sub-path (e.g. seance.sh/xmas)? Strip it so the rest of
    // the app can pretend it lives at "/". Requests without it (workers.dev) work too.
    const base = (env.BASE_PATH || "").replace(/\/+$/, "");
    if (base && url.pathname === base) {
      return Response.redirect(`${url.origin}${base}/${url.search}`, 301);
    }
    const mounted = base && url.pathname.startsWith(base + "/");
    const root = mounted ? base : "";
    if (mounted) url.pathname = url.pathname.slice(base.length);
    const hat = env.HAT.get(env.HAT.idFromName("hat"));

    if (url.pathname === "/api/state") {
      const { drawn } = await hat.status(names);
      return json({ title, names, drawn });
    }

    if (url.pathname === "/api/draw" && req.method === "POST") {
      if (names.length < 2) return json({ error: "Need at least two names in the hat." }, 400);
      const body = await req.json().catch(() => ({}));
      const r = await hat.draw(names, String(body.name || ""), body.token ? String(body.token) : null);
      return json(r, r.error ? 409 : 200);
    }

    if (url.pathname === "/api/card" && req.method === "POST") {
      const bytes = await req.arrayBuffer();
      const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
      if (bytes.byteLength > 1_500_000 || head[0] !== 0xff || head[1] !== 0xd8) return json({ error: "Bad image" }, 400);
      const r = await hat.setCard(names, url.searchParams.get("name") || "", url.searchParams.get("token") || "", bytes);
      return json(r, r.error ? 403 : 200);
    }

    // /card/<name>.jpg: that person's preview image (falls back to the generic one)
    const cardMatch = url.pathname.match(/^\/card\/(.+)\.jpg$/);
    if (cardMatch) {
      const bytes = await hat.getCard(decodeURIComponent(cardMatch[1]));
      if (!bytes) return env.ASSETS.fetch(new Request(new URL("/og.jpg", url), req));
      return new Response(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" } });
    }

    if (url.pathname === "/api/reset" && req.method === "POST") {
      if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "nope" }, 403);
      return json(await hat.reset());
    }

    // Share link: /s/<name>. WhatsApp's crawler reads the Open Graph tags and
    // renders a preview card; real people are bounced straight to the game.
    if (url.pathname.startsWith("/s/") || url.pathname === "/s") {
      const who = decodeURIComponent(url.pathname.slice(3)).trim();
      const info = await hat.share(names, who);
      const { drawn } = info;
      const left = names.length - drawn.length;
      const ogTitle = info.target
        ? `🎩 ${who} pulled ${info.target} from the hat!`
        : who ? `🎩 ${who} is pulling a name from the hat…` : `🎩 ${title}`;
      const ogDesc =
        left > 0
          ? `${drawn.length} of ${names.length} have drawn. ${left} still to go. Tap to take your turn!`
          : `All ${names.length} names have been drawn. Merry Christmas! 🎄`;
      const img = info.card
        ? `${url.origin}${root}/card/${encodeURIComponent(who)}.jpg?v=${info.v}`
        : `${url.origin}${root}/og.jpg`;
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(ogTitle)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(title)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(req.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${root}/">
</head><body><script>location.replace("${root}/")</script><a href="${root}/">Go to the hat</a></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } },
      );
    }

    const res = await env.ASSETS.fetch(new Request(url, req));
    // keep any asset redirects (e.g. /index.html -> /) inside the sub-path
    const loc = res.headers.get("location");
    if (root && loc && loc.startsWith("/")) {
      const r = new Response(res.body, res);
      r.headers.set("location", root + loc);
      return r;
    }
    return res;
  },
};
