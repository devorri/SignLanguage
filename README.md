# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:


## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

 # Sign Language Recognition

 React + Vite browser app for ASL fingerspelling. Webcam frames stay in the browser: MediaPipe extracts 21 hand landmarks, a classifier produces one of 26 letters, and a temporal buffer stabilizes the result.

 ## Packages

 Already installed in `package.json`:

 ```bash
 npm install @mediapipe/tasks-vision @tensorflow/tfjs react react-dom
 npm run dev
 ```

 `@mediapipe/tasks-vision` supplies `HandLandmarker` in VIDEO mode. TensorFlow.js is the production classifier path; the current geometric classifier is a usable fallback while a trained model is prepared.

 ## Recognition architecture

 1. `useWebcam` requests a 640x480 user-facing camera and owns stream cleanup.
 2. `useHandLandmarker` loads the MediaPipe WASM runtime and hand-landmarker task.
 3. `WebcamFeed` runs `detectForVideo` in `requestAnimationFrame`, draws the skeleton, and forwards landmarks.
 4. `normalizeLandmarks` translates every point relative to the wrist and scales by wrist-to-middle-MCP distance. This creates 63 stable features for a static model.
 5. `classifyGeometric` recognizes static A-I and K-Y as a no-model fallback. For production accuracy, replace this call with the TF.js model described below.
 6. `MotionClassifier` stores a wrist-relative index-fingertip trace for up to 1.8 seconds and recognizes J or Z after a completed stroke.
 7. `usePredictionBuffer` uses a sliding majority vote plus confidence hysteresis. A candidate must hold a majority and beat the locked result by a margin before the UI switches.

 ## Modular structure

 ```text
 src/
   components/
     WebcamFeed.tsx       camera, landmark loop, skeleton overlay
     PredictionCard.tsx   letter, confidence, transcript, speech
     StatusIndicator.tsx  Ready / detecting motion / locked states
   hooks/
     useWebcam.ts         getUserMedia lifecycle
     useHandLandmarker.ts MediaPipe initialization
     usePredictionBuffer.ts smoothing and lock hysteresis
   ml/
     normalizeLandmarks.ts wrist-relative 63-value features
     geometricClassifier.ts deterministic fallback classifier
     motionClassifier.ts rolling J/Z trajectory classifier
     tfjsClassifier.ts optional 26-output model loader
   types/index.ts         shared contracts
 ```

 ## Production A-Z model plan

 The geometric rules are intentionally a fallback. To achieve measurable A-Z accuracy:

 1. Capture several thousand labeled examples per letter from multiple users, camera distances, lighting conditions, left/right hands, and orientations. Include a `none`/transition class for non-sign frames.
 2. Keep static examples as normalized 63-value landmarks. Add hand orientation and handedness consistently during capture; either mirror left hands or train both variants.
 3. Train a small MLP with input shape `[63]` and output shape `[26]` using softmax and categorical cross-entropy. Split by signer, not by frame, to avoid leakage.
 4. Export with TensorFlow.js converter and place `model.json` plus shard files under `public/model/`:

    ```bash
    tensorflowjs_converter --input_format=keras model.keras public/model
    ```

 5. Load the model once before starting detection with `loadTfjsModel('/model/model.json')`. Run inference at a controlled rate (for example 10-15 Hz), dispose tensors, and send its 26-class probabilities into `usePredictionBuffer`.
 6. Treat J/Z as temporal classes. Use the static model only to confirm the starting pose (`I` for J, `D` for Z), then require `MotionClassifier` to confirm the trajectory. Never emit static `I`/`D` as J/Z without motion.
 7. Validate a held-out signer set. Track per-class precision/recall and a confusion matrix, especially M/N, S/T, U/V, and I/J. Tune confidence thresholds from validation data rather than guessing them in the UI.

 ## Webcam and browser requirements

 Camera access requires HTTPS or `localhost`, a user permission grant, and a browser with WebAssembly/WebGL support. The MediaPipe task is downloaded from Google Cloud on first load; for an offline deployment, vendor the task and WASM assets and point `WASM_CDN` and `MODEL_URL` at local files.

 ## Checks

 ```bash
 npm run lint
 npm run build
 ```
You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
