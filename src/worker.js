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
      if (token && prev.token === token) return { target: s.pairs[name], token, again: true };
      return { error: `${name} has already pulled a name from the hat.` };
    }
    const t = crypto.randomUUID();
    s.drawn[name] = { token: t, at: Date.now() };
    await this.ctx.storage.put("state", s);
    return { target: s.pairs[name], token: t, drawnCount: Object.keys(s.drawn).length };
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

    if (url.pathname === "/api/reset" && req.method === "POST") {
      if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "nope" }, 403);
      return json(await hat.reset());
    }

    // Share link: /s/<name>. WhatsApp's crawler reads the Open Graph tags and
    // renders a preview card; real people are bounced straight to the game.
    if (url.pathname.startsWith("/s/") || url.pathname === "/s") {
      const who = decodeURIComponent(url.pathname.slice(3)).trim();
      const { drawn } = await hat.status(names);
      const left = names.length - drawn.length;
      const ogTitle = who ? `🎩 ${who} pulled a name from the hat!` : `🎩 ${title}`;
      const ogDesc =
        left > 0
          ? `${drawn.length} of ${names.length} have drawn. ${left} still to go. Tap to take your turn!`
          : `All ${names.length} names have been drawn. Merry Christmas! 🎄`;
      const img = `${url.origin}/og.jpg`;
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
<meta property="og:url" content="${esc(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=/">
</head><body><script>location.replace("/")</script><a href="/">Go to the hat</a></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } },
      );
    }

    return env.ASSETS.fetch(req);
  },
};
