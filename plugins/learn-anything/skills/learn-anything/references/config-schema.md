# `study.config.json` schema

One JSON file at the project root drives all branding, curriculum, gamification
and exam settings. The build script (`build/build.mjs`) reads it plus the
per-topic content and produces the SQLite database the web app runs on.

```jsonc
{
  "title": "Music Theory Fundamentals",   // shown as the app name (required)
  "subtitle": "Master the building blocks of music", // optional tagline
  "icon": "🎵",                            // 1 emoji, used as logo + favicon
  "slug": "music-theory",                  // optional; localStorage key (auto from title)

  "passMark": 72,                          // % needed to pass the practice exam
  "masteryThreshold": 95,                  // % of a topic's questions correct = "mastered"
  "exam": { "questions": 30, "minutes": 45 }, // practice-exam size + time limit

  // Domains group topics and weight the practice exam (weights need not sum to 100;
  // they are normalized). Order here sets the accent-color order (up to 8 domains).
  "domains": [
    { "name": "Fundamentals", "weight": 40 },
    { "name": "Harmony",      "weight": 35 },
    { "name": "Rhythm & Form", "weight": 25 }
  ],

  // 10 levels are ideal but any number >= 2 works. Sorted by xp automatically.
  // Give them subject-flavored names (not "Cloud Newbie" unless it's an AWS app).
  "levels": [
    { "xp": 0,    "icon": "🎵", "name": "Novice" },
    { "xp": 100,  "icon": "🎼", "name": "Apprentice" },
    { "xp": 300,  "icon": "🎹", "name": "Student" },
    { "xp": 600,  "icon": "🎷", "name": "Player" },
    { "xp": 1000, "icon": "🎺", "name": "Musician" },
    { "xp": 1500, "icon": "🎻", "name": "Performer" },
    { "xp": 2100, "icon": "🎙️", "name": "Composer" },
    { "xp": 2800, "icon": "👑", "name": "Maestro" },
    { "xp": 3600, "icon": "🎯", "name": "Virtuoso" },
    { "xp": 4500, "icon": "🌟", "name": "Legend" }
  ],

  // Badges are evaluated by a generic engine — see "type" values below.
  // Reuse the 10 canonical badges; only change icon/name/desc (and domain for
  // master-domain) to fit the subject.
  "badges": [
    { "id": "hot-streak",   "icon": "🔥", "name": "Hot Streak",   "desc": "5-day study streak",           "type": "streak", "n": 5 },
    { "id": "speed-demon",  "icon": "⚡", "name": "Speed Demon",  "desc": "10 correct answers in a row",  "type": "speed", "n": 10 },
    { "id": "deep-diver",   "icon": "🧠", "name": "Deep Diver",   "desc": "Master any single topic",      "type": "master-any" },
    { "id": "ascendant",    "icon": "🏔️", "name": "Ascendant",    "desc": "Reach Level 5",                "type": "level", "n": 5 },
    { "id": "scholar",      "icon": "💎", "name": "Scholar",      "desc": "Master 10 topics",             "type": "master-count", "n": 10 },
    { "id": "exam-ready",   "icon": "🎯", "name": "Exam Ready",   "desc": "85%+ mastery across all topics", "type": "all-mastery", "pct": 85 },
    { "id": "perfectionist","icon": "👑", "name": "Perfectionist","desc": "100% on any topic",            "type": "perfect" },
    { "id": "well-rounded", "icon": "🌈", "name": "Well-Rounded", "desc": "Attempt every topic",          "type": "well-rounded" },
    { "id": "harmony-pro",  "icon": "🎹", "name": "Harmony Pro",  "desc": "Master every Harmony topic",   "type": "master-domain", "domain": "Harmony" }
  ],

  // Topics. id must be a unique integer (1..N). slug is kebab-case; the content
  // for a topic lives in content/<zero-padded-id>-<slug>/. domain must match a
  // domain name above.
  "topics": [
    { "id": 1, "slug": "intervals",  "name": "Intervals",        "domain": "Fundamentals" },
    { "id": 2, "slug": "scales",     "name": "Scales & Modes",   "domain": "Fundamentals" },
    { "id": 3, "slug": "chords",     "name": "Chords & Triads",  "domain": "Harmony" }
  ]
}
```

## Badge `type` values (evaluated by the app)

| type | params | unlocks when |
|------|--------|--------------|
| `streak` | `n` | daily study streak reaches `n` |
| `speed` | `n` | `n` correct answers in a row |
| `level` | `n` | player level reaches `n` |
| `master-any` | — | any 1 topic mastered |
| `master-count` | `n` | `n` topics mastered |
| `all-mastery` | `pct` | every topic ≥ `pct`% mastery |
| `perfect` | — | any topic at 100% |
| `well-rounded` | — | at least one question attempted in every topic |
| `master-domain` | `domain` | every topic in that domain mastered |

"Mastered" = `masteryThreshold`% (default 95) of a topic's questions answered
correctly at least once.

## Sizing guidance

- **Certification/exam prep** (e.g. a real exam): 15–20 topics, 30–50 questions
  each, `exam.questions` matching the real exam (e.g. 65), realistic `passMark`.
- **A general subject** (e.g. "Music Theory", "World War II"): 6–12 topics,
  15–30 questions each, `exam.questions` ~20–40.
- **A focused topic** (e.g. "Python list comprehensions"): 3–6 topics, 8–15
  questions each.

Always give levels and badges names that fit the subject's world.
