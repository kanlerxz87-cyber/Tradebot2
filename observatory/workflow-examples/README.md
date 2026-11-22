# Inactive integration references

These YAML files preserve the originally tested standalone pipeline. They are **not active workflows**, and must not be copied into the root `.github/workflows/` as a competing Pages deploy.

After relocation to `observatory/`, an integration owner would need to adapt all commands and file paths to that working directory (`npm --prefix observatory …` or step `working-directory: observatory`), cache `observatory/data/snapshot.json`, and copy `observatory/dist/` into the single integrated artifact at `/observatory/`. The existing root runtime, checks, deployment permissions, navigation and scheduled collection remain owned by final integration.

`observatory/scripts/check-live.mjs` can verify an actually published `/observatory/` base URL and all topic source rows. It has not been claimed to verify this relocated module's public deployment yet.
