# DESIGN DIRECTION: SuaraKaca (Spotify Liquid Glass TTS)

## 1. Identity & Mood
A minimalist, modern audio generation workspace inspired by Spotify's iconic player interface combined with liquid glass (frosted glassmorphism) aesthetics. The experience feels tactile, calm, focused, and acoustically refined.

## 2. Antislop Dials
- **ENERGY: 2 (Balanced)**
  Deep acoustic dark palette (#121212, #181818, #282828) with Spotify signature vibrant accent (#1DB954) used deliberately on primary states and audio playback. High contrast for readability, never blinding or overly neon.
- **RHYTHM: 2 (Balanced)**
  A 2-part content architecture:
  1. Main stage: Clean text input studio with character count, audio voice settings (Male/Female: Ardi & Gadis), and tone/prosody cards (Ceria, Sedih, Naratif) plus fine-tuning sliders (Kecepatan & Nada Suara).
  2. Bottom dock: Persistent Spotify-style liquid glass player bar with real-time waveform visualizer, preview controls, time scrubbing, volume slider, and dual download actions (.wav and .mp3).
- **MOTION: 2 (Smooth & Purposeful)**
  Liquid glass backdrop blur effects capped to the dock and control panel (R-10). Smooth audio visualizer bars driven by Web Audio API during playback. Transitions on state changes (hover, active, toggle) with 150-250ms ease curves. No perpetual infinite decorative pulses (R-19).

## 3. Color Palette (R-29 Cap: 3 Core + 1 Accent)
- Core Neutral Base: Deep Obsidian `#0E0E10` (page body)
- Core Surface 1: Spotify Dark Grey `#181818` with subtle border `rgba(255, 255, 255, 0.08)`
- Core Surface 2: Frosted Liquid Glass `rgba(24, 24, 28, 0.75)` with `backdrop-filter: blur(20px)` and glass specular edge `rgba(255, 255, 255, 0.12)`
- Accent: Spotify Green `#1DB954` (active toggle, primary audio play state, seek bar progress)
- Typography: High-contrast pure white `#FFFFFF` for primary text (21:1 contrast ratio) and soft silver `#A7A7A7` for secondary metadata (7.4:1 contrast ratio, fully WCAG AAA compliant, R-25).

## 4. Typography (R-06)
- Font Stack: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif.
- Clean optical sizing, no uppercase wide-spaced pseudo-terminal slop, no ASCII art decorations.

## 5. Copywriting Standards (R-02, R-16)
- Zero em dashes (`—`). Use commas, periods, colons, or parentheses.
- Honest, direct Indonesian language: "Dengarkan Preview", "Buat Audio", "Unduh .MP3", "Unduh .WAV".
- No marketing buzzwords ("AI Revolusioner", "Next-Gen Ultra", etc.).

## 6. Interactive States (R-26, R-27, R-32)
- Empty state: Clear helper prompt in the text area with helpful preset examples.
- Loading state: Clear generation spinner and button disabled state with status message.
- Error state: Human-friendly error banner with retry option if network or server fails.
- Keyboard support: Accessible Tab indexes, visible 2px outline focus indicators, Enter/Spacebar triggers.
