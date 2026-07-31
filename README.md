# 📚 Learn Anything

A **Claude Code skill** that turns *any* subject into a polished, offline
**study + quiz web app** — in one command.

Ask it to build a study app for the AWS Solutions Architect exam, Music Theory,
Spanish A1, the French Revolution, organic chemistry, your company's onboarding
docs… anything. It designs a curriculum, writes the study guides and quiz
questions, and seeds them into a real **SQLite** database that powers a
self-contained web app you can open by double-clicking a file.

The **design, code, and interaction are a fixed, tested template** — only the
*content* is generated per subject, so every app you make looks and feels the
same and just works.

## Install

In Claude Code:

```
/plugin marketplace add makeit-run/learn-anything
/plugin install learn@learn-anything
```

Then reload plugins (`/reload-plugins`) if prompted.

**Requires [Node.js](https://nodejs.org) ≥ 22** (the build uses the built-in
`node:sqlite`). No `npm install` — everything is vendored.

## Use it

```
/learn:anything AWS Solutions Architect exam
/learn:anything Music Theory fundamentals
/learn:anything Spanish A1 vocabulary
/learn:anything the US Constitution
```

Claude will design the curriculum, generate the guides + questions (in parallel),
build the SQLite database, and hand you a ready-to-open app. Open its
`index.html` — or serve it with `python3 -m http.server` — and start learning.

## What you get

Every generated app includes:

- **📊 Dashboard** — level, XP, streak, per-topic mastery grid, domain readiness.
- **📝 Quizzes** — by topic, all-topics, or *weak spots*. Options are **shuffled**
  every time, instant feedback with an explanation, keyboard shortcuts.
- **📖 Study guides** — a rendered Markdown overview per topic (headings, tables,
  code), with a "Quiz this topic" jump-off.
- **⏱️ Practice exam** — domain-weighted, timed, flag/jump navigator, pass mark,
  per-domain results breakdown.
- **🎮 Gamification** — XP, 10 levels, badges, and daily streaks, all themed to
  the subject.
- **🎨 Themeable** — a ⚙ settings menu with **14 terminal/editor-inspired themes**
  (Monokai, Dim, Nord, Dracula, Tokyo Night, Catppuccin Mocha, Gruvbox,
  Everforest, Rosé Pine, One Dark, Kanagawa, plus Light, Catppuccin Latte and
  Solarized Light) for eye comfort; the choice persists per browser.
- **💾 Real SQLite, zero backend** — questions live in a SQLite DB queried in the
  browser via sql.js (WebAssembly). The DB and wasm are embedded, so the app runs
  offline straight off the filesystem and deploys to any static host / GitHub
  Pages.

Progress (XP, badges, mastery) is saved in the browser's `localStorage`.

## How it works

```
study.config.json   →  branding, domains, topics, levels, badges, exam settings
content/<topic>/
  ├─ guide.md        →  the study guide (Markdown)
  └─ questions.json  →  multiple-choice questions
        │
        ▼   node build/build.mjs
   data/quiz.db      →  SQLite (topics, questions, options, guides, config)
   + embedded base64 bundles the static app loads
```

The skill only ever **writes the config and content** and runs the build — it
never edits the template's HTML/CSS/JS. That's what keeps every app consistent
and makes the system flexible: new subject = new config + content, same app.

See the skill's `references/` for the
[config schema](plugins/learn/skills/anything/references/config-schema.md)
and [content format](plugins/learn/skills/anything/references/content-format.md).

## Editing a generated app

Each app is a normal folder (optionally its own git repo). Edit any
`content/<topic>/questions.json` or `guide.md`, or `study.config.json`, then
rebuild:

```bash
node build/build.mjs
```

**Updating an existing app** to the latest template (new features, themes, fixes)
without touching your content or saved progress:

```bash
node update.mjs
```

## Repo layout

```
.claude-plugin/marketplace.json          # marketplace catalog
plugins/learn/
├── .claude-plugin/plugin.json
└── skills/anything/
    ├── SKILL.md                          # generator instructions
    ├── references/                       # config schema + content format
    └── template/                         # the config-driven web app (never edited per-subject)
```

## License

MIT © Make It Run
