# DoubtBuddy

DoubtBuddy is a native JEE study companion for Physics, Chemistry and Mathematics, rebuilt independently of the old Expo app.

## Platforms

- Android: Kotlin, Jetpack Compose, Material 3, Material You dynamic colors, SQLite and Android Keystore.
- iOS: Swift, SwiftUI, native system materials, file-backed JSON and Keychain.
- No Expo, React Native or JavaScript UI runtime.

Both clients provide text and image questions, four answer styles, history, bookmarks, offline practice, spaced review and progress. The offline question bank currently has 18 curated questions. Without an API key, AI answers are clearly marked local previews, not real solutions.

## Android

Open the root directory in Android Studio with JDK 17 and Android SDK 36. Run the app configuration on Android API 26+.

Gradle 8.14.3 command:

    gradle :app:testDebugUnitTest :app:assembleDebug

Android CI: https://github.com/RoyCoding8/DoubtBuddy/actions/workflows/native-ci.yml

Emulator UI verification: https://github.com/RoyCoding8/DoubtBuddy/actions/workflows/android-emulator.yml

Successful CI runs include a debug APK artifact.

## iOS

On macOS with Xcode and XcodeGen:

    cd ios
    xcodegen generate
    open DoubtBuddy.xcodeproj

Select the DoubtBuddy simulator scheme and run. The iOS CI workflow compiles and boots the app, recording screenshots:

https://github.com/RoyCoding8/DoubtBuddy/actions/workflows/ios-ci.yml

Simulator builds cannot be installed on physical iPhones. Distribution requires separate Apple signing and release configuration.

## Gemini

In Settings on either platform, enter your personal Gemini API key. Keys are stored in Android Keystore or iOS Keychain, never committed, and sent to Google's Gemini API using HTTPS. Questions and images may be processed by Google. Usage may incur charges to the key owner. Both clients use Gemini 3.8 Flash.

This is a bring-your-own-key development architecture. A public production service with an app-managed key needs an authenticated backend, quotas, monitoring, and server-held credentials, not a shared key embedded in the app.

## Verification and project notes

    node scripts/check-pstack.mjs
    node scripts/check-native.mjs

The pstack router is pstack/skills/poteto-mode/SKILL.md. See docs/REBUILD_PLAN.md, docs/TASKS.md and docs/DECISION_TRAIL.tsv for scope, gates and evidence. All new work is on rebuild/native-from-scratch; legacy Expo stays on main.
