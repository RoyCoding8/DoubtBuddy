import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "app/build.gradle.kts",
  "app/src/main/AndroidManifest.xml",
  "app/src/main/java/dev/doubtbuddy/MainActivity.kt",
  "app/src/main/java/dev/doubtbuddy/data/StudyDatabase.kt",
  "app/src/main/java/dev/doubtbuddy/data/GeminiClient.kt",
  "app/src/main/java/dev/doubtbuddy/data/CameraCapture.kt",
  "app/src/main/res/xml/camera_paths.xml",
  "ios/project.yml",
  "ios/DoubtBuddy/DoubtBuddyApp.swift",
  "ios/DoubtBuddy/StudyStore.swift",
  "ios/DoubtBuddy/RootView.swift",
  "pstack/skills/poteto-mode/SKILL.md"
];

for (const path of required) {
  if (!existsSync(join(root, path))) throw new Error("Missing native project file: " + path);
}

const manifest = readFileSync(join(root, "app/build.gradle.kts"), "utf8");
const settings = readFileSync(join(root, "settings.gradle.kts"), "utf8");
const swift = readFileSync(join(root, "ios/DoubtBuddy/DoubtBuddyApp.swift"), "utf8");
const compose = readFileSync(join(root, "app/src/main/java/dev/doubtbuddy/MainActivity.kt"), "utf8");

if (/(expo|react-native)/i.test(manifest + settings)) {
  throw new Error("JavaScript mobile runtime in native project");
}
if (!manifest.includes('id("com.android.application")') || !manifest.includes("material3")) {
  throw new Error("Missing native Android Material 3 dependencies");
}
if (!swift.includes("import SwiftUI") || !compose.includes("import androidx.compose")) {
  throw new Error("Native UI entry points missing");
}
const androidQuestionUI = readFileSync(
  join(root, "app/src/main/java/dev/doubtbuddy/ui/AskScreen.kt"), "utf8"
);
if (!androidQuestionUI.includes("ActivityResultContracts.TakePicture()") ||
    !androidQuestionUI.includes("ActivityResultContracts.PickVisualMedia()") ||
    !androidQuestionUI.includes("PickVisualMedia.ImageOnly")) {
  throw new Error("Android question photos must support both camera capture and an image-only system picker");
}
const androidManifest = readFileSync(join(root, "app/src/main/AndroidManifest.xml"), "utf8");
if (/android.permission.READ_(EXTERNAL_STORAGE|MEDIA_IMAGES)/.test(androidManifest)) {
  throw new Error("Gallery selection must not require broad photo library permission");
}
console.log("Verified native Android/iOS apps and camera plus permission-free gallery input");
