

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

