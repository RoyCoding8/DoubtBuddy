# Native architecture and formal verification

DoubtBuddy has separate native Android and iOS projects. Shared behavior is documented in the domain and TLA+ model; neither app imports the other platform's UI or uses a shared JavaScript runtime.

## Android ownership

| Module | Responsibility |
| --- | --- |
| `MainActivity.kt` | Native navigation and application shell |
| `ui/AskScreen.kt` | Question draft, camera and gallery input, answer presentation |
| `ui/PhotoInputSession.kt` | Current photo request ticket and result state |
| `ui/PracticeAndReviewScreens.kt` | Practice selection, grading and due review |
| `ui/ProgressAndHistoryScreens.kt` | Progress and saved-answer views |
| `ui/SettingsScreen.kt` | Bring-your-own-key settings |
| `ui/StudyComponents.kt` | Shared, presentational Compose components |
| `StudyViewModel.kt` | Solve requests and app storage updates |
| `domain/SolveLifecycle.kt` | Request identity and safe result transitions |
| `domain/Models.kt` | Subject, question and solve-state types |
| `data/` | SQLite, encrypted API key, image input and HTTP transport |

The UI publishes an edit through `clearAnswer()`. The view model cancels the previous solve job and invalidates its request ID. The lifecycle only accepts a result when its request ID is still active. These checks guard against providers that return even after cancellation.

## iOS ownership

| Module | Responsibility |
| --- | --- |
| `RootView.swift` | Native tab navigation and settings presentation |
| `StudyComponents.swift` | Shared presentational SwiftUI components |
| `AskView.swift` | Draft editing, Photos picker and answer presentation |
| `PracticeReviewViews.swift` | Practice and spaced review |
| `ProgressSavedSettingsViews.swift` | Progress, history and settings |
| `StudyStore.swift` | Keychain, API transport, file persistence and solve lifecycle |
| `Models.swift` | Native domain types and question bank |

On iOS, a generation counter and Task cancellation implement the same stale-result rejection rule as Android. The store checks the generation before publishing a result or error. The platforms retain separate persistence formats and UI code.

## TLA+ statechart checks

`formal/SolveLifecycle.tla` models a question draft, two request identities, pending completions, visible answers, visible errors and requests saved to history. It defines two transition systems. `LegacySpec` preserves the prior edit-while-loading behavior, and `Spec` invalidates the previous request when the student changes the draft.

Run the pinned pstack statechart checker and compare the legacy counterexample with the corrected model:

```sh
bash scripts/verify-solve-statechart.sh
```

The script uses the vendored `pstack/skills/statechart` tool, TLC 1.7.4 with a verified SHA-256 checksum, and Node 24. GitHub Actions runs it through `.github/workflows/solve-statechart.yml`. The workflow stores the Mermaid chart and rule report in the `solve-statechart` artifact.

The legacy model fails `NoStaleAnswer` and `NoStaleFailure` after three transitions: start a request, change the question while it is loading, then receive its answer or error. With request invalidation, TLC checked **182 states and 434 transitions** and all five rules held in [run 41421667693](https://github.com/RoyCoding8/DoubtBuddy/actions/runs/41421667693).

The model verifies safety only for two requests and two question values. It abstracts away HTTP, disk-write timing, app destruction, provider behavior and crash recovery. The Android Compose UI tests and iOS XCTest journeys check the real apps separately. No latency or memory improvement has been benchmarked.

## Verification

Android tests and emulator journeys run in `.github/workflows/native-ci.yml` and `.github/workflows/android-emulator.yml`. iOS builds, simulator launch and XCTest journeys run in `.github/workflows/ios-ci.yml`.

`scripts/check-native.mjs` checks the required native module entry points. It is not a replacement for compiling and running the applications.

## Additional statecharts

The November 3 audit adds bounded models for photo selection, review reveal, and Keychain replacement. The scripts and exact limitations are listed in [AUDIT_2026-11-03.md](AUDIT_2026-11-03.md).
