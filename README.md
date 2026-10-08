# Apartment Chores: setup (about 20 minutes)

Files:
- `index.html`: the website. It has three tabs: This week, Schedule (one year ahead) and Leaderboard.
- `schedule.js`: the rotation logic, shared by the website and the notifications
- `config.json`: names, chores, toilet groups and settings
- `notify.js`: sends the ntfy notifications
- `.github/workflows/chores.yml`: runs `notify.js` on schedule

## How the rotation works
- Every week, each of the 11 people gets exactly one task.
- Each toilet group sends one person to clean its toilet, taking turns within the group. Toilet 1 has 3 people, so they're up every 3 weeks. Toilets 2 and 3 have 4 people, so they're up every 4 weeks.
- The other 8 people are assigned the 8 shared chores. The assignment balances how often each person has done each chore and never gives anyone the same chore two weeks in a row.
- The schedule is calculated from `config.json` and `startDate`, so the website and the notifications always match. **If you change the people, chores or toilet groups later, the rotation is recalculated from the beginning.** Past check-offs are kept, but upcoming assignments will shift.

## Notifications (Zurich time, sent to everyone on one ntfy topic)
| When | What |
|---|---|
| Monday ~07:50 | This week's tasks, plus last week's open tasks (which can still be ticked off until 12:00) |
| Tuesday ~18:50 | "[name], take the cardboard (Karton) out tonight" |
| Thursday ~18:50 | "[name], take the paper (Papier) out tonight" |
| Saturday ~09:50 | Everyone who hasn't ticked off their task yet |

GitHub sometimes delays scheduled runs by 5–20 minutes. Summer and winter time are handled automatically.

## 1. Edit `config.json`
- `ntfyTopic`: choose something hard to guess, for example `wg-zurich-chores-k8f2q9x`. Anyone who knows the topic name can read it and post to it.
- `startDate`: the Monday when week 1 begins (currently 12 Oct 2026). Don't change it once people start ticking off tasks.

## 2. Supabase (stores check-offs and the leaderboard, free)
1. Sign up at supabase.com and create a project. Choose the Zurich or Frankfurt region if it's offered.
2. Open **SQL Editor**, paste the following, and click **Run**:

```sql
create table completions (
  week int not null,
  chore text not null,
  person text not null,
  done_at timestamptz not null default now(),
  primary key (week, chore)
);
alter table completions enable row level security;
create policy "anyone can read"   on completions for select using (true);
create policy "anyone can add"    on completions for insert with check (true);
create policy "anyone can remove" on completions for delete using (true);
```

3. In **Project Settings → API**, copy the **Project URL** into `supabaseUrl` and the **publishable** key (called the "anon public" key in older projects) into `supabaseKey`. Never use the secret or service_role key.

Free Supabase projects pause after about a week without activity. The Monday and Saturday notifications read the database, which keeps the project awake.

## 3. GitHub Pages
1. Create a **public** repo named `chores` on github.com.
2. Upload everything in the zip, keeping `.github/workflows/chores.yml` in that folder.
3. Go to **Settings → Pages**, select **Deploy from a branch**, choose `main` / root, and click **Save**.
4. The site will be live at `https://YOUR-USERNAME.github.io/chores/`. Put this URL in `siteUrl` in `config.json` so that tapping a notification opens the site.

## 4. Test it
- Everyone installs **ntfy** (iOS or Android) and subscribes to the topic. The topic name is also shown at the bottom of the site.
- In the repo, go to **Actions → Chore notifications → Run workflow** and enter `assign`, `karton`, `paper` or `reminder`.

**Heads-up:** GitHub switches off scheduled workflows in a repo that has had no commits for 60 days. It emails a warning first. If it happens, click **Enable workflow** in the Actions tab, or make any small commit.

## Notes
- Each person picks their name under "I am" once. The site remembers it on that phone, highlights their task, and shows their personal schedule.
- Anyone with the link can tick off tasks. Keep the link within the apartment.
- On the leaderboard, "done" counts ticked-off tasks. "Missed" counts finished weeks where the task was never ticked off.
