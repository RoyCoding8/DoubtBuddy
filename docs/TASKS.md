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

## Verification in progress and outstanding

- [ ] Android instrumented study journeys pass and screenshots are inspected.
- [x] Gemini mock HTTP request and rate-limit unit tests pass in CI. Android CI 41292245028.
- [x] Latest iOS layout screenshot inspected and its build passes. iOS CI 41291952584.
- [x] iOS native tab navigation passes XCTest on the simulator. iOS CI 41292598272.
- [ ] Data survives app process restart on both platforms, verified by real instrumentation.
- [ ] Live Gemini response verified with a consenting authorized test key and usage limits.
- [ ] Accessibility, privacy, performance and physical-device release checks.

## Production work beyond the native MVP

- [ ] Authenticated inference backend and abuse protection for app-managed keys.
- [ ] Larger, reviewed study question bank and generated practice sets / assessment.
- [ ] Full request cancellation, retries, quotas and telemetry.
- [ ] Signed Android and iOS builds, distribution and store reviews.

A compile check does not prove runtime features. Mark a box complete only with matching evidence.
