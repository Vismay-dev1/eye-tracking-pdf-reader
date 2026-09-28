# 👁️ Oculis — Eye-Tracking PDF Reader

 https://vismay-dev1.github.io/eye-tracking-pdf-reader/

A hands-free PDF reader that runs entirely in your browser. Upload any PDF, calibrate
your gaze once (~20 seconds), and the document **scrolls itself as you read**. A soft
highlight follows the exact word you're looking at — touch nothing.

> **Privacy: everything is on-device.** Face analysis runs locally in your browser via
> TensorFlow.js (WebGL). No video frame, photo, or gaze coordinate ever leaves your
> machine. Closing the tab releases the camera and forgets everything.

---

## ✨ Features

### 👀 Real webcam eye tracking
- **MediaPipe FaceMesh (478 landmarks, iris-refined)** via TensorFlow.js — the
  displacement of your iris inside the eye is a strong proxy for gaze direction.
- **9-point calibration**: a **quadratic polynomial regression** (`[1, fx, fy, fx², fy², fx·fy]`)
  learns the mapping from *your* eye geometry to screen pixels, with a quality report (±px).
- **Blink handling**: blink frames are dropped; a single open eye still tracks.
- **Median-of-3 spike filter** + a tuned **One Euro filter**: rock-steady during
  fixations, near-zero lag during saccades.
- Calibration is **saved in localStorage** — press `C` anytime to redo it.

### 📄 A real PDF reader
- **Upload any PDF** — drag & drop or browse (up to 150 MB). Password-protected
  PDFs supported.
- **Built-in sample document** generated client-side (pdf-lib) — perfect for a first try.
- **Continuous, virtualized scrolling** of all pages (IntersectionObserver renders only
  pages near the viewport — smooth and memory-friendly on huge documents).
- **Selectable text layer** with correct fonts/positions (pdf.js `TextLayer`).
- **Zoom** (50–250 %), fit-to-width, page jump, hi-DPI rendering, progress bar,
  and read themes (dark / sepia / light).

### 🎢 Two ways to auto-scroll
- **Gaze edge scrolling**: glance at the bottom edge to scroll down, top edge to
  scroll up. Speed is proportional to how deep into the scroll zone you look
  (zones and sensitivity are adjustable).
- **Teleprompter mode**: constant-speed scrolling that politely pauses for ~2.5 s
  whenever you scroll manually.

### 🎯 Word-level reading intelligence
- The **word under your gaze is highlighted** in real time (60 Hz hit-testing on the
  text layer).
- **Never lose your place**: press `R` to jump back to the last word you looked at.
- **Live reading stats**: session time and an estimated words-per-minute based on the
  words your gaze actually visited.

### 🧯 Graceful degradation
- **Mouse demo mode**: no camera? Your cursor becomes the "gaze" — every feature works.
- Camera denied / no camera / model unreachable → clear banner with **Retry** and
  **Use mouse instead** — the reader is never blocked.

---

## 🚀 Quick start

```bash
git clone https://github.com/Vismay-dev1/eye-tracking-pdf-reader.git
cd eye-tracking-pdf-reader
npm install
npm run dev
```

Open `http://localhost:5173`.

> **Note:** camera access requires a secure context. `localhost` counts as secure; to
> use the app over LAN/HTTPS you need a TLS certificate (or use mouse mode).

### First run
1. Choose **👁 Eye tracking** (or **Mouse (demo)** to try without a camera).
2. Drop a PDF, or click **“Try the sample document.”**
3. Camera allowed → **calibrate**: follow the 9 pulsing dots (~20 s, head still).
4. Read. Glance at the bottom of the window to scroll; press `Space` to pause.

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Pause / resume auto-scroll |
| `←` / `→` (or `PgUp` / `PgDn`) | Previous / next page |
| `+` / `-` / `0` | Zoom in / out / reset to fit width |
| `R` | Jump back to the last word under your gaze |
| `G` | Toggle the reading guide line |
| `C` | Recalibrate eye tracking |
| `Esc` | Close calibration dialog |

## 🛠️ How it works

```
webcam ──► MediaPipe FaceMesh (478 pts + iris)        TensorFlow.js · WebGL
            │
            ▼
      iris features (fx, fy)     displacement of each iris inside its eye
            │                    corners, normalised by eye width (scale-free)
            ▼
      median-of-3 spike filter
            ▼
      quadratic regression       screen = f(fx, fy) — learned during calibration
            ▼
      One Euro filter            steady while fixating, instant on saccade
            ▼
      gaze point ──► scroll engine (rAF, edge zones)
                  └─► word hit-test on the PDF text layer
```

### Project layout

```
src/
├── lib/
│   ├── gazeEngine.ts      # camera + detector singleton, ~30 fps frame stream
│   ├── regression.ts      # quadratic least-squares fit + One Euro filter
│   ├── pdf.ts             # pdf.js v4 setup (self-hosted .mjs worker)
│   ├── samplePdf.ts       # pdf-lib sample-document generator
│   └── storage.ts         # localStorage persistence
├── hooks/
│   └── useEyeTracking.ts  # features → smoothed gaze ref (camera & mouse modes)
├── components/
│   ├── Home.tsx           # landing page, drag & drop upload, mode picker
│   ├── Calibration.tsx    # 9-point dwell calibration with quality report
│   ├── PDFReader.tsx      # toolbar, virtualized pages, scroll engine, shortcuts
│   ├── PageCanvas.tsx     # hi-DPI canvas + selectable TextLayer per page
│   ├── SettingsPanel.tsx  # scrolling / reading aids / theme settings
│   ├── CameraPanel.tsx    # live preview with face-box + iris overlay
│   └── GazeOverlays.tsx   # gaze cursor + guide line (pure rAF, zero re-renders)
└── App.tsx                # state orchestration
```

### Stack
React 18 · TypeScript (strict) · Vite · Tailwind CSS · pdf.js 4 · TensorFlow.js 4 ·
MediaPipe FaceMesh · pdf-lib · lucide-react

## 📋 Requirements
- Any modern browser (Chrome / Edge / Firefox / Safari 16+)
- Webcam (optional — mouse mode needs nothing)
- The face-mesh model (~10 MB) is fetched once from Google's model CDN and cached by
  the browser; PDF rendering assets are bundled locally.

## 🔧 Releasing / building

```bash
npm run build      # tsc --noEmit + vite build  → dist/
npm run preview    # serve the production build
npm run typecheck  # types only
```

## 🐛 Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Camera permission was denied" | Allow camera in the browser's site settings, click **Retry** — or use mouse mode |
| "Could not start eye tracking" | The face model didn't download — check the internet connection, retry |
| Gaze dot jitters | Normal if dim — add light to your face; recalibrate with `C` |
| Gaze drifts over time | Recalibrate (`C`); keep your head ~still while reading |
| Tracking feels laggy | Close heavy tabs so WebGL gets the GPU; models run at ~30 fps |
| PDF won't open | Corrupt file — try another; password-protected files are prompted |

## 🤝 Contributing
PRs welcome — please keep `npm run typecheck` clean and match the existing style.

## 📄 License
MIT

---

**Made with ❤️ for accessible, hands-free reading.**
