# DoubtBuddy native rebuild plan

## Goal and constraints

Build a genuinely native JEE study assistant from scratch. The original Expo implementation is product reference only. Students should be able to ask a Physics, Chemistry, or Mathematics question and get a clear, useful response, then return to saved answers. Expand to practice, revision, and progress after the core loop is reliable.

The rebuild branch is `rebuild/native-from-scratch`. The branch began with `LICENSE` only. No implementation plan was found in its tracked files or the original repository tree.

## Technical direction

Android first with Kotlin, Jetpack Compose, coroutines, and Room for local persistence. iOS follows with Swift and SwiftUI plus SwiftData or SQLite as needed. Keep domain semantics and JSON API contracts aligned, not UI code. Do not use Expo, React Native, or a JavaScript UI runtime.

Model the core domain before adding screens:

- `Subject`: physics, chemistry, mathematics.
- `DoubtDraft`: subject, question text, optional later image, optional chapter/topic.
- `SolveMode`: guided steps, hint, concept explanation, quick answer.
- `Doubt`: stable identifier, source prompt, answer, created time, source metadata.
- `SolveState`: idle, submitting, answered, failed; make mutually exclusive states explicit.

A mock offline answer adapter can verify the user journey without secrets or a deployed backend. Production inference must use a documented, authenticated API boundary. Never bundle provider API secrets in either client. Keep sensitive data in platform-protected storage and restrict telemetry.

## Delivery phases

### 0. Establish the operating system for the rebuild

Vendor the complete, SHA-pinned pstack distribution and its license. Add `AGENTS.md`, task tracking, a native architecture plan, and repeatable skill validation. Check the remote tree for every skill entry point.

### 1. Deliver a minimal Android shell

Create a standard Gradle Android app with a Compose activity, subject selector, and question entry. Use typed state and platform UI conventions. Build on CI and run on an Android emulator before claiming runtime verification.

### 2. Complete the first offline doubt flow

Ask a text question, choose a solve mode, receive a deterministic local sample answer, and preserve a local history entry. Test state transitions, input handling, persistence across relaunch, empty input, and failure recovery. No generated solution should be presented as real AI output.

### 3. Add real inference safely

Define a small request/response schema and an authenticated inference service. Handle cancellation, timeouts, quotas, retries, and error states. Test the gateway separately, including mock response and upstream failure cases. Add real provider configuration only after backend ownership is established.

### 4. Add study workflows one at a time

Add image-based questions, practice sets, grading, spaced revision, and progress analytics. Each feature requires behavior tests and an on-device journey. Reuse domain state and local storage rather than recreating orchestration layers.

### 5. Build the iOS app natively

Implement the same documented API contract and study journeys in SwiftUI. Verify on an iOS simulator and real device; do not treat Android tests as proof of iOS behavior.

## Verification contract

Before each commit, run the applicable formatter, unit tests, and compile check. For features with interactive UI, capture emulator or device proof of the user-visible state. A compile passes only the compilation gate, not usability. Record unavailable toolchains or runtime environments as NOT VERIFIED rather than marking the phase complete.

For the native first slice, success means a fresh install launches, the student selects a subject, enters a text question, selects a mode, sees a clearly labeled sample response, and can revisit it after restart. The no-Expo condition can be verified by inspecting dependency manifests and runtime entry points.

## Decision record

- 2026-11-01. Keep `main` intact. It contains the legacy Expo project. Use the nearly empty rebuild branch for all native work.
- 2026-11-01. Choose Kotlin/Compose Android first and SwiftUI second. JEE users have a natural Android-first rollout path; this remains a reversible product decision. Avoid the false equivalence of bare React Native and platform-native code.
- 2026-11-01. Sequence scaffolding, a local end-to-end question flow, then AI integration. This separates UI correctness from remote inference and reduces secret-handling risks.
- 2026-11-01. Vendor pinned pstack to Git rather than relying on an ephemeral tool installation. Load skill files on demand and replace unsupported Cursor-only mechanics with observable checks.

## Open risks

Native Android and iOS SDKs and emulators are not guaranteed in the current chat container. Remote Android CI can compile, but interactive simulator verification needs an environment capable of running the app. No implementation-specific backend plan was present in the available repository, so inference deployment requires later scope decisions.
