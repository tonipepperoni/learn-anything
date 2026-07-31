/*
 * db.js — loads the embedded SQLite database with sql.js and exposes query helpers.
 * Global `QuizDB`. No fetches: the wasm and the .db are embedded as base64, so this
 * works over file:// as well as http(s).
 */
(function () {
  'use strict';

  var db = null;
  var topicsCache = null;
  var configCache = null;

  function b64ToBytes(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function init() {
    return new Promise(function (resolve, reject) {
      if (typeof initSqlJs !== 'function') { reject(new Error('sql.js not loaded')); return; }
      if (!window.__SQL_WASM_B64) { reject(new Error('wasm bundle missing')); return; }
      if (!window.__QUIZ_DB_B64) { reject(new Error('database bundle missing')); return; }
      initSqlJs({ wasmBinary: b64ToBytes(window.__SQL_WASM_B64) })
        .then(function (SQL) {
          db = new SQL.Database(b64ToBytes(window.__QUIZ_DB_B64));
          var cfg = config();
          var ts = topics();
          if (window.Store) Store.init(cfg, ts);
          buildTopicIndexes();
          resolve(cfg);
        })
        .catch(reject);
    });
  }

  function rows(sql, params) {
    var stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    var out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  }

  function config() {
    if (configCache) return configCache;
    var r = rows('SELECT json FROM app_config WHERE id = 1');
    configCache = r.length ? JSON.parse(r[0].json) : {};
    return configCache;
  }

  function topics() {
    if (topicsCache) return topicsCache;
    topicsCache = rows('SELECT id, slug, name, domain, domain_index, domain_weight, question_count FROM topics ORDER BY id');
    return topicsCache;
  }
  function topicById(id) {
    var ts = topics();
    for (var i = 0; i < ts.length; i++) if (ts[i].id === id) return ts[i];
    return null;
  }

  function buildTopicIndexes() {
    var ts = topics();
    var totals = {}, idsByTopic = {};
    ts.forEach(function (t) { totals[t.id] = t.question_count; idsByTopic[t.id] = []; });
    rows('SELECT id, topic_id FROM questions').forEach(function (r) {
      (idsByTopic[r.topic_id] = idsByTopic[r.topic_id] || []).push(r.id);
    });
    if (window.Store) { Store.setTopicTotals(totals); Store.setIdsByTopic(idsByTopic); }
  }

  function questionsByIds(ids) {
    if (!ids.length) return [];
    var ph = ids.map(function () { return '?'; }).join(',');
    var qrows = rows('SELECT id, topic_id, number, text, correct, explanation FROM questions WHERE id IN (' + ph + ')', ids);
    var orows = rows('SELECT question_id, letter, text FROM options WHERE question_id IN (' + ph + ') ORDER BY letter', ids);
    var optByQ = {};
    orows.forEach(function (o) { (optByQ[o.question_id] = optByQ[o.question_id] || []).push({ letter: o.letter, text: o.text }); });
    var byId = {};
    qrows.forEach(function (q) { q.options = optByQ[q.id] || []; byId[q.id] = q; });
    return ids.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function idsForTopic(topicId) { return rows('SELECT id FROM questions WHERE topic_id = ? ORDER BY number', [topicId]).map(function (r) { return r.id; }); }
  function idsForTopics(topicIds) { var out = []; topicIds.forEach(function (t) { out = out.concat(idsForTopic(t)); }); return out; }
  function allIds() { return rows('SELECT id FROM questions ORDER BY id').map(function (r) { return r.id; }); }
  function idsByTopicMap() { var m = {}; topics().forEach(function (t) { m[t.id] = idsForTopic(t.id); }); return m; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function buildQuiz(spec) {
    var ids;
    if (spec.mode === 'topic') ids = shuffle(idsForTopic(spec.topicId));
    else if (spec.mode === 'weak') ids = weakIds();
    else ids = shuffle(allIds());
    if (spec.count && spec.count > 0) ids = ids.slice(0, spec.count);
    return questionsByIds(ids);
  }

  function weakIds() {
    var st = Store.state();
    var map = idsByTopicMap();
    var topicRank = topics().map(function (t) { return { id: t.id, m: Store.topicStats(t.id).masteryPct }; }).sort(function (a, b) { return a.m - b.m; });
    var notCorrect = [], seenWrong = [];
    topicRank.forEach(function (tr) {
      map[tr.id].forEach(function (qid) {
        var q = st.questions[qid];
        if (!q) notCorrect.push(qid);
        else if (!q.c) seenWrong.push(qid);
      });
    });
    var combined = seenWrong.concat(notCorrect);
    return combined.length ? combined : shuffle(allIds());
  }

  // Exam: `total` questions distributed by domain weight (largest-remainder rounding).
  function buildExam(total) {
    total = total || (config().exam && config().exam.questions) || 30;
    var ts = topics();
    var byDomain = {};
    ts.forEach(function (t) { (byDomain[t.domain] = byDomain[t.domain] || { weight: t.domain_weight, topics: [] }).topics.push(t.id); });
    var domains = Object.keys(byDomain);
    var totalWeight = domains.reduce(function (s, d) { return s + byDomain[d].weight; }, 0) || domains.length;
    var alloc = domains.map(function (d) {
      var exact = (byDomain[d].weight || 1) / totalWeight * total;
      return { d: d, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    var used = alloc.reduce(function (s, a) { return s + a.floor; }, 0);
    alloc.sort(function (a, b) { return b.frac - a.frac; });
    for (var i = 0; i < total - used; i++) alloc[i % alloc.length].floor += 1;
    var picked = [];
    alloc.forEach(function (a) { picked = picked.concat(shuffle(idsForTopics(byDomain[a.d].topics)).slice(0, a.floor)); });
    // top up if a domain was short on questions
    if (picked.length < total) {
      var extra = shuffle(allIds()).filter(function (id) { return picked.indexOf(id) === -1; });
      picked = picked.concat(extra.slice(0, total - picked.length));
    }
    return questionsByIds(shuffle(picked).slice(0, total));
  }

  var guidesAvailable = null;
  function hasGuides() {
    if (guidesAvailable === null) guidesAvailable = rows("SELECT name FROM sqlite_master WHERE type='table' AND name='guides'").length > 0;
    return guidesAvailable;
  }
  function guideFor(topicId) {
    if (!hasGuides()) return null;
    var r = rows('SELECT content FROM guides WHERE topic_id = ?', [topicId]);
    return r.length ? r[0].content : null;
  }

  window.QuizDB = {
    init: init,
    config: config,
    topics: topics,
    topicById: topicById,
    questionsByIds: questionsByIds,
    idsForTopic: idsForTopic,
    idsByTopicMap: idsByTopicMap,
    buildQuiz: buildQuiz,
    buildExam: buildExam,
    shuffle: shuffle,
    hasGuides: hasGuides,
    guideFor: guideFor,
  };
})();
