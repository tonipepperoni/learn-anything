---
name: learn-anything
description: Generate a complete, self-contained study + quiz web app for ANY subject or exam — gamified multiple-choice quizzes, per-topic study guides, a timed domain-weighted practice exam, XP/levels/badges/streaks, and a progress dashboard, all backed by SQLite (sql.js) and runnable offline by opening one file. Use when the user wants to build/create a quiz app, study app, exam-prep system, flashcard or practice-test app, or an interactive "learn X / study for Y" system for any topic, course, or certification.
argument-hint: "<subject or exam — e.g. 'AWS Solutions Architect exam' or 'Music Theory basics'>"
allowed-tools: Bash Read Write Edit Task
---

# Learn Anything — study-app generator

Turn any subject into a polished, offline study+quiz web app. The **look, code,
and interaction are a fixed template**; you generate only the **content** (the
curriculum, study guides, and questions) and seed it into SQLite via the build
script. Never rewrite the template's HTML/CSS/JS — drive it entirely through
`study.config.json` + `content/`.

The subject to build for is: **$ARGUMENTS** (if empty, ask the user what they
want to study).

## Prerequisites
- **Node ≥ 22** (the build uses the built-in `node:sqlite`). Check with
  `node --version`. No `npm install` is ever needed — everything is vendored.

## Workflow

### 1. Scope it
Confirm the subject and pick a size. Don't over-ask — infer sensibly, state your
plan in one line, and proceed. Sizing (see `references/config-schema.md`):
- A real **certification/exam** → 12–20 topics, 30–50 questions each, exam size
  matching the real test.
- A **general subject** → 6–12 topics, 15–30 questions each.
- A **focused topic** → 3–6 topics, 8–15 questions each.

### 2. Scaffold the project
Choose a target directory (default `./<slug>` in the current working directory,
where `<slug>` is a kebab-case of the subject). Then copy the template:

```bash
mkdir -p "<target>"
cp -R "${CLAUDE_SKILL_DIR}/template/." "<target>/"
```

### 3. Write `study.config.json`
Read `${CLAUDE_SKILL_DIR}/references/config-schema.md` and write
`<target>/study.config.json`. Design:
- **domains** that partition the subject, with exam **weights**.
- **topics** (id, slug, name, domain) covering the subject with no big gaps.
- **levels** (ideally 10) and **badges** with names/icons that fit the subject's
  world — not generic, not AWS-flavored. Reuse the badge `type`s from the schema.
- realistic `passMark`, `exam.questions`, `exam.minutes`.

### 4. Generate the content (parallelize)
Read `${CLAUDE_SKILL_DIR}/references/content-format.md`. For every topic create,
under `<target>/content/<NN-slug>/`:
- `questions.json` — the multiple-choice questions
- `guide.md` — a focused Markdown study guide
- **3 `.svg` diagram files** referenced from `guide.md` — each guide has exactly
  **3 inlined diagrams** (dark-theme SVGs per the content-format spec)

**Generate topics in parallel**: launch subagents (Task tool) — one per topic —
each writing that topic's files directly, following the content format exactly.
Instruct each subagent to make questions **accurate, unambiguous,
position-independent** (options get shuffled) with plausible distractors and 1–3
sentence explanations; a focused study guide; and **3 explanatory, self-contained
dark-theme SVG diagrams** (valid `viewBox`, light text + accent palette) that each
illustrate a different concept and are referenced at the right spots in the guide.
Prefer the strongest model available for content quality.

### 5. Build the database
```bash
cd "<target>" && node build/build.mjs
```
This seeds SQLite from the config + content and emits the embedded bundles. Fix
any warnings it prints (bad/missing questions, unknown domains).

### 6. Verify and hand off
- Open `<target>/index.html` directly (works over `file://`), or serve it:
  `cd "<target>" && python3 -m http.server 8000`.
- Optionally `git init` the project so the user has a repo per subject.
- Tell the user: what was built (N topics, M questions), how to open it, that the
  **⚙ gear** in the top bar switches among 14 themes (Monokai, Nord, Dracula,
  Tokyo Night, Catppuccin, Gruvbox, Everforest, Rosé Pine, One Dark, Kanagawa,
  Light, Solarized Light, …), that `node build/build.mjs` rebuilds after editing
  content, and that `node update.mjs` pulls the latest app template.

## Rules
- **Do not touch** `index.html`, `css/`, `js/`, `vendor/`, or `build/` in the
  template — they are subject-agnostic. All customization is config + content.
- Options are shuffled at runtime; never rely on answer position.
- Guides are self-contained Markdown with **3 inline SVG diagrams** each (no
  raster/external images).
- Keep one emoji for `icon`; give levels/badges subject-appropriate names.
