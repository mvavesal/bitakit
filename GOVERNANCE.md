# Governance

BitaKit is maintained by [Majid Vesal](https://github.com/mvavesal), who makes the final
decisions on direction, APIs and releases. This document describes how decisions are made and
how others can take on more responsibility as the project grows.

## Roles

| Role            | Who                                                       | Can                                                  |
| --------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| **Contributor** | Anyone who opens an issue, a discussion or a pull request | Propose changes and review others' work              |
| **Maintainer**  | Listed below                                              | Triage, review and merge pull requests; cut releases |
| **Lead**        | The project's founder                                     | Make the final call where maintainers disagree       |

Current maintainers: [@mvavesal](https://github.com/mvavesal).

## How decisions are made

- **Fixes, docs and small improvements:** a maintainer reviews and merges the pull request.
- **Changes to a public API or the architecture:** start with an issue using the _Proposal_
  template. The discussion stays open long enough for feedback; a maintainer records the
  decision in the issue before work begins. Breaking changes are made only in a new release
  line.
- **When people disagree:** maintainers look for consensus first; if none is reached, the lead
  decides and explains why.

The design rule behind every decision is in the root [AGENTS.md](AGENTS.md): a developer or an
agent should be able to add a feature by changing only their own feature folder.

## Becoming a maintainer

Contributors who have made sustained, high-quality contributions, reviewed others' work and
followed the [code of conduct](CODE_OF_CONDUCT.md) may be invited to become maintainers. You
can also ask. A maintainer who is inactive for a long period may step back to contributor and
return at any time.

## Changes to this document

Changes to governance are proposed in a pull request and need the lead's approval.
