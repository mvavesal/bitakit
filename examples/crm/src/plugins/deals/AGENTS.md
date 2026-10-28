# Deals

The sales pipeline: deals move from lead to qualified, proposal and won, or are lost.

## Public contracts

- `services/board.ts` (`deals.board`): `deals`, `status`, `error`, `add({ companyId, title,
value })` and `move(id, stage)`. Data comes from `src/app/api/deals/route.ts`.
- Event `deals.won` (`{ id, title, value }`), emitted when a deal reaches the won stage.
- Fills `companies.detail` with `ui/slots/companies.detail.tsx` (deals of the company and an
  add form).
- Actions: `deals.open` (navigation), `deals.add`, `deals.advance` and `deals.lose` (input: the
  deal's id; per-deal pending state). Their titles and visibility follow the deal's stage.

## Checks

On `/deals`, "Support renewal" is a lead. **Advance** twice moves it to Proposal, where the button
reads **Mark won**. **Mark lost** asks first and hides the deal from the board.
