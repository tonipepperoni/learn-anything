# Content format

Each topic in `study.config.json` has a folder under `content/` named
`<zero-padded-id>-<slug>/` — e.g. topic `{ "id": 1, "slug": "intervals" }` →
`content/01-intervals/`. Each folder holds two files.

## `questions.json` — a JSON array of multiple-choice questions

```json
[
  {
    "question": "How many semitones are in a perfect fifth?",
    "options": ["5", "6", "7", "8"],
    "answer": 2,
    "explanation": "A perfect fifth spans 7 semitones (e.g. C to G). It is the most consonant interval after the octave and underpins the circle of fifths."
  }
]
```

Rules:
- **`options`**: 2–6 choices (4 is standard). The app **shuffles** options on
  every render, so answer position does not matter — do **not** bias toward one
  slot, and never write "all/none of the above" or "both A and B".
- **`answer`**: zero-based index of the correct option (`2` = the third option).
  A letter (`"C"`) is also accepted.
- **`explanation`**: 1–3 sentences on *why* the answer is correct (and ideally
  why a tempting wrong option is wrong). This is shown after answering and in
  review. Supports inline `` `code` ``, **bold**, and ```fenced code blocks```.
- Exactly one correct answer per question. Keep questions self-contained.

## `guide.md` — a Markdown study guide for the topic

Standard Markdown, rendered to HTML at build time (via `marked`). Use:

- `##` / `###` headings to structure concepts
- Short paragraphs and **bold** for key terms
- Bullet and numbered lists
- **Tables** for comparisons (render nicely)
- Fenced code blocks where relevant

A leading `# Title` line is stripped automatically (the app shows its own topic
header), so you can start with `# <Topic Name>` if you like. Do not use raster
images (`![](x.png)`) — diagrams are **SVG only** (see below).

Aim for a focused overview a learner can read in a few minutes before quizzing —
the concepts the questions test, explained clearly.

## Diagrams — 3 SVGs per guide (required)

Every guide includes **exactly 3 inline SVG diagrams** illustrating distinct
concepts. Write each as its own `.svg` file in the topic folder and reference it
in `guide.md` at the relevant point with standard Markdown image syntax — the
build inlines the SVG (responsively) and turns the alt text into a caption:

```markdown
![How the circle of fifths orders keys](circle-of-fifths.svg)
```

Author the SVGs to match the app's **dark theme**:

- Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">`. A
  **`viewBox` is required** (the build strips `width`/`height`; the viewBox makes
  it scale to the page). Landscape ratios read best.
- **Dark-theme colors** — the diagram sits on a near-black panel, so use light
  text and bright accents, never dark-on-white:
  - text `#f8f8f2` (primary), `#a6a692` (secondary)
  - accents: green `#a6e22e`, blue `#66d9ef`, pink `#f92672`, orange `#fd971f`,
    purple `#ae81ff`, yellow `#e6db74`
  - lines/borders `#5c5f52`; optional panel fill `#1b1c16`
- `font-family="monospace"`, `font-size` ~14–18 (viewBox units); legible, uncrowded.
- Make them **explanatory** — labeled boxes, arrows, flows, comparisons, number
  lines, cycles: the real structure of the concept, not decoration. The 3 should
  each cover a *different* idea from the guide.
- **Fully self-contained**: only inline shapes/text/paths with presentation
  attributes (`fill`, `stroke`, …). No external images, fonts, scripts,
  `<image href>`, or CSS classes.

Minimal example:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120">
  <rect x="20" y="35" width="150" height="50" rx="8" fill="none" stroke="#66d9ef" stroke-width="2"/>
  <text x="95" y="65" fill="#f8f8f2" font-family="monospace" font-size="16" text-anchor="middle">Tonic (I)</text>
  <defs><marker id="arw" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#a6a692"/></marker></defs>
  <line x1="175" y1="60" x2="225" y2="60" stroke="#a6a692" stroke-width="2" marker-end="url(#arw)"/>
  <rect x="230" y="35" width="150" height="50" rx="8" fill="none" stroke="#a6e22e" stroke-width="2"/>
  <text x="305" y="65" fill="#f8f8f2" font-family="monospace" font-size="16" text-anchor="middle">Dominant (V)</text>
</svg>
```

## Quality bar

- Questions must be **accurate** and unambiguous, with plausible distractors.
- Vary difficulty within a topic (some recall, some application).
- Cover the breadth implied by the topic name and its domain.
- Guides and questions should reinforce each other.
