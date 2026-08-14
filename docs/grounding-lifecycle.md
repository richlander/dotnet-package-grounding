# Skill lifecycle — the playbook for create / update / delete / evaluate

> **New here?** This playbook says when to create, update, delete, or evaluate a package's skill set
> and what evidence a PR must carry. For **how we grade and ship**, read the ratified
> **[quality-card model](./quality-card-model.md)**: return + efficiency, with do-no-harm and
> ≥20% economic-win gates.

A package carries a **pull-installed skill shelf**: a small base skill named for the package plus a
handful of domain skills, installed into the consuming repo and removable. Each `SKILL.md` uses the
Agent Skills convention — YAML frontmatter with `name` plus a "use when…" `description`, then
progressive disclosure into supporting files. Names follow the rule in
[authoring principles](./authoring-principles.md#naming-derive-every-skill-name-from-the-package-id).

Core rule, inherited from the quality-card model: **a change to a skill is a claim, and a claim ships
with its evidence.** Every operation below ends in a reproducible baseline-versus-shelf eval and a
copy-paste quality card.

Worked exemplars — use these for evidence *shape*, not for file layout, which has since changed:

| Operation | Exemplar | What it shows |
| --- | --- | --- |
| **CREATE** | [markout#148](https://github.com/richlander/markout/pull/148) | A base skill plus five domain skills shipped with a CT-24 holistic eval behind it. |
| **UPDATE** | [markout#149](https://github.com/richlander/markout/issues/149) | Two independent oracles — an adopter diff and a diff against the retired doc — each found coverage gaps a passing eval could not. |

---

## 0. First question — does this package need a skill at all?

A skill records **only what the model is proven to lack**, not model-resident knowledge. Before
authoring anything, find the package's **trap**: the wrong API, deprecated entrypoint, renamed type,
or non-obvious workflow a competent agent reaches for *without* the package in front of it.

Run the **baseline arm** (no shelf installed) on the live suite. If baseline already scores well and
never resorts to **archaeology** (web/cache rummaging to recover missing knowledge), the model already
knows this package — **do not author a skill**. A skill is justified only by a measured gap.

---

## 1. CREATE — author a new shelf

1. **Source the tasks from adopters, not from the API surface.** This is the step most likely to be
   skipped, and skipping it produces a suite that cannot discriminate. Follow the working procedure in
   [`grounding-eval-methodology.md`](./grounding-eval-methodology.md#sourcing-the-tasks-adopters-not-the-api-surface):
   pick real consumers, extract their idioms weighted by frequency, diff that set against the shelf
   and the suite, and prefer tasks whose failure mode is silent.
2. **Write the shelf under `<unit>/skills/`** — the base skill at
   `skills/<unit>/SKILL.md`, each domain skill at `skills/<unit>-<domain>/SKILL.md`. Keep the base
   skill small and describe only the trap and the correct path. See
   [`authoring-principles.md`](./authoring-principles.md).
3. **Check the budget and retrieval surface.** Review `description` fields as activation controls:
   broad descriptions increase false pulls and context tax.
4. **Evaluate baseline versus shelf** at `k = 5` runs per cell across the three model classes
   (haiku, sonnet, opus), in **holistic** mode so the agent self-selects from the shelf:

   ```bash
   grounding run <unit> --source skill --eval-mode holistic --runs 5 \
     -m "claude-haiku-4.5 claude-sonnet-5 claude-opus-5"
   ```

   Suite size is per-unit — CT-24 is the 24-task ladder, but a unit may carry more (System.Text.Json
   carries 48). Never compare raw totals across units; every headline is a within-unit ratio.
5. **Read the quality cards.** Ship only if both gates clear: do-no-harm (loss mass within the
   null-calibrated threshold) and economic materiality (the Total-IET-on-`S` ratio band upper is
   `≤ ×0.80`, certifying at least a 20% aggregate cut). Keep the levelized geo-mean as the
   clean-inference companion. Duration is a co-headline, not a gate; capability unlocks are reported
   on the return axis.
6. **Fix package docs when the eval exposes a real documentation bug.** Do not evaluate package docs
   as a separate comparison condition. If the prompts or transcripts reveal missing or misleading
   public docs, fix those docs in the same PR and cite the finding.
7. **Open the PR** using `.github/PULL_REQUEST_TEMPLATE.md`. Paste the quality cards into *Metrics*,
   link this playbook and the quality-card model, and commit the eval **inputs** — the `eval.yaml`
   scenarios — so the package owns its loop.

> **Datasets are not committed.** `grounding run` writes them to `--out` (default
> `~/.cache/grounding/<unit>-6q`). What makes a card reproducible is the **provenance pin** — the
> corpus plus the doc content hash, readable with `grounding provenance` — not a checked-in blob.
> Cite the pin and the harness commit in the report; do not add a `data/` directory.

---

> **Environment hygiene (learned the hard way).** The baseline is *not* a clean ignorance control if
> the consuming repo already has the shelf installed, or if decompiler/inspector tools on the box
> (`dotnet-inspect`, ilspy, …) let baseline reconstruct the missing context. Both *understate* the
> skill's value. Run evals from a clean consuming repo with **no global decompiler/inspector tools
> installed**, and treat every delta as a **lower bound** when the baseline can self-ground.

---

## 2. UPDATE — change an existing shelf

Trigger an update when the package's API changes, the model's resident knowledge shifts, a new trap
appears, or the descriptions cause false pulls and conflicts. The operation is the same as CREATE
plus one extra question: does the changed shelf still earn its context cost?

- **Re-run the matched baseline-versus-shelf matrix** on the same suite, models, prompts, and harness
  settings.
- **Re-run the two oracles.** The adopter diff goes stale as consumers evolve, and when a package
  migrates from a single doc to a shelf, the retired doc is a second oracle: anything it taught and
  the shelf does not is a coverage regression no passing eval will reveal, because the suite was
  written against the shelf. Both were used on markout and each found gaps the other missed
  ([markout#149](https://github.com/richlander/markout/issues/149)).
- **Read both axes.** If return improves but IET worsens, the change may be a capability trade rather
  than a shippable efficiency win. If IET improves but loss mass trips do-no-harm, it does not ship.
- **Attribute before enlarging.** `grounding ablate` gives the leave-one-out marginal for each skill;
  a flat step is a free-rider and a subset outscoring its superset is interference. Adding a skill
  without checking the marginal is how a shelf grows without getting better.
- **Edit, re-eval, and open the PR with refreshed cards.** The diff in the cards *is* the
  justification.

---

## 3. DELETE — retire a skill

A skill is a liability once it is redundant (the model learned the package), wrong (the API moved),
or uneconomic (it no longer clears the material IET gate). Deletion is also a claim and needs
evidence:

- Re-run **baseline versus shelf**. If baseline now matches on return with archaeology already near
  zero, or the shelf no longer clears the economic-materiality gate, remove it.
- If the package is **retired or unsupported**, delete the shelf with a short note; no eval needed,
  but say so explicitly in the PR.
- Never silently delete: a removal PR carries the quality card showing redundancy or uneconomic cost,
  or the retirement note.

---

## 4. EVALUATE — read the cards

All operations are decided off `grounding analyze`, which emits the copy-paste quality cards. The row
legend is [`quality-card-spec.md`](./quality-card-spec.md); the ship model is the
[quality-card model](./quality-card-model.md). Read cards per model class, lead with IET, and never
collapse haiku/sonnet/opus into one pooled verdict.

Two cheaper probes exist for work in progress: `grounding smell` runs the self-selecting shelf with no
judge and reports IET, turns, archaeology, and which skills were pulled; `grounding ablate` gives the
per-skill marginals. Neither is evidence for a ship decision.

## 5. What every skill PR contains

Same artifact list and reviewer checklist as the quality-card model:

- `<unit>/skills/**/SKILL.md` plus supporting files for the base and domain skills.
- `<unit>/grounding/<unit>/eval.yaml` — the committed scenarios, linked from the PR.
- The quality cards pasted into *Metrics*, with the provenance pin and harness commit that produced
  them.
- An **Analysis** of what the shelf changes (typically eliminating the *resourcefulness* the agent
  spends to reach the **same** correct API — verify against the transcripts, not a guessed wrong-API
  story).
- **Package-doc fixes** the eval surfaced, if public docs were missing or misleading.
- Required caveats: any baseline self-grounding lower bound, and cache-state-is-not-a-variable.

---

*See also: [`quality-card-model.md`](./quality-card-model.md) (the gate + terms),
[`quality-card-spec.md`](./quality-card-spec.md) (card rows), [`harness.md`](./harness.md) (mechanics),
[`authoring-principles.md`](./authoring-principles.md) (how to write the body), and
[`delivery-and-retrieval.md`](./delivery-and-retrieval.md) (how a skill reaches the agent).*
