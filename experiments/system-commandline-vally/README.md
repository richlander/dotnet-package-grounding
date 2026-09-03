# System.CommandLine Vally evaluation

This experiment evaluates the production System.CommandLine skill shelf with upstream Vally while
preserving the repository's deterministic grounding methodology.

It is the first consumer of the GPT-5.6 matrix tracked by
[#82](https://github.com/richlander/dotnet-package-skills/issues/82):

- `gpt-5.6-luna` — mini/economical;
- `gpt-5.6-terra` — balanced; and
- `gpt-5.6-sol` — frontier.

Each model is a separate Vally experiment with its own eval, exact grader manifest, baseline,
grounded arm, provenance, task card, and natural-activation skill cards. The matrix index links
those model-specific results and deliberately computes no pooled metrics.

## Pinned candidate

- Skills and CT-24 source: `richlander/dotnet-package-skills` at
  `bac0194ab5f0f4ef414ec21a06ad1e1ba7665200`
- System.CommandLine: `3.0.0-preview.7.26381.103`
- .NET SDK: `10.0.300`
- Vally: `0.13.0`, source commit
  `f7a653272642d52b2b6375bfa3995dddc72fcd49`
- Copilot SDK/CLI execution closure: `1.0.9` / `1.0.79`
- Runs: `k=5` per task and arm
- Agent reasoning effort: `high` for Luna, Terra, and Sol
- Non-authoritative judge pin: `gpt-5.6-sol`, `high`

`pins.json` also contains the package, source-eval, fixture, shelf, applicability, generated-eval,
and grader-manifest hashes.

## Outcome ladder

The source CT-24 suite predates explicit tier fields. Its deterministic assertions translate by
evidence type:

- `satisfies/*` — the project builds and every requested user-visible execution path behaves as
  requested;
- `delivers/*` — the implementation uses the required System.CommandLine API path and avoids
  disallowed manual or removed-API shapes.

Concretely, non-`grep` command assertions are `satisfies/*`; `grep` and `file_not_contains`
assertions are `delivers/*`. This is the eval protocol's ends-versus-means distinction.

Classification is reconstructed from named grader results:

- any failed `satisfies/*` grader → `Fails`;
- all satisfies pass and any `delivers/*` grader fails → `Satisfies`;
- all satisfies and delivers pass → `Delivers`.

Only deterministic `completed`, `run-command`, and `file-not-contains` graders are admitted.

## Commands

From this directory:

```bash
npm ci
npm test
npm run lint
npm run controls
npm run smoke
npm run run
```

Resume an incomplete matrix without rerunning completed model children:

```bash
node scripts/run-matrix.mjs --resume results/<matrix-run-id>
```

`npm run pin` is an explicit maintenance command that prints regenerated hashes and exits 2. Normal
bootstrap is fail-closed and rejects any drift.

The smoke runs C01, C13, and C20 once per arm on all three models. It verifies model identity,
reasoning compatibility, execution completion, token/cache/duration telemetry, grounded activation
telemetry, exact graders, and adapter compatibility before the 720-session full matrix.

## Output

Full results are ignored under:

```text
results/<matrix-run-id>/
  matrix-manifest.json
  index.md
  cards/
    gpt-5.6-luna.task-card.md
    gpt-5.6-luna.skill-cards.md
    ...
  gpt-5.6-luna/run/{baseline,grounded}/results.jsonl
  gpt-5.6-terra/run/{baseline,grounded}/results.jsonl
  gpt-5.6-sol/run/{baseline,grounded}/results.jsonl
```

Every child must contain exactly 120 baseline and 120 grounded trials with one exact model,
contiguous trial identities, the complete task set, successful execution, valid telemetry, exact
experiment provenance, and every required named grader exactly once.

If a child contains an execution or harness-completion failure, repair is model-local and
non-selective: every trial for the complete `(model, task, arm)` group is rerun. Individual outcomes
are never selected or replaced. The original attempt, repair attempts, canonical results, and their
hashes remain attested under the matrix directory.

## Isolation

Each model receives a separate disposable home and NuGet cache. The exact package is restored from a
one-package local feed, then its README, XML documentation, package archive, repository metadata,
and NuGet sources are removed. The package cache becomes read-only before agent execution.

The local Vally backend remains process and filesystem isolation rather than a security sandbox.
Certification therefore requires a disposable runner with no unrelated secrets. The short-lived
Copilot transport token is necessarily visible to local agent tool subprocesses.

## Applicability and skill cards

`applicability.system-commandline-ct24.json` pre-registers the expected task set for the base skill
and five workflow skills. Skill cards use natural full-shelf activation; no skill is forced onto
all 24 tasks.

Each model produces:

1. a 24-row task card;
2. an all-task shelf reference card; and
3. six skill cards covering retrieval, coverage, reliability, fidelity, do no harm, and efficiency.

The cards are interpreted separately per model. Anthropic-era results remain frozen historical
evidence and are not pooled or trended with this matrix.
