# Rebuild task list

## Built and compiled

- [x] Inspect rebuild branch and preserve legacy Expo on main.
- [x] Vendor pinned pstack and verify all 58 skill entry points in CI.
- [x] Create native Android Kotlin / Jetpack Compose / Material 3 app and compile in CI.
- [x] Create native iOS SwiftUI app, compile and launch it on iOS simulator.
- [x] Add text and image questions, four answer modes, and clearly labeled offline preview.
- [x] Add bring-your-own-key Gemini 3.8 Flash inference with secure key storage.
- [x] Add local history, bookmarks, 18-question offline practice, spaced review and progress on both platforms.
- [x] Add JVM unit tests, CI-produced Android APK and iOS simulator app.
- [x] Commit official Gradle 8.14.3 wrapper for reproducible Android builds.
- [x] Add Android instrumented test workflow and iOS simulator screenshot capture.

## Camera and gallery question input

- [x] Implement system camera capture without a broad photo-library permission. Initial compile and unit tests passed in run 41310283465.
- [x] Verify camera intent, FileProvider URI, image preparation, and cancellation on emulator. Run 41310283489: 5 tests passed.
- [x] Inspect camera-only Material 3 question screen and rerun Android UI journeys. Screenshot captured in run 41310283489.
- [x] Add Android system photo picker for gallery images alongside camera capture. Bound temporary URI import to 30 MB and reuse JPEG preparation without requesting storage permission. Android CI 41390376001 passed.
- [x] Verify gallery picker selection, image-only offline question, and imported JPEG on Android emulator. Run 41390376084 passed 8/8 instrumented tests and the full app restart check.
- [x] Confirm iOS already supports gallery image selection through PhotosPicker in ios/DoubtBuddy/AskView.swift. The later iOS UI refactor and simulator tests passed in run 41422860264.

## Native modules and solve lifecycle verification

- [x] Split Android Compose screens into Ask, Practice/Review, Progress/Saved, Settings and shared components. Android CI 41420363749 and emulator 41420363855 passed after the mechanical split.
- [x] Split iOS SwiftUI screens into the corresponding feature files and shared components. iOS simulator run 41421818137 passed.
- [x] Use pstack statechart and TLC to check stale solve answers and failures. The corrected legacy model reproduced both errors, and the new bounded model passed all five invariants in formal run 41421667693.
- [x] Reject stale Android results when a question, subject, answer style or photo changes. Android CI 41421745116 and emulator 41421745127 passed 9/9 instrumented tests, including saved-history process restart.
- [x] Reject stale iOS results using Task cancellation and solve generations. Simulator CI 41422860264 passed 3/3 UI tests, including editing an answered question and restart persistence.
- [x] Publish native module responsibilities, replay steps and formal-model scope in docs/ARCHITECTURE.md.
- [ ] Verify canceled live provider calls, photo preparation races, concurrent disk writes and crash recovery outside the bounded formal model. Measure image memory and app responsiveness before claiming performance gains.

## Verification in progress and outstanding

- [x] Android instrumented study journeys pass and native screenshot inspected. Workflows 41293011178 and 41294583367.
- [x] Light-mode Android system-bar contrast verified visually after foreground screenshot capture. Workflow 41294583367.
- [x] Gemini mock HTTP request and rate-limit unit tests pass in CI. Android CI 41292245028.
- [x] Latest iOS layout screenshot inspected and its build passes. iOS CI 41291952584.
- [x] iOS native tab navigation passes XCTest on the simulator. iOS CI 41292598272.
- [x] iOS offline answer survives app termination and relaunch. XCTest workflow 41293790329.
- [x] Android saved answer survives database close and reopen. Instrumented workflow 41293658080.
- [x] Android history survives full app process termination and relaunch. Emulator run 41361965543, saved-screen XML and screenshot, with 6/6 instrumented tests passing.
- [ ] Live Gemini response verified with a consenting authorized test key and usage limits.
- [x] Android practice choices expose radio-button selection semantics. Emulator run 41361965543 validated selection and re-selection with Compose UI tests.
- [ ] Remaining accessibility audit, privacy, performance and physical-device release checks.

## Production work beyond the native MVP

- [ ] Authenticated inference backend and abuse protection for app-managed keys.
- [ ] Larger, reviewed study question bank and generated practice sets / assessment.
- [ ] Full request cancellation, retries, quotas and telemetry.
- [ ] Signed Android and iOS builds, distribution and store reviews.

A compile check does not prove runtime features. Mark a box complete only with matching evidence.
