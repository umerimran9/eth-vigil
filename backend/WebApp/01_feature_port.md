# Task prompt — port the feature builder out of preprocessing_v2/01

Paste this into Claude Code in VS Code with the repo open. `CLAUDE.md` should
be at the repo root first, so the hard rules load automatically.

---

## Prompt

I need you to port the 61-feature pipeline out of my `preprocessing_v2/01`
notebook into `blocksoc_features/builder.py`, so the live dashboard produces
byte-identical features to the ones my models were trained on.

**Read these first, before writing anything:**
- `CLAUDE.md` — the hard rules, especially "never reimplement, move it"
- `blocksoc_features/schema.py` — the 61-feature contract
- `blocksoc_features/builder.py` — the skeleton, with five functions marked
  `PORT`
- `preprocessing_v2/01` — the source of truth

**Start by reporting, not coding.** Before you touch `builder.py`, give me:
1. Which notebook cells produce each of the 61 features. A table: feature name
   -> cell -> which of the five PORT functions it belongs in.
2. Any feature you cannot cleanly assign, and why.
3. Every place the notebook's logic depends on something a live transaction
   will not have — full-population statistics, future rows, the label column,
   anything computed across the whole dataframe at once. These are the real
   port problems and I want them listed before we start, not discovered
   halfway.

Wait for me to confirm the plan before writing code.

**Then port one function at a time**, in this order, stopping after each:

1. `build_static_features` — pure per-row arithmetic, no state
2. `build_token_features` — ERC-20 metadata, cacheable per **wallet** (verified via
   `blocksoc_features/00_port_investigation.ipynb`: all 40 features are constant within a wallet
   across every transaction, zero exceptions dataset-wide — this was originally assumed to be
   "cacheable per contract," which was wrong; see `CLAUDE.md` hard rule 6)
3. `build_rolling_features` — needs per-wallet history
4. `build_era_relative` — needs the frozen era stats snapshot
5. `apply_scaling` — already written; verify it against the notebook rather
   than rewriting it

After each one, write a check script under `tools/` that runs the notebook's
version and the ported version over the same rows and prints a per-column
diff: column name, max abs diff, whether it exceeds 1e-9. Show me the output.
Do not move to the next function until the current one is clean.

**Rules for this port specifically:**
- Move the code, don't retype it. Copy the expression exactly, including the
  bits that look redundant or wrong — the zero-division handling, the dtype
  casts, the odd `.fillna()` calls. Those are load-bearing.
- After a function is ported and verified, delete it from the notebook and
  replace it with an import from `blocksoc_features`. The notebook and the
  serving path must run the same code, not equivalent code.
- If two notebook cells look like the same logic with small differences, that
  is exactly the case to ask me about. Do not merge them.
- Do not change any numeric behaviour to "clean it up". If something looks
  like a bug, tell me — do not fix it silently.
- Keep the guardrails listed in `CLAUDE.md`.

**When all five are done**, write `tools/parity_features.py` — the stage 2
gate. It should take raw transactions, run them through
`build_features()`, and compare all 61 columns against the notebook's matrix
for the same rows. Same output style as `tools/parity_model.py`: a per-item
table, a clear PASS/FAIL, exit code 1 on failure.

Then run stage 1 and stage 2 back to back and show me both reports.
