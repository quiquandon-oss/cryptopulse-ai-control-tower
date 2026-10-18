# governance/

Durable review and evidence records for the CryptoPulse suite. Specification:
[`docs/EVIDENCE_MODEL.md`](../docs/EVIDENCE_MODEL.md).

| File | Purpose |
|---|---|
| `ledger.json` | Review findings ledger (append-only by convention) |
| `ledger.schema.json` | JSON Schema for the ledger |
| `validate-ledger.mjs` | Validator: schema + cross-field rules R1–R9 (no dependencies) |
| `evidence.mjs` | Evidence states and release-gate aggregation |
| `tests/` | Node tests for the validator, the evidence model and the TASK-GOV-002 allow-list criteria |

```bash
node governance/validate-ledger.mjs --check-commits   # exit 0 = valid
node --test governance/tests/*.test.mjs
```

Not deployed to GitHub Pages.
