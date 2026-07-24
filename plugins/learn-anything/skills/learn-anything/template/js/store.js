/*
 * store.js — progress + gamification state in localStorage. Config-driven:
 * levels, badges and thresholds all come from the app's study.config.json
 * (loaded from the DB and passed to Store.init). Global `Store`.
 */
(function () {
  'use strict';

  var config = null;
  var LEVELS = [];
  var BADGES = [];
  var MASTERY_THRESHOLD = 95;
  var domainTopicIds = {};   // domain name -> [topicId,...]
  var KEY = 'learn-anything:default:v1';

  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

  function defaultState() {
    return {
      xp: 0,
      questions: {},          // id -> { a: attempts, c: everCorrect, ft: firstTryCorrect }
      topicsSeen: {},         // topicId -> true
      streak: { current: 0, longest: 0, last: null }, // last = 'YYYY-MM-DD'
      badges: {},             // id -> iso earned
      correctInARow: 0,
      maxCorrectInARow: 0,
      bestExam: null,
      examsTaken: 0,
      created: null,
    };
  }

  var state = defaultState();

  // Initialize from the app config (levels, badges, threshold) + topic→domain map.
  function init(cfg, topics) {
    config = cfg;
    LEVELS = (cfg.levels || []).slice();
    BADGES = (cfg.badges || []).slice();
    MASTERY_THRESHOLD = Number(cfg.masteryThreshold) || 95;
    KEY = 'learn-anything:' + (cfg.slug || slugify(cfg.title)) + ':v1';
    domainTopicIds = {};
    (topics || []).forEach(function (t) {
      (domainTopicIds[t.domain] = domainTopicIds[t.domain] || []).push(t.id);
    });
    state = load();
    // expose for the UI
    pub.LEVELS = LEVELS;
    pub.BADGES = BADGES;
    pub.MASTERY_THRESHOLD = MASTERY_THRESHOLD;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) { var s = defaultState(); s.created = new Date().toISOString(); return s; }
      var parsed = JSON.parse(raw);
      var base = defaultState();
      for (var k in parsed) base[k] = parsed[k];
      return base;
    } catch (e) { var d = defaultState(); d.created = new Date().toISOString(); return d; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }

  function levelForXp(xp) {
    var cur = LEVELS[0] || { lvl: 1, xp: 0, icon: '⭐', name: 'Beginner' };
    for (var i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) cur = LEVELS[i];
    return cur;
  }
  function nextLevel(xp) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].xp > xp) return LEVELS[i];
    return null;
  }

  function touchStreak() {
    var t = todayStr(), s = state.streak;
    if (s.last === t) return 0;
    if (s.last && daysBetween(s.last, t) === 1) s.current += 1; else s.current = 1;
    s.last = t;
    if (s.current > s.longest) s.longest = s.current;
    return 5;
  }

  function recordAnswer(qid, topicId, isCorrect) {
    var prevLevel = levelForXp(state.xp).lvl;
    var xp = 0;
    xp += touchStreak();
    state.topicsSeen[topicId] = true;

    var q = state.questions[qid] || { a: 0, c: false, ft: false };
    var firstAttempt = q.a === 0;
    q.a += 1;
    if (isCorrect) {
      if (firstAttempt) q.ft = true;
      q.c = true;
      if (q.a === 1) xp += 10; else if (q.a === 2) xp += 5; else xp += 2;
      state.correctInARow += 1;
      if (state.correctInARow > state.maxCorrectInARow) state.maxCorrectInARow = state.correctInARow;
    } else {
      state.correctInARow = 0;
    }
    state.questions[qid] = q;
    state.xp += xp;

    var newLevel = levelForXp(state.xp).lvl;
    var earned = checkBadges();
    save();
    return { xp: xp, badges: earned, leveledUp: newLevel > prevLevel, prevLevel: prevLevel, newLevel: newLevel, firstTry: isCorrect && firstAttempt };
  }

  function recordExam(score, total) {
    var pct = total ? Math.round((score / total) * 100) : 0;
    state.examsTaken += 1;
    if (!state.bestExam || pct > state.bestExam.pct) state.bestExam = { score: score, total: total, pct: pct, date: new Date().toISOString() };
    save();
    return { pct: pct };
  }

  // ---- mastery ----
  var topicTotals = null, idsByTopic = null;
  function setTopicTotals(t) { topicTotals = t; }
  function setIdsByTopic(m) { idsByTopic = m; }

  function topicStats(topicId) {
    var total = (topicTotals && topicTotals[topicId]) || 0;
    var attempted = 0, mastered = 0, firstTry = 0, attempts = 0;
    var ids = (idsByTopic && idsByTopic[topicId]) || [];
    for (var i = 0; i < ids.length; i++) {
      var q = state.questions[ids[i]];
      if (!q) continue;
      attempted += 1; attempts += q.a;
      if (q.c) mastered += 1;
      if (q.ft) firstTry += 1;
    }
    var masteryPct = total ? Math.round((mastered / total) * 100) : 0;
    return {
      total: total, attempted: attempted, mastered: mastered,
      masteryPct: masteryPct, accuracyPct: attempted ? Math.round((firstTry / attempted) * 100) : 0,
      tier: masteryTier(attempted === 0 ? -1 : masteryPct),
    };
  }
  function masteryTier(pct) {
    if (pct < 0) return { icon: '⬜', label: 'Not started', cls: 'none' };
    if (pct < 50) return { icon: '🟥', label: 'Needs work', cls: 'low' };
    if (pct < 70) return { icon: '🟧', label: 'Getting there', cls: 'mid' };
    if (pct < 85) return { icon: '🟨', label: 'Good', cls: 'good' };
    if (pct < 95) return { icon: '🟩', label: 'Strong', cls: 'strong' };
    return { icon: '🌟', label: 'Mastered', cls: 'master' };
  }
  function masteredTopicIds() {
    if (!idsByTopic) return [];
    var out = [];
    for (var tid in idsByTopic) if (topicStats(parseInt(tid, 10)).masteryPct >= MASTERY_THRESHOLD) out.push(parseInt(tid, 10));
    return out;
  }
  function allTopicIds() { return idsByTopic ? Object.keys(idsByTopic).map(function (x) { return parseInt(x, 10); }) : []; }

  // ---- generic badge engine (badge.type drives the rule) ----
  function checkBadges() {
    var earned = [];
    function grant(id) { if (!state.badges[id]) { state.badges[id] = new Date().toISOString(); earned.push(id); } }
    var mastered = masteredTopicIds();
    var all = allTopicIds();
    for (var i = 0; i < BADGES.length; i++) {
      var b = BADGES[i];
      if (state.badges[b.id]) continue;
      var ok = false;
      switch (b.type) {
        case 'streak':       ok = state.streak.current >= (b.n || 5); break;
        case 'speed':        ok = state.maxCorrectInARow >= (b.n || 10); break;
        case 'level':        ok = levelForXp(state.xp).lvl >= (b.n || 5); break;
        case 'master-any':   ok = mastered.length >= 1; break;
        case 'master-count': ok = mastered.length >= (b.n || 1); break;
        case 'perfect':      ok = all.some(function (t) { return topicStats(t).masteryPct >= 100; }); break;
        case 'well-rounded': ok = all.length > 0 && all.every(function (t) { return state.topicsSeen[t]; }); break;
        case 'all-mastery':  ok = all.length > 0 && all.every(function (t) { return topicStats(t).masteryPct >= (b.pct || 85); }); break;
        case 'master-domain':
          var dt = domainTopicIds[b.domain] || [];
          ok = dt.length > 0 && dt.every(function (t) { return mastered.indexOf(t) !== -1; });
          break;
        default: ok = false;
      }
      if (ok) grant(b.id);
    }
    return earned;
  }

  function overallReadiness() {
    var tids = allTopicIds();
    if (!tids.length) return 0;
    var sum = 0; tids.forEach(function (t) { sum += topicStats(t).masteryPct; });
    return Math.round(sum / tids.length);
  }
  function totals() {
    var attempted = 0, correct = 0, attempts = 0;
    for (var id in state.questions) { var q = state.questions[id]; attempted += 1; attempts += q.a; if (q.c) correct += 1; }
    return { attempted: attempted, correct: correct, attempts: attempts };
  }
  function reset() { state = defaultState(); state.created = new Date().toISOString(); save(); }

  var pub = {
    init: init,
    LEVELS: LEVELS, BADGES: BADGES, MASTERY_THRESHOLD: MASTERY_THRESHOLD,
    state: function () { return state; },
    save: save, reset: reset,
    levelForXp: levelForXp, nextLevel: nextLevel,
    recordAnswer: recordAnswer, recordExam: recordExam,
    topicStats: topicStats, masteryTier: masteryTier,
    masteredTopicIds: masteredTopicIds, overallReadiness: overallReadiness, totals: totals,
    setTopicTotals: setTopicTotals, setIdsByTopic: setIdsByTopic,
    questionStat: function (qid) { return state.questions[qid] || null; },
  };
  window.Store = pub;
})();
