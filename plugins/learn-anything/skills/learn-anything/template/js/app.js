/*
 * app.js — UI, routing and quiz/exam flows. Global `App`. Classic script (file:// safe).
 * Config-driven: branding, domains, levels, badges and exam settings all come from
 * the app's study.config.json (loaded from the DB by db.js / QuizDB.config()).
 */
(function () {
  'use strict';

  var root;          // #app container
  var view = 'home'; // current view name
  var quiz = null;   // active quiz session
  var exam = null;   // active exam session
  var guideTopic = null; // topic id of the open study guide

  var CFG = null;    // app config
  var _domIndex = null;
  function domainOrder() { return CFG && CFG.domains ? CFG.domains.map(function (d) { return d.name; }) : []; }
  function domClass(name) {
    if (!_domIndex) { _domIndex = {}; ((CFG && CFG.domains) || []).forEach(function (d, i) { _domIndex[d.name] = i; }); }
    var i = _domIndex[name];
    return 'd' + ((i == null ? 0 : i) % 8);
  }
  function applyBranding(cfg) {
    try {
      document.title = cfg.title || 'Study Quiz';
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + (cfg.icon || '📚') + "</text></svg>";
      var link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    } catch (e) {}
  }

  // ---------- small helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // limited markdown -> html for question stems & explanations
  function fmt(text) {
    if (!text) return '';
    var codeBlocks = [];
    var s = text.replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, function (_, code) {
      codeBlocks.push(code.replace(/\n$/, ''));
      return ' CB' + (codeBlocks.length - 1) + ' ';
    });
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    var parts = s.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; });
    s = parts.join('');
    s = s.replace(/ CB(\d+) /g, function (_, i) { return '<pre><code>' + esc(codeBlocks[+i]) + '</code></pre>'; });
    return s;
  }

  function toast(html, kind) {
    var box = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = html;
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  }

  function badgeById(id) {
    for (var i = 0; i < Store.BADGES.length; i++) if (Store.BADGES[i].id === id) return Store.BADGES[i];
    return null;
  }
  function announceRewards(res) {
    if (res.xp) toast('<span class="xp">+' + res.xp + ' XP</span>', 'xp');
    if (res.leveledUp) {
      var lv = Store.levelForXp(Store.state().xp);
      toast('<span class="lvl">' + lv.icon + ' Level ' + lv.lvl + ' — ' + esc(lv.name) + '!</span>', 'level');
    }
    (res.badges || []).forEach(function (id) {
      var b = badgeById(id);
      if (b) toast('<span class="bdg">' + b.icon + ' Badge unlocked: ' + esc(b.name) + '</span>', 'badge');
    });
  }

  // ---------- top bar ----------
  function renderNav() {
    var st = Store.state();
    var lv = Store.levelForXp(st.xp);
    var next = Store.nextLevel(st.xp);
    var pct = next ? Math.round(((st.xp - lv.xp) / (next.xp - lv.xp)) * 100) : 100;
    var nav = document.getElementById('nav');
    nav.innerHTML =
      '<div class="brand" data-nav="home">' + (CFG.icon || '📚') + ' <span>' + esc(CFG.title) + '</span></div>' +
      '<nav class="links">' +
        '<a data-nav="home" class="' + (view === 'home' ? 'active' : '') + '">Dashboard</a>' +
        '<a data-nav="quizsetup" class="' + (view === 'quizsetup' ? 'active' : '') + '">Quiz</a>' +
        '<a data-nav="study" class="' + (view === 'study' || view === 'guide' ? 'active' : '') + '">Study</a>' +
        '<a data-nav="examintro" class="' + (view === 'examintro' ? 'active' : '') + '">Exam</a>' +
        '<a data-nav="badges" class="' + (view === 'badges' ? 'active' : '') + '">Badges</a>' +
      '</nav>' +
      '<div class="lvlchip" data-nav="home" title="Level ' + lv.lvl + ' — ' + esc(lv.name) + '">' +
        '<span class="lvlicon">' + lv.icon + '</span>' +
        '<span class="lvlmeta"><b>Lv ' + lv.lvl + '</b><small>' + st.xp + ' XP</small></span>' +
        '<span class="lvlbar"><i style="width:' + pct + '%"></i></span>' +
        (st.streak.current > 0 ? '<span class="streak" title="' + st.streak.current + '-day streak">🔥' + st.streak.current + '</span>' : '') +
      '</div>';
    Array.prototype.forEach.call(nav.querySelectorAll('[data-nav]'), function (n) {
      n.addEventListener('click', function () { go(n.getAttribute('data-nav')); });
    });
  }

  // ---------- router ----------
  function go(v, opts) { view = v; render(opts); window.scrollTo(0, 0); }

  function render(opts) {
    renderNav();
    if (view === 'home') return renderHome();
    if (view === 'quizsetup') return renderQuizSetup();
    if (view === 'quiz') return renderQuizQuestion();
    if (view === 'quizresult') return renderQuizResult();
    if (view === 'examintro') return renderExamIntro();
    if (view === 'exam') return renderExam();
    if (view === 'examresult') return renderExamResult();
    if (view === 'badges') return renderBadges();
    if (view === 'study') return renderStudyIndex();
    if (view === 'guide') return renderGuide();
  }

  // ---------- home / dashboard ----------
  function masteryBar(pct, cls) {
    var w = pct <= 0 ? 0 : Math.max(pct, 2);
    return '<span class="mbar"><i class="' + cls + '" style="width:' + w + '%"></i></span>';
  }

  function renderHome() {
    var st = Store.state();
    var lv = Store.levelForXp(st.xp);
    var next = Store.nextLevel(st.xp);
    var toNext = next ? (next.xp - st.xp) : 0;
    var t = Store.totals();
    var readiness = Store.overallReadiness();
    var topics = QuizDB.topics();
    var totalQ = topics.reduce(function (s, x) { return s + x.question_count; }, 0);

    var domStats = {};
    domainOrder().forEach(function (d) { domStats[d] = { sum: 0, n: 0 }; });
    topics.forEach(function (tp) {
      var m = Store.topicStats(tp.id).masteryPct;
      if (domStats[tp.domain]) { domStats[tp.domain].sum += m; domStats[tp.domain].n += 1; }
    });

    var readyClass = readiness >= 85 ? 'strong' : readiness >= 70 ? 'good' : readiness >= 40 ? 'mid' : 'low';

    var html =
      '<section class="hero">' +
        '<div class="hero-main">' +
          '<div class="hero-level"><span class="big">' + lv.icon + '</span>' +
            '<div><h1>Level ' + lv.lvl + ' · ' + esc(lv.name) + '</h1>' +
            '<p class="muted">' + st.xp + ' XP' + (next ? ' · ' + toNext + ' XP to ' + next.icon + ' ' + esc(next.name) : ' · max level 🎉') + '</p></div>' +
          '</div>' +
          '<div class="xpbar"><i style="width:' + (next ? Math.round(((st.xp - lv.xp) / (next.xp - lv.xp)) * 100) : 100) + '%"></i></div>' +
          '<div class="hero-stats">' +
            stat('Questions', t.attempted + ' / ' + totalQ) +
            stat('Correct', t.correct) +
            stat('Streak', (st.streak.current || 0) + '🔥') +
            stat('Best exam', st.bestExam ? st.bestExam.pct + '%' : '—') +
          '</div>' +
        '</div>' +
        '<div class="hero-ready">' +
          '<div class="ring ' + readyClass + '" style="--p:' + readiness + '">' +
            '<span>' + readiness + '%</span><small>ready</small></div>' +
          '<button class="btn primary block" data-nav="examintro">Take practice exam →</button>' +
        '</div>' +
      '</section>' +

      '<section class="quick">' +
        quickCard('play', '▶', 'Quick Quiz', '10 random questions', 'random10') +
        quickCard('weak', '🎯', 'Weak Spots', 'Drill what you miss', 'weak') +
        quickCard('all', '🎲', 'Full Random', 'Any topic, any question', 'randomall') +
        quickCard('exam', '📝', 'Exam', CFG.exam.questions + ' Q · ' + CFG.exam.minutes + ' min · ' + CFG.passMark + '% to pass', 'examintro') +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><h2>Domains</h2></div>' +
        '<div class="domains">' +
          domainOrder().map(function (d) {
            var avg = domStats[d].n ? Math.round(domStats[d].sum / domStats[d].n) : 0;
            var w = topics.filter(function (x) { return x.domain === d; })[0];
            return '<div class="domrow ' + domClass(d) + '">' +
              '<div class="domlabel"><b>' + esc(d) + '</b><small>' + (w ? w.domain_weight : '') + '% of exam</small></div>' +
              masteryBar(avg, tierClass(avg)) +
              '<span class="dompct">' + avg + '%</span></div>';
          }).join('') +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><h2>Topics</h2><span class="muted">' + Store.masteredTopicIds().length + ' / ' + topics.length + ' mastered</span></div>' +
        '<div class="topicgrid">' +
          topics.map(function (tp) {
            var s = Store.topicStats(tp.id);
            return '<button class="topiccard ' + domClass(tp.domain) + '" data-topic="' + tp.id + '">' +
              '<div class="tc-top"><span class="tier">' + s.tier.icon + '</span>' +
                '<span class="tnum">' + String(tp.id).padStart(2, '0') + '</span></div>' +
              '<div class="tname">' + esc(tp.name) + '</div>' +
              masteryBar(s.masteryPct, s.tier.cls) +
              '<div class="tc-meta"><small>' + s.mastered + '/' + s.total + ' correct</small>' +
                '<small>' + s.masteryPct + '%</small></div>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><h2>Badges</h2><a class="link" data-nav="badges">See all →</a></div>' +
        '<div class="badgestrip">' +
          Store.BADGES.map(function (b) {
            var earned = !!st.badges[b.id];
            return '<div class="badge ' + (earned ? 'earned' : 'locked') + '" title="' + esc(b.name) + ' — ' + esc(b.desc) + '">' +
              '<span class="bicon">' + b.icon + '</span></div>';
          }).join('') +
        '</div>' +
      '</section>' +

      '<footer class="foot"><button class="btn ghost sm" id="resetbtn">Reset progress</button>' +
        '<span class="muted">' + totalQ + ' questions · SQLite + sql.js · runs offline</span></footer>';

    root.innerHTML = html;

    Array.prototype.forEach.call(root.querySelectorAll('[data-nav]'), function (n) {
      n.addEventListener('click', function () {
        var target = n.getAttribute('data-nav');
        if (target === 'random10') startQuiz({ mode: 'random', count: 10 });
        else if (target === 'randomall') startQuiz({ mode: 'random', count: 20 });
        else if (target === 'weak') startQuiz({ mode: 'weak', count: 15 });
        else go(target);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-topic]'), function (n) {
      n.addEventListener('click', function () {
        startQuiz({ mode: 'topic', topicId: parseInt(n.getAttribute('data-topic'), 10), count: 10 });
      });
    });
    var rb = document.getElementById('resetbtn');
    if (rb) rb.addEventListener('click', function () {
      if (confirm('Reset all progress, XP and badges? This cannot be undone.')) { Store.reset(); go('home'); }
    });
  }

  function stat(label, val) { return '<div class="kv"><b>' + esc(String(val)) + '</b><small>' + esc(label) + '</small></div>'; }
  function quickCard(cls, icon, title, sub, nav) {
    return '<button class="qcard ' + cls + '" data-nav="' + nav + '">' +
      '<span class="qicon">' + icon + '</span>' +
      '<span class="qtitle">' + esc(title) + '</span>' +
      '<span class="qsub">' + esc(sub) + '</span></button>';
  }
  function tierClass(pct) { return Store.masteryTier(pct === 0 ? 0 : pct).cls; }

  // ---------- quiz setup ----------
  function renderQuizSetup() {
    var topics = QuizDB.topics();
    var html =
      '<section class="setup">' +
        '<h1>Start a quiz</h1>' +
        '<div class="setup-modes">' +
          '<button class="modecard" data-mode="all">🎲 <b>All topics</b><small>Random mix across everything</small></button>' +
          '<button class="modecard" data-mode="weak">🎯 <b>Weak spots</b><small>Questions you miss or haven\'t seen</small></button>' +
        '</div>' +
        '<h2>…or pick a topic</h2>' +
        '<div class="setup-topics">' +
          topics.map(function (tp) {
            var s = Store.topicStats(tp.id);
            return '<button class="setuptopic ' + domClass(tp.domain) + '" data-topic="' + tp.id + '">' +
              '<span class="tier">' + s.tier.icon + '</span>' +
              '<span class="st-name">' + String(tp.id).padStart(2, '0') + ' · ' + esc(tp.name) + '</span>' +
              '<span class="st-dom">' + esc(tp.domain) + '</span></button>';
          }).join('') +
        '</div>' +
        '<div class="setup-count">' +
          '<label>Questions: <select id="qcount">' +
            [5, 10, 15, 20, 25, 50].map(function (n) { return '<option value="' + n + '"' + (n === 10 ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
          '</select></label>' +
          '<span class="muted">Quizzes draw from all available questions.</span>' +
        '</div>' +
      '</section>';
    root.innerHTML = html;

    function count() { return parseInt(document.getElementById('qcount').value, 10); }
    Array.prototype.forEach.call(root.querySelectorAll('[data-mode]'), function (n) {
      n.addEventListener('click', function () { startQuiz({ mode: n.getAttribute('data-mode'), count: count() }); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-topic]'), function (n) {
      n.addEventListener('click', function () { startQuiz({ mode: 'topic', topicId: parseInt(n.getAttribute('data-topic'), 10), count: count() }); });
    });
  }

  // ---------- quiz play ----------
  function startQuiz(spec) {
    var questions = QuizDB.buildQuiz(spec);
    if (!questions.length) { toast('No questions available for that selection.', 'badge'); return; }
    quiz = {
      spec: spec, questions: questions, idx: 0, correct: 0, answered: false, log: [],
      shuffled: questions.map(function (q) { return QuizDB.shuffle(q.options); }),
    };
    go('quiz');
  }

  function currentQuiz() { return quiz.questions[quiz.idx]; }

  function renderQuizQuestion() {
    var q = currentQuiz();
    var opts = quiz.shuffled[quiz.idx];
    var tp = QuizDB.topicById(q.topic_id);
    var pct = Math.round((quiz.idx / quiz.questions.length) * 100);
    var letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    var html =
      '<section class="play">' +
        '<div class="playbar">' +
          '<button class="btn ghost sm" id="quitq">✕ Exit</button>' +
          '<div class="progresswrap"><div class="pline"><i style="width:' + pct + '%"></i></div>' +
            '<span class="pmeta">Question ' + (quiz.idx + 1) + ' / ' + quiz.questions.length + '</span></div>' +
          '<div class="scorepill">✓ ' + quiz.correct + '</div>' +
        '</div>' +
        '<div class="qcard">' +
          '<div class="qtopic ' + domClass(tp.domain) + '">' + esc(tp.name) + '</div>' +
          '<div class="qstem">' + fmt(q.text) + '</div>' +
          '<div class="options">' +
            opts.map(function (o, i) {
              return '<button class="opt" data-letter="' + o.letter + '" data-i="' + i + '">' +
                '<span class="oletter">' + letters[i] + '</span>' +
                '<span class="otext">' + fmt(o.text) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div class="explain" id="explain" hidden></div>' +
          '<div class="qfoot"><button class="btn primary" id="nextq" hidden>Next →</button></div>' +
        '</div>' +
      '</section>';
    root.innerHTML = html;
    quiz.answered = false;

    document.getElementById('quitq').addEventListener('click', function () {
      if (quiz.log.length === 0 || confirm('Exit this quiz? Progress on answered questions is saved.')) finishQuiz();
    });
    Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (btn) {
      btn.addEventListener('click', function () { answerQuiz(btn.getAttribute('data-letter')); });
    });
    document.getElementById('nextq').addEventListener('click', nextQuiz);
  }

  function answerQuiz(letter) {
    if (quiz.answered) return;
    quiz.answered = true;
    var q = currentQuiz();
    var isCorrect = letter === q.correct;
    if (isCorrect) quiz.correct += 1;
    quiz.log.push({ q: q, chosen: letter, correct: isCorrect });

    var res = Store.recordAnswer(q.id, q.topic_id, isCorrect);
    announceRewards(res);

    Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (btn) {
      var l = btn.getAttribute('data-letter');
      btn.disabled = true;
      btn.classList.add('locked');
      if (l === q.correct) btn.classList.add('correct');
      if (l === letter && !isCorrect) btn.classList.add('wrong');
    });

    var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    var correctPos = quiz.shuffled[quiz.idx].map(function (o) { return o.letter; }).indexOf(q.correct);
    var stat = Store.questionStat(q.id);
    var ex = document.getElementById('explain');
    ex.innerHTML =
      '<div class="verdict ' + (isCorrect ? 'ok' : 'no') + '">' +
        (isCorrect ? '✅ Correct' + (res.firstTry ? ' — first try!' : '') : '❌ Not quite') +
        ' <span class="ans">Answer: ' + letters[correctPos] + '</span>' +
        (stat ? '<span class="seen">seen ' + stat.a + '×</span>' : '') +
      '</div>' +
      '<div class="exbody">' + fmt(q.explanation) + '</div>';
    ex.hidden = false;

    var pill = root.querySelector('.scorepill');
    if (pill) pill.textContent = '✓ ' + quiz.correct;

    var nb = document.getElementById('nextq');
    nb.hidden = false;
    nb.textContent = quiz.idx + 1 >= quiz.questions.length ? 'See results →' : 'Next →';
    nb.focus();
    renderNav();
  }

  function nextQuiz() {
    if (quiz.idx + 1 >= quiz.questions.length) { finishQuiz(); return; }
    quiz.idx += 1;
    renderQuizQuestion();
  }
  function finishQuiz() { go('quizresult'); }

  function renderQuizResult() {
    var total = quiz.log.length;
    var correct = quiz.log.filter(function (r) { return r.correct; }).length;
    var pct = total ? Math.round((correct / total) * 100) : 0;
    var msg = pct >= 90 ? 'Outstanding! 🌟' : pct >= CFG.passMark ? 'Passing pace 👍' : pct >= 50 ? 'Getting there 💪' : 'Keep drilling 🔁';
    var wrong = quiz.log.filter(function (r) { return !r.correct; });

    var html =
      '<section class="result">' +
        '<div class="result-hero ' + (pct >= CFG.passMark ? 'pass' : 'fail') + '">' +
          '<div class="rscore">' + pct + '%</div>' +
          '<div class="rmeta"><h1>' + correct + ' / ' + total + ' correct</h1><p>' + msg + '</p></div>' +
        '</div>' +
        '<div class="result-actions">' +
          '<button class="btn primary" id="again">Another quiz</button>' +
          '<button class="btn" id="reviewwrong"' + (wrong.length ? '' : ' hidden') + '>Review ' + wrong.length + ' missed</button>' +
          '<button class="btn ghost" data-nav="home">Dashboard</button>' +
        '</div>' +
        '<div class="review" id="review" hidden>' + wrong.map(function (r) { return reviewCard(r); }).join('') + '</div>' +
      '</section>';
    root.innerHTML = html;

    document.getElementById('again').addEventListener('click', function () { go('quizsetup'); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-nav]'), function (n) {
      n.addEventListener('click', function () { go(n.getAttribute('data-nav')); });
    });
    var rw = document.getElementById('reviewwrong');
    if (rw && !rw.hidden) rw.addEventListener('click', function () {
      var rv = document.getElementById('review'); rv.hidden = !rv.hidden;
      rw.textContent = rv.hidden ? 'Review ' + wrong.length + ' missed' : 'Hide review';
    });
  }

  function reviewCard(r) {
    var q = r.q;
    var tp = QuizDB.topicById(q.topic_id);
    var optText = {};
    q.options.forEach(function (o) { optText[o.letter] = o.text; });
    return '<div class="rcard">' +
      '<div class="qtopic ' + domClass(tp.domain) + '">' + esc(tp.name) + '</div>' +
      '<div class="qstem sm">' + fmt(q.text) + '</div>' +
      '<div class="rline wrong">Your answer: ' + (r.chosen ? fmt(optText[r.chosen] || '') : '<em>skipped</em>') + '</div>' +
      '<div class="rline ok">Correct: ' + fmt(optText[q.correct] || '') + '</div>' +
      '<div class="exbody">' + fmt(q.explanation) + '</div>' +
    '</div>';
  }

  // ---------- exam simulator ----------
  function examCount() { return (CFG.exam && CFG.exam.questions) || 30; }

  function renderExamIntro() {
    var st = Store.state();
    var n = examCount(), mins = CFG.exam.minutes, pass = CFG.passMark;
    var html =
      '<section class="setup examintro">' +
        '<h1>📝 Practice Exam</h1>' +
        '<p class="lead">A full ' + esc(CFG.title) + ' mock: <b>' + n + ' questions</b>, domain-weighted, <b>' + mins + ' minutes</b>. Pass mark <b>' + pass + '%</b>. No feedback until you submit — just like the real thing.</p>' +
        '<div class="exam-facts">' +
          fact('Questions', n) + fact('Time', mins + ' min') + fact('Pass', '≥ ' + pass + '%') +
          fact('Best', st.bestExam ? st.bestExam.pct + '%' : '—') +
        '</div>' +
        '<div class="exam-weights">' +
          QuizDB.topics().reduce(function (acc, t) {
            if (acc.seen[t.domain]) return acc;
            acc.seen[t.domain] = true;
            acc.html += '<span class="wchip ' + domClass(t.domain) + '">' + esc(t.domain) + ' ' + t.domain_weight + '%</span>';
            return acc;
          }, { seen: {}, html: '' }).html +
        '</div>' +
        '<button class="btn primary lg" id="startexam">Start exam →</button>' +
      '</section>';
    root.innerHTML = html;
    document.getElementById('startexam').addEventListener('click', startExam);
  }
  function fact(l, v) { return '<div class="fact"><b>' + esc(v) + '</b><small>' + esc(l) + '</small></div>'; }

  function startExam() {
    var questions = QuizDB.buildExam(examCount());
    exam = {
      questions: questions,
      shuffled: questions.map(function (q) { return QuizDB.shuffle(q.options); }),
      answers: new Array(questions.length).fill(null),
      flags: new Array(questions.length).fill(false),
      idx: 0, start: Date.now(), durationMs: CFG.exam.minutes * 60 * 1000, timer: null, done: false,
    };
    go('exam');
  }

  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function renderExam() {
    var q = exam.questions[exam.idx];
    var opts = exam.shuffled[exam.idx];
    var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    var chosen = exam.answers[exam.idx];
    var n = exam.questions.length;
    var answeredCount = exam.answers.filter(function (a) { return a !== null; }).length;

    var html =
      '<section class="play exam">' +
        '<div class="examtop">' +
          '<button class="btn ghost sm" id="quitexam">✕ End</button>' +
          '<div class="clock" id="clock">⏱ ' + fmtClock(exam.durationMs - (Date.now() - exam.start)) + '</div>' +
          '<div class="examcount">' + answeredCount + ' / ' + n + ' answered</div>' +
        '</div>' +
        '<div class="navgrid" id="navgrid">' +
          exam.questions.map(function (_, i) {
            var cls = 'ng';
            if (exam.answers[i] !== null) cls += ' done';
            if (exam.flags[i]) cls += ' flag';
            if (i === exam.idx) cls += ' cur';
            return '<button class="' + cls + '" data-jump="' + i + '">' + (i + 1) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="qcard">' +
          '<div class="qnum">Question ' + (exam.idx + 1) + ' of ' + n +
            '<button class="flagbtn ' + (exam.flags[exam.idx] ? 'on' : '') + '" id="flag">⚑ ' + (exam.flags[exam.idx] ? 'Flagged' : 'Flag') + '</button></div>' +
          '<div class="qstem">' + fmt(q.text) + '</div>' +
          '<div class="options">' +
            opts.map(function (o, i) {
              return '<button class="opt ' + (chosen === o.letter ? 'chosen' : '') + '" data-letter="' + o.letter + '">' +
                '<span class="oletter">' + letters[i] + '</span>' +
                '<span class="otext">' + fmt(o.text) + '</span></button>';
            }).join('') +
          '</div>' +
          '<div class="examnav">' +
            '<button class="btn ghost" id="prevq"' + (exam.idx === 0 ? ' disabled' : '') + '>← Prev</button>' +
            (exam.idx + 1 >= n
              ? '<button class="btn primary" id="submitexam">Submit exam</button>'
              : '<button class="btn primary" id="nextq">Next →</button>') +
          '</div>' +
        '</div>' +
        '<div class="examsubmit"><button class="btn" id="submitexam2">Submit exam now</button></div>' +
      '</section>';
    root.innerHTML = html;

    Array.prototype.forEach.call(root.querySelectorAll('.opt'), function (btn) {
      btn.addEventListener('click', function () { exam.answers[exam.idx] = btn.getAttribute('data-letter'); renderExam(); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-jump]'), function (btn) {
      btn.addEventListener('click', function () { exam.idx = parseInt(btn.getAttribute('data-jump'), 10); renderExam(); });
    });
    document.getElementById('flag').addEventListener('click', function () { exam.flags[exam.idx] = !exam.flags[exam.idx]; renderExam(); });
    var pv = document.getElementById('prevq'); if (pv) pv.addEventListener('click', function () { if (exam.idx > 0) { exam.idx--; renderExam(); } });
    var nx = document.getElementById('nextq'); if (nx) nx.addEventListener('click', function () { if (exam.idx < n - 1) { exam.idx++; renderExam(); } });
    var sb = document.getElementById('submitexam'); if (sb) sb.addEventListener('click', confirmSubmitExam);
    document.getElementById('submitexam2').addEventListener('click', confirmSubmitExam);
    document.getElementById('quitexam').addEventListener('click', function () {
      if (confirm('End the exam and discard it?')) { stopExamTimer(); exam = null; go('examintro'); }
    });

    startExamTimer();
  }

  function startExamTimer() {
    stopExamTimer();
    exam.timer = setInterval(function () {
      var left = exam.durationMs - (Date.now() - exam.start);
      var c = document.getElementById('clock');
      if (c) { c.textContent = '⏱ ' + fmtClock(left); if (left < 5 * 60 * 1000) c.classList.add('low'); }
      if (left <= 0) { stopExamTimer(); submitExam(true); }
    }, 1000);
  }
  function stopExamTimer() { if (exam && exam.timer) { clearInterval(exam.timer); exam.timer = null; } }

  function confirmSubmitExam() {
    var unanswered = exam.answers.filter(function (a) { return a === null; }).length;
    var m = unanswered ? unanswered + ' question(s) are unanswered. Submit anyway?' : 'Submit your exam for grading?';
    if (confirm(m)) submitExam(false);
  }

  function submitExam(timedOut) {
    stopExamTimer();
    exam.done = true;
    exam.timedOut = timedOut;
    var results = exam.questions.map(function (q, i) {
      var chosen = exam.answers[i];
      var correct = chosen === q.correct;
      var res = Store.recordAnswer(q.id, q.topic_id, correct);
      return { q: q, chosen: chosen, correct: correct, reward: res };
    });
    exam.results = results;
    var score = results.filter(function (r) { return r.correct; }).length;
    Store.recordExam(score, exam.questions.length);
    var allBadges = {};
    results.forEach(function (r) { (r.reward.badges || []).forEach(function (b) { allBadges[b] = true; }); });
    go('examresult');
    Object.keys(allBadges).forEach(function (id) {
      var b = badgeById(id); if (b) toast('<span class="bdg">' + b.icon + ' Badge unlocked: ' + esc(b.name) + '</span>', 'badge');
    });
  }

  function renderExamResult() {
    var results = exam.results;
    var n = results.length;
    var score = results.filter(function (r) { return r.correct; }).length;
    var pct = n ? Math.round((score / n) * 100) : 0;
    var passed = pct >= CFG.passMark;

    var dom = {};
    domainOrder().forEach(function (d) { dom[d] = { c: 0, n: 0 }; });
    results.forEach(function (r) {
      var tp = QuizDB.topicById(r.q.topic_id);
      if (dom[tp.domain]) { dom[tp.domain].n += 1; if (r.correct) dom[tp.domain].c += 1; }
    });

    var wrong = results.filter(function (r) { return !r.correct; });

    var html =
      '<section class="result">' +
        '<div class="result-hero ' + (passed ? 'pass' : 'fail') + '">' +
          '<div class="rscore">' + pct + '%</div>' +
          '<div class="rmeta"><h1>' + (passed ? '🎉 PASS' : 'Not yet') + '</h1>' +
            '<p>' + score + ' / ' + n + ' correct' + (exam.timedOut ? ' · ⏱ time expired' : '') + ' · pass mark ' + CFG.passMark + '%</p></div>' +
        '</div>' +
        '<div class="panel"><div class="panel-head"><h2>By domain</h2></div><div class="domains">' +
          domainOrder().map(function (d) {
            var p = dom[d].n ? Math.round((dom[d].c / dom[d].n) * 100) : 0;
            return '<div class="domrow ' + domClass(d) + '"><div class="domlabel"><b>' + esc(d) + '</b>' +
              '<small>' + dom[d].c + '/' + dom[d].n + '</small></div>' + masteryBar(p, tierClass(p)) +
              '<span class="dompct">' + p + '%</span></div>';
          }).join('') +
        '</div></div>' +
        '<div class="result-actions">' +
          '<button class="btn primary" id="againexam">New exam</button>' +
          '<button class="btn" id="reviewexam"' + (wrong.length ? '' : ' hidden') + '>Review ' + wrong.length + ' missed</button>' +
          '<button class="btn ghost" data-nav="home">Dashboard</button>' +
        '</div>' +
        '<div class="review" id="review" hidden>' + wrong.map(reviewCard).join('') + '</div>' +
      '</section>';
    root.innerHTML = html;

    document.getElementById('againexam').addEventListener('click', function () { exam = null; go('examintro'); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-nav]'), function (n2) { n2.addEventListener('click', function () { go(n2.getAttribute('data-nav')); }); });
    var rv = document.getElementById('reviewexam');
    if (rv && !rv.hidden) rv.addEventListener('click', function () {
      var r = document.getElementById('review'); r.hidden = !r.hidden;
      rv.textContent = r.hidden ? 'Review ' + wrong.length + ' missed' : 'Hide review';
    });
  }

  // ---------- study guides ----------
  function openGuide(topicId) { guideTopic = topicId; go('guide'); }

  function renderStudyIndex() {
    var topics = QuizDB.topics();
    if (!QuizDB.hasGuides() || !topics.some(function (t) { return QuizDB.guideFor(t.id); })) {
      root.innerHTML = '<section class="studyidx"><h1>Study guides</h1><p class="muted">No study guides were included in this app.</p></section>';
      return;
    }
    var byDomain = {};
    domainOrder().forEach(function (d) { byDomain[d] = []; });
    topics.forEach(function (t) { if (byDomain[t.domain]) byDomain[t.domain].push(t); });

    var html = '<section class="studyidx"><h1>Study guides</h1>' +
      '<p class="muted">Concept overviews for every topic. Read up, then quiz yourself.</p>';
    domainOrder().forEach(function (d) {
      if (!byDomain[d].length) return;
      html += '<div class="panel"><div class="panel-head"><h2 class="domttl ' + domClass(d) + '">' + esc(d) + '</h2>' +
        '<span class="muted">' + byDomain[d].length + ' topics</span></div><div class="studygrid">' +
        byDomain[d].map(function (tp) {
          var s = Store.topicStats(tp.id);
          return '<button class="studycard ' + domClass(tp.domain) + '" data-guide="' + tp.id + '">' +
            '<span class="sc-num">' + String(tp.id).padStart(2, '0') + '</span>' +
            '<span class="sc-name">' + esc(tp.name) + '</span>' +
            '<span class="sc-foot"><span class="tier">' + s.tier.icon + '</span>' +
            '<span class="sc-read">Read →</span></span></button>';
        }).join('') +
        '</div></div>';
    });
    html += '</section>';
    root.innerHTML = html;
    Array.prototype.forEach.call(root.querySelectorAll('[data-guide]'), function (n) {
      n.addEventListener('click', function () { openGuide(parseInt(n.getAttribute('data-guide'), 10)); });
    });
  }

  function renderGuide() {
    var tp = QuizDB.topicById(guideTopic);
    var content = QuizDB.guideFor(guideTopic);
    var topics = QuizDB.topics();
    var idx = topics.map(function (t) { return t.id; }).indexOf(guideTopic);
    var prev = idx > 0 ? topics[idx - 1] : null;
    var next = idx < topics.length - 1 ? topics[idx + 1] : null;
    var s = Store.topicStats(guideTopic);

    var html = '<section class="guidewrap">' +
      '<div class="guidebar">' +
        '<button class="btn ghost sm" id="backstudy">← All guides</button>' +
        '<button class="btn primary sm" id="quizthis">Quiz this topic →</button>' +
      '</div>' +
      '<article class="guide">' +
        '<header class="guidehead ' + domClass(tp.domain) + '">' +
          '<span class="gh-dom">' + esc(tp.domain) + ' · Topic ' + String(tp.id).padStart(2, '0') + '</span>' +
          '<h1>' + esc(tp.name) + '</h1>' +
          '<div class="gh-mastery">' + s.tier.icon + ' ' + s.tier.label + ' · ' + s.mastered + '/' + s.total + ' correct</div>' +
        '</header>' +
        (content || '<p class="muted">No study guide available for this topic.</p>') +
      '</article>' +
      '<nav class="guidenav">' +
        (prev ? '<button class="gn prev" data-guide="' + prev.id + '">← ' + esc(prev.name) + '</button>' : '<span></span>') +
        (next ? '<button class="gn next" data-guide="' + next.id + '">' + esc(next.name) + ' →</button>' : '<span></span>') +
      '</nav>' +
    '</section>';
    root.innerHTML = html;

    document.getElementById('backstudy').addEventListener('click', function () { go('study'); });
    document.getElementById('quizthis').addEventListener('click', function () { startQuiz({ mode: 'topic', topicId: guideTopic, count: 10 }); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-guide]'), function (n) {
      n.addEventListener('click', function () { openGuide(parseInt(n.getAttribute('data-guide'), 10)); });
    });
  }

  // ---------- badges ----------
  function renderBadges() {
    var st = Store.state();
    var html =
      '<section class="badgespage"><h1>Badges</h1><div class="badgegrid">' +
        Store.BADGES.map(function (b) {
          var earned = !!st.badges[b.id];
          return '<div class="bcard ' + (earned ? 'earned' : 'locked') + '">' +
            '<div class="bicon">' + b.icon + '</div>' +
            '<div class="bname">' + esc(b.name) + '</div>' +
            '<div class="bdesc">' + esc(b.desc) + '</div>' +
            (earned ? '<div class="btag">Unlocked ' + new Date(st.badges[b.id]).toLocaleDateString() + '</div>' : '<div class="btag locked">Locked</div>') +
          '</div>';
        }).join('') +
      '</div></section>';
    root.innerHTML = html;
  }

  // ---------- keyboard ----------
  function onKey(e) {
    var map = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 };
    if (view === 'quiz') {
      var k = e.key.toLowerCase();
      if (!quiz.answered && k in map) { var btns = root.querySelectorAll('.opt'); if (btns[map[k]]) btns[map[k]].click(); }
      else if (quiz.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var nb = document.getElementById('nextq'); if (nb) nb.click(); }
    } else if (view === 'exam') {
      var kk = e.key.toLowerCase();
      if (kk in map) { var b = root.querySelectorAll('.opt'); if (b[map[kk]]) b[map[kk]].click(); }
      else if (e.key === 'ArrowRight') { var n = document.getElementById('nextq'); if (n) n.click(); }
      else if (e.key === 'ArrowLeft') { var p = document.getElementById('prevq'); if (p && !p.disabled) p.click(); }
    }
  }

  // ---------- boot ----------
  function init() {
    root = document.getElementById('app');
    var loader = document.getElementById('loader');
    QuizDB.init().then(function (cfg) {
      CFG = cfg;
      applyBranding(cfg);
      loader.remove();
      document.body.classList.add('ready');
      document.addEventListener('keydown', onKey);
      go('home');
    }).catch(function (err) {
      loader.innerHTML = '<div class="err"><h2>Failed to load</h2><p>' + esc(err.message) + '</p>' +
        '<p class="muted">Rebuild the database with <code>node build/build.mjs</code>.</p></div>';
      console.error(err);
    });
  }

  window.App = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
