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

## Camera-only question input

- [x] Replace gallery input with system camera-only capture; Android compile and unit tests passed in run 41310283465.
- [x] Verify camera intent, FileProvider URI, image preparation, and cancellation on emulator. Run 41310283489: 5 tests passed.
- [x] Inspect camera-only Material 3 question screen and rerun Android UI journeys. Screenshot captured in run 41310283489.

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
