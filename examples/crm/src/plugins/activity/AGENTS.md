# Activity

A feed of what the other CRM plugins announce. It only listens: no other plugin imports it or
changes for it.

## Public contracts

- `services/feed.ts` (`activity.feed`): `entries` (`{ id, text, at }`, newest first, at most
  20), kept in memory for this visit.
- Listens to `companies.added`, `contacts.added` and `deals.won`.
- `ui/slots/shell.header.end.tsx`: a "N new" badge in the header that links to `/activity`.
- Action `activity.open` (navigation).

## Checks

Win a deal on `/deals` ("Mark won"): the header shows "1 new" and `/activity` lists
"Deal won: …".
