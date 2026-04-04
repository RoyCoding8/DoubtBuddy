# DoubtBuddy (JEE AI Study App)

Mobile-first React Native (Expo) app for JEE preparation with AI-assisted doubt solving, practice mode, revision scheduler, and progress analytics.

## Highlights

- AI doubt solving with provider orchestration (Gemini-first, fallback-ready)
- Practice mode with configurable set sizes and grading flows
- Revision mode with spaced-repetition scheduling
- Progress dashboard with weak-topic drill-down
- Offline queue for text solve replay

## Tech Stack

- Expo SDK 55 / React Native 0.83
- TypeScript
- AsyncStorage + SecureStore
- React Navigation

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI via `npx`

### Install

```bash
npm install
```

### Run

```bash
npm run start
```

Then open on device/emulator using Expo Go (or development build).

## Quality Checks

```bash
npm run typecheck
npm run test:practice
npm run test:offline-queue
```

Additional test scripts are available in `package.json`.

## App Icon

Replace icon assets under `assets/`:

- `assets/icon.png`
- optional Android adaptive icon assets if you use split foreground/background

Then run Expo with cache clear:

```bash
npx expo start -c
```

## CI/CD (GitHub Actions)

This repo includes:

- `ci.yml` for typecheck + test suite on push/PR
- `expo-deploy.yml` for optional EAS Update publish on manual trigger

For deploy workflow, configure repository secrets before use:

- `EXPO_TOKEN`

Deployment workflow is manual (`workflow_dispatch`) so no credentials are exposed in code.

## License

Apache License 2.0 (you said you’ll add LICENSE manually).
