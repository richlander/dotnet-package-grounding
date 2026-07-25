# Grounding lifecycle — the team playbook for create / update / delete / evaluate

> **New here?** This playbook tells teams when to create, update, delete, or evaluate package
> grounding and what evidence a PR should carry. For **how we now grade and ship**, read the
> ratified **[quality-card model](./quality-card-model.md)**: return + efficiency, with
> do-no-harm and ≥20% economic-win gates.

This is the **baseline the NuGet package-grounding v-team uses** to create, change, and retire
package grounding. A package now carries a pull-installed `SKILL.md` skill set: a small base skill
named for the package, a handful of domain skills, and a root meta-skill that orchestrates install
into the consuming repo. Each `SKILL.md` uses the Anthropic Agent Skills convention: YAML
frontmatter with `name` plus a "use when…" `description`, then progressive disclosure into
supporting files.

Core rule, inherited from the quality-card model: **a grounding change is a claim, and a claim ships
with its evidence.** Every operation below ends in a reproducible baseline-vs-grounded eval and a
copy-paste quality card.

Worked exemplars (use these as templates for evidence shape, not legacy artifact names):

| Operation | Exemplar | What it shows |
| --- | --- | --- |
| **CREATE** | [nuget-fetch#13](https://github.com/richlander/nuget-fetch/pull/13) | A new grounding unit carried a measured capability/cost claim and no material loss. |
| **EVALUATE / UPDATE** | [markout grounding eval issue](https://github.com/richlander/markout/issues) | A compact curated grounding unit was measured against baseline to prove it still earned its place. |

---

## 0. First question — does this package need grounding at all?

Grounding records **only what the model is proven to lack**, not model-resident knowledge. Before
authoring anything, find the package's **trap**: the wrong API, deprecated entrypoint, renamed type,
or non-obvious workflow a competent agent reaches for *without* the package in front of it.

Run the **baseline arm** (no grounding) on the live suite. If baseline already scores well and never
resorts to **archaeology** (web/cache rummaging to recover missing knowledge), the model already knows
this package — **do not author grounding**. Grounding is justified only by a measured gap.

---

## 1. CREATE — author new grounding

1. **Write the skill set under `grounding/<unit>/SKILL.md`.** Include the required YAML
   frontmatter (`name` and a "use when…" `description`). Keep the base skill small, split domain
   guidance into focused supporting skills/files, and describe only the trap and the correct path;
   skip anything the model already knows. See [`authoring-principles.md`](./authoring-principles.md).
2. **Check the budget and retrieval surface.** Use the repository's existing grounding validation for
   the skill files, and review descriptions as activation controls: broad descriptions increase false
   pulls and context tax.
3. **Evaluate baseline vs grounded on the 24-task CT-24 suite, `k = 5` runs each, for the three model
   classes** (haiku, sonnet, opus). The same agent attempts each task once without grounding and once
   with the installed skill set.
4. **Read the quality cards.** Ship only if both gates clear: do-no-harm (loss mass stays within the
   null-calibrated threshold) and economic materiality (the per-dollar IET cost-ratio band upper is
   `≤ ×0.80`, certifying at least a 20% cut). Duration is a co-headline, not a gate; capability
   unlocks are reported on the return axis.
5. **Fix package docs when the eval exposes a real documentation bug.** Do not evaluate package docs as a separate
   comparison condition. Instead, if the prompts or transcripts reveal missing or misleading public docs, fix those
   docs in the same PR and cite the finding.
6. **Open the PR** using `.github/PULL_REQUEST_TEMPLATE.md`. Paste the quality cards into *Metrics*,
   link this playbook and the quality-card model, and **commit the eval inputs so the package can keep
   its own loop**: the questions/prompts (the `eval.yaml` scenarios, linked from the PR) and the
   matched datasets (so the baseline can be reused via `--baseline-from` when applicable).

> **Environment hygiene (learned the hard way).** The baseline is *not* a clean ignorance control if
> the consuming repo already has the skill set installed, or if decompiler/inspector tools on the box
> (`dotnet-inspect`, ilspy, …) let baseline reconstruct the missing context. Both *understate*
> grounding's value. Run evals from a clean consuming repo with **no global decompiler/inspector tools
> installed**, and treat every delta as a **lower bound** when the baseline can self-ground.

---

## 2. UPDATE — change existing grounding

Trigger an update when the package's API changes, the model's resident knowledge shifts, a new trap
appears, or the skill descriptions cause false pulls/conflicts. The operation is the same as CREATE
plus one extra question: does the changed skill set still earn its context cost?

- **Re-run the matched baseline-vs-grounded matrix** on the same suite, models, prompts, and harness
  settings.
- **Read both axes.** If return improves but IET worsens, the change may be a capability trade rather
  than a shippable efficiency win. If IET improves but loss mass trips do-no-harm, the change does not
  ship.
- **Edit `SKILL.md` and supporting files, re-eval, and open the PR with refreshed cards.** The diff in
  the cards *is* the justification.

---

## 3. DELETE — retire grounding

Grounding is a liability once it is redundant (the model learned the package), wrong (the API moved),
or uneconomic (it no longer clears the material IET gate). Deletion is also a claim and needs
evidence:

- Re-run **baseline vs grounded**. If baseline now matches grounded on return with archaeology already
  near zero, or if grounded no longer clears the economic-materiality gate, remove the skill set.
- If the package is **retired/unsupported**, delete the grounding with a short note; no eval needed,
  but say so explicitly in the PR.
- Never silently delete: a removal PR carries the quality card showing redundancy/uneconomic cost, or
  the retirement note.

---

## 4. EVALUATE — read the cards

All operations are decided off `grounding analyze`, which emits the copy-paste quality cards. The row
legend is [`quality-card-spec.md`](./quality-card-spec.md); the ship model is the
[`quality-card model`](./quality-card-model.md). Read cards per model class, lead with IET, and never
collapse haiku/sonnet/opus into one pooled verdict.

## 5. What every grounding PR contains

Same artifact list and reviewer checklist as the quality-card model:

- `grounding/<unit>/SKILL.md` plus supporting files for the package's base/domain skills.
- Matched `k = 5` baseline-vs-grounded datasets for the 24-task CT-24 suite across haiku, sonnet, and
  opus, stored under the package's `data/` area.
- The quality cards pasted into *Metrics*, matching the committed datasets.
- An **Analysis** of what grounding changes (typically eliminating the *resourcefulness* the agent
  spends to reach the **same** correct API — verify against the transcripts, not a guessed wrong-API
  story).
- **The eval inputs, so the package owns its loop going forward**: the questions/prompts (the
  `eval.yaml` scenarios) committed and **linked from the PR**, plus the matched datasets (for
  `--baseline-from` reuse when applicable).
- **Package-doc fixes** the eval surfaced, if public docs were missing or misleading.
- Required caveats: any baseline self-grounding lower bound, and cache-state-is-not-a-variable.

---

*See also: [`quality-card-model.md`](./quality-card-model.md) (the gate + terms),
[`quality-card-spec.md`](./quality-card-spec.md) (card rows), [`harness.md`](./harness.md) (mechanics),
[`authoring-principles.md`](./authoring-principles.md) (how to write the body), and
[`delivery-and-retrieval.md`](./delivery-and-retrieval.md) (how grounding reaches the agent).*
