// Shared scheduling logic, used by both the website and notify.js.
// The schedule is computed deterministically from config.json, so the
// website and the notifications always agree without storing anything.
(function (root) {
  const DAY = 86400000;
  const TZ = 'Europe/Zurich';

  // Today's calendar date in Zurich, as a UTC midnight timestamp.
  function zurichToday(now = new Date()) {
    const s = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function startUTC(cfg) {
    const [y, m, d] = cfg.startDate.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  // Week 0 starts on cfg.startDate (a Monday). Negative = before the start.
  function weekIndex(cfg, now = new Date()) {
    return Math.floor((zurichToday(now) - startUTC(cfg)) / (7 * DAY));
  }
  function weekStart(cfg, w) { return new Date(startUTC(cfg) + w * 7 * DAY); }

  function tasks(cfg) { return [...cfg.chores, ...cfg.toilets.map(t => t.name)]; }

  // Cost of giving person p chore c in week w: prefer chores they've done least,
  // and strongly avoid repeating the same chore they had recently.
  function cost(state, p, c, w) {
    const count = state.count[p][c];
    const gap = w - state.last[p][c];
    return count * 10 + (gap === 1 ? 100 : gap === 2 ? 20 : 0);
  }

  // Finds the cheapest way to give each free person one shared chore (exact search).
  function bestAssignment(state, free, chores, w) {
    const n = chores.length;
    const costs = free.map(p => chores.map(c => cost(state, p, c, w)));
    let best = Infinity, bestPerm = null;
    const perm = new Array(n), used = new Array(n).fill(false);
    (function dfs(i, sum) {
      if (sum >= best) return;
      if (i === n) { best = sum; bestPerm = perm.slice(); return; }
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        used[j] = true; perm[i] = j;
        dfs(i + 1, sum + costs[i][j]);
        used[j] = false;
      }
    })(0, 0);
    return bestPerm; // bestPerm[i] = chore index for free[i]
  }

  const caches = new WeakMap();
  // Returns an array: schedule[w] = { task: person, ... } for weeks 0..upTo.
  function buildSchedule(cfg, upTo) {
    let c = caches.get(cfg);
    if (!c) {
      const state = { count: {}, last: {} };
      for (const p of cfg.people) {
        state.count[p] = {}; state.last[p] = {};
        for (const ch of cfg.chores) { state.count[p][ch] = 0; state.last[p][ch] = -99; }
      }
      c = { state, weeks: [] };
      caches.set(cfg, c);
    }
    const { state, weeks } = c;
    for (let w = weeks.length; w <= upTo; w++) {
      const week = {};
      const busy = new Set();
      for (const t of cfg.toilets) {
        const p = t.members[w % t.members.length];
        week[t.name] = p; busy.add(p);
      }
      // Rotate the order of free people each week so ties don't always favour the same person.
      const P = cfg.people.length;
      const free = cfg.people.map((_, i) => cfg.people[(i + w) % P]).filter(p => !busy.has(p));
      if (free.length !== cfg.chores.length) {
        throw new Error(`Week ${w}: ${free.length} free people but ${cfg.chores.length} chores`);
      }
      const perm = bestAssignment(state, free, cfg.chores, w);
      free.forEach((p, i) => {
        const ch = cfg.chores[perm[i]];
        week[ch] = p;
        state.count[p][ch]++; state.last[p][ch] = w;
      });
      weeks.push(week);
    }
    return weeks;
  }

  function weekAssignments(cfg, w) {
    if (w < 0) return null;
    const week = buildSchedule(cfg, w)[w];
    return tasks(cfg).map(task => ({ task, person: week[task] }));
  }

  const api = { DAY, TZ, zurichToday, weekIndex, weekStart, tasks, buildSchedule, weekAssignments };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChoreSchedule = api;
})(this);
