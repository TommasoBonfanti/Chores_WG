// Sends chore notifications to ntfy. Run by GitHub Actions.
//   node notify.js assign    Monday 07:50  - this week's tasks (+ last week's open ones)
//   node notify.js karton    Tuesday 18:50 - cardboard reminder, naming the recycling person
//   node notify.js paper     Thursday 18:50 - paper reminder, naming the recycling person
//   node notify.js reminder  Saturday 09:50 - who hasn't ticked off their task yet
//   node notify.js auto "<cron>"  pick the mode from the cron that fired (used by GitHub Actions)
// Add --dry-run to print instead of sending.
const fs = require('fs');
const S = require('./schedule.js');

const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const args = process.argv.slice(2).filter(a => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');

// Local Zurich time each automatic message should go out (weekday as cron number).
const PLAN = {
  1: { mode: 'assign', hour: 7 },
  2: { mode: 'karton', hour: 18 },
  4: { mode: 'paper', hour: 18 },
  6: { mode: 'reminder', hour: 9 }
};

// Zurich UTC offset in hours right now (1 in winter, 2 in summer).
function zurichOffset(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: S.TZ, timeZoneName: 'shortOffset' })
    .formatToParts(now).find(p => p.type === 'timeZoneName').value; // e.g. "GMT+2"
  return Number(name.replace('GMT', '') || 0);
}

// GitHub cron runs in UTC, so each message has a winter and a summer cron.
// Only the one matching Zurich's current offset actually sends.
function modeFromCron(cron) {
  const [, hour, , , dow] = cron.trim().split(/\s+/);
  const plan = PLAN[Number(dow)];
  if (!plan) throw new Error(`No plan for cron "${cron}"`);
  if (Number(hour) + zurichOffset() !== plan.hour) return null;
  return plan.mode;
}

async function send(title, message, tags) {
  if (dryRun) { console.log(`--- [${title}] (${tags})\n${message}\n`); return; }
  const res = await fetch(`https://ntfy.sh/${cfg.ntfyTopic}`, {
    method: 'POST',
    body: message,
    headers: { Title: title, Tags: tags, Click: cfg.siteUrl }
  });
  if (!res.ok) throw new Error(`ntfy responded ${res.status}: ${await res.text()}`);
  console.log('Sent:', title);
}

async function doneTasks(week) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return null;
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/completions?week=eq.${week}&select=chore`,
    { headers: { apikey: cfg.supabaseKey } });
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
  return new Set((await res.json()).map(r => r.chore));
}

const line = a => `${a.person}: ${a.task}`;

async function run(mode) {
  const week = S.weekIndex(cfg);
  if (week < 0) { console.log(`Rotation starts ${cfg.startDate}; nothing to send yet.`); return; }
  const list = S.weekAssignments(cfg, week);
  const recycler = list.find(a => a.task === cfg.recyclingTask).person;

  if (mode === 'assign') {
    let msg = list.map(line).join('\n');
    if (week > 0) {
      const done = await doneTasks(week - 1);
      if (done) {
        const open = S.weekAssignments(cfg, week - 1).filter(a => !done.has(a.task));
        if (open.length) msg += `\n\nLast week still open (tick off by 12:00 today):\n` + open.map(line).join('\n');
      }
    }
    const start = S.weekStart(cfg, week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return send(`Chores for the week of ${start}`, msg, 'broom');
  }

  if (mode === 'karton') {
    return send('Cardboard out tonight', `${recycler}, please take the cardboard (Karton) out tonight.`, 'package');
  }

  if (mode === 'paper') {
    return send('Paper out tonight', `${recycler}, please take the paper (Papier) out tonight.`, 'newspaper');
  }

  if (mode === 'reminder') {
    const done = await doneTasks(week);
    if (!done) { console.log('Supabase not configured; skipping reminder.'); return; }
    const open = list.filter(a => !done.has(a.task));
    if (!open.length) return send('All chores done this week!', 'Nice work, everyone.', 'tada');
    return send(`${open.length} chore${open.length > 1 ? 's' : ''} not done yet`,
      `Deadline is Monday morning:\n` + open.map(line).join('\n'), 'hourglass');
  }

  throw new Error(`Unknown mode: ${mode}`);
}

(async () => {
  let mode = args[0] || 'assign';
  if (mode === 'auto') {
    mode = modeFromCron(args[1] || '');
    if (!mode) { console.log(`Skipping "${args[1]}": it's the other daylight-saving slot.`); return; }
  }
  await run(mode);
})().catch(e => { console.error(e); process.exit(1); });
