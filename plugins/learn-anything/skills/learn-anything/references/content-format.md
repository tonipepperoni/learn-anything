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

Do **not** reference external images or files — guides are self-contained (no
`![](x.png)`; diagrams that can't be inlined won't render). A leading `# Title`
line is stripped automatically (the app shows its own topic header), so you can
start with `# <Topic Name>` if you like.

Aim for a focused overview a learner can read in a few minutes before quizzing —
the concepts the questions test, explained clearly.

## Quality bar

- Questions must be **accurate** and unambiguous, with plausible distractors.
- Vary difficulty within a topic (some recall, some application).
- Cover the breadth implied by the topic name and its domain.
- Guides and questions should reinforce each other.
