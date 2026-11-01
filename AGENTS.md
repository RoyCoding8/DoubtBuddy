# DoubtBuddy agent guide

Work on `rebuild/native-from-scratch`. Do not import Expo, React Native, or code from `main` into the new app. `main` is historical product reference only.

The pstack source is vendored at `pstack/`. Load `pstack/skills/poteto-mode/SKILL.md` first, then read only the relevant skill and principle files for the current phase. Cursor-only subagents, MCP commands, and UI controls are optional here. Replace them with available tools and explicit checks, never imaginary executions.

Before any change, read `docs/REBUILD_PLAN.md` and `docs/TASKS.md`. Use the smallest verifiable increment. Validate actual artifacts, document blocked checks, and commit completed increments to the rebuild branch. Do not force push or modify `main`.

The current technical direction is fully native Android in Kotlin/Jetpack Compose first, then SwiftUI for iOS. This excludes Expo, React Native, and shared JavaScript UI runtimes. Revisit direction only for explicit product requirements or evidence.
