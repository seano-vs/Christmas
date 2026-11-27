# 🎩 The Hat

A tiny 3D "pull a name out of a hat" game, run as a single Cloudflare Worker.

1. Tap your name, then confirm it's you.
2. Shake your phone to mix the papers. You can tap the hat instead.
3. Tap a paper. It flies out and unfolds to show your name.
4. Tap **Tell the group on WhatsApp**.

Nobody can pull themselves, each name gets pulled once, and each person gets one pull. On the first pull the hat secretly arranges everyone into one random loop (A→B→C→…→A), so the last person is never stuck with only their own name.

## Setup

```bash
npm install
npx wrangler login
# edit NAMES (and TITLE) in wrangler.toml
npm run deploy
```

It's served at **seance.sh/xmas**. The routes live in `wrangler.toml`, so every deploy keeps them in sync. To move it, change `routes` and `BASE_PATH` together. To serve from the root of a domain, set `BASE_PATH = ""`.

That's all. State lives in one SQLite-backed **Durable Object**, which works on the free plan. There's nothing to create in the dashboard, and every pull is atomic, so two phones can never take the same paper.

> ⚠️ If you change `NAMES` after people have started pulling, the hat starts over.

Local dev: `npm run dev`, then open http://localhost:8787.

### Resetting the hat (optional)

```bash
npx wrangler secret put ADMIN_KEY      # choose any password
curl -X POST https://<your-worker>/api/reset -H "x-admin-key: <password>"
```

## WhatsApp

WhatsApp can't let a website post straight into a group. The Business API doesn't support normal groups, and invite links can't carry a message. So the button opens WhatsApp with the message already filled in (`wa.me/?text=…`), and you pick the group. That's one extra tap.

The message has a link like `https://<worker>/s/Alice`. WhatsApp turns it into a preview card: **"🎩 Alice pulled a name from the hat!"**, plus "3 of 6 have drawn. 3 still to go" and a picture of the hat. Tapping the card opens the game. The card **never shows who someone got**.

To start things off, post `https://<worker>/s` (or just the main URL) in the group.

## Files

- `src/worker.js`: API, Durable Object, and WhatsApp preview pages
- `public/`: the game (three.js from a CDN, no build step), plus `og.jpg` for the preview card
