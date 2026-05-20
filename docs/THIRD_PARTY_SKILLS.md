# Third-Party Skills and External References

This document records external skill projects that SCALE may learn from, recommend, or integrate with. It is a governance boundary, not a vendoring manifest. The complete cross-repo inventory is maintained in [External Reference Inventory](EXTERNAL_REFERENCES.md).

## Policy

- Do not vendor third-party skill code, images, logos, examples, or marketing copy unless the license review explicitly allows redistribution.
- Preserve upstream license text, copyright notices, NOTICE files, source URL, and source revision before any vendored or modified redistribution.
- Mark modified files and document what changed from upstream.
- Treat optional external services as review-required until privacy, retention, credential, and delete boundaries are reviewed.
- `scale skill doctor --supply-chain` must include license, attribution, script, and pinned-revision checks for third-party skills.
- Community skills start as `review-required`; promotion requires real installation evidence and a recorded safety decision.

## Highlighted External References

| Project | License | Upstream | SCALE usage | Redistribution status |
| --- | --- | --- | --- | --- |
| Planning with Files | MIT | [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) | Adapt concepts for file-backed plans, findings, progress logs, active-plan routing, and plan attestation. | Not vendored. |
| agentmemory | Apache-2.0 | [rohitg00/agentmemory](https://github.com/rohitg00/agentmemory) | Optional external memory provider via REST or MCP for teams that need cross-agent persistent memory beyond local SCALE Memory Brain. | Not vendored. |
| GBrain | MIT | [garrytan/gbrain](https://github.com/garrytan/gbrain) | Optional graph memory provider for brain repos, hybrid search, entity relationships, MCP, and background maintenance. | Not vendored. |

Other referenced skills, MCP servers, CLIs, discovery candidates, and adapter targets are listed in [External Reference Inventory](EXTERNAL_REFERENCES.md). Unknown licenses stay `review-required`; do not treat a repository link as redistribution permission.

## Acknowledgements

SCALE acknowledges these upstream projects and contributors:

- `OthmanAdi/planning-with-files`, Copyright (c) 2026 Ahmad Adi.
- `rohitg00/agentmemory` and its upstream contributors.
- `garrytan/gbrain` and its upstream contributors.
- All upstream projects listed in [External Reference Inventory](EXTERNAL_REFERENCES.md) according to their licenses and contribution histories.

The current SCALE implementation records these projects as external references or adapted concepts. It does not copy their source code into this repository.

## Vendoring Checklist

If SCALE later vendors or modifies any third-party skill, the change must include:

1. Full upstream license text in the distributed package.
2. Upstream copyright and NOTICE material.
3. Source repository URL and pinned revision.
4. Modification notes for every copied or changed file.
5. Tests or doctor checks proving the attribution metadata is present.
6. README and generated skill repository documentation updates.

## Runtime Boundaries

External memory providers must not be enabled silently. Before use, record:

- provider endpoint and health check evidence
- project data scope
- credential boundary
- retention and deletion policy
- whether data leaves the local machine or team-controlled infrastructure
- whether provider writes are disabled, candidate-only, or explicitly enabled

External planning skills must not replace SCALE task evidence. They can improve the plan artifact shape, but final delivery still requires verification output, changed-file evidence, and explicit unverified-risk notes.
