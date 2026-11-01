# DoubtBuddy

Native JEE study companion, rebuilt from scratch.

- Android: Kotlin, Jetpack Compose, Google Material 3.
- iOS: Swift and SwiftUI (planned).
- No Expo, React Native, or JavaScript UI runtime.

The active rebuild is on \`rebuild/native-from-scratch\`. See \`docs/REBUILD_PLAN.md\` and \`docs/TASKS.md\`.

## Android

Open the repository in Android Studio, select the \`app\` run configuration, and run on an Android emulator or device (API 26+).

CI compiles the native Android APK and runs JVM unit tests using JDK 17, Android SDK 36, and Gradle 8.14.3. Each successful Android CI run contains a downloadable debug APK artifact.

The pstack skills are installed under \`pstack/skills\`. Use \`pstack/skills/poteto-mode/SKILL.md\` as the router.
