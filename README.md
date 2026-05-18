# PROJECTNIRO AI Companion

An interactive React + Vite AI companion experience with a 3D avatar, Hindi/English conversation modes, voice input, mimic speech, a 3D desk room, and a butterfly cursor companion.

## Features

- 3D AI teacher avatar with idle, talking, seated room, and dance modes.
- Hindi and English response mode switch.
- Voice input and mimic mode for repeating spoken text.
- OpenAI-powered local API routes through the Vite dev server.
- Mode Selection panel for background, room, dance, and cursor controls.
- 3D room with desk, chair, monitor, keyboard, mouse, solid floor, and adjusted avatar sitting pose.
- Animated GLB butterfly cursor with optional normal cursor mode.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
.env.local
```

Add your API key:

```bash
OPENAI_API_KEY=your_key_here
```

Do not commit `.env.local`; it is intentionally ignored.

## Development

Start the local dev server:

```bash
npm run dev
```

Open the companion route:

```text
http://localhost:5173/companion/
```

## Build

Create a production build only when ready:

```bash
npm run build
```

## Project Structure

- `src/App.jsx` - main companion UI, modes, voice controls, and cursor state.
- `src/components/AvatarCanvas.jsx` - 3D scene, camera, room, desk, and controls.
- `src/components/GirlAvatar.jsx` - avatar rig, seated pose, blink, talk, and dance behavior.
- `src/components/ButterflyCursor.jsx` - GLB butterfly cursor rendering and animation.
- `src/services/geminiService.js` - chat service client used by the UI.
- `src/services/lipsyncEn.js` and `src/services/lipsyncHi.js` - lip sync helpers.
- `public/butterfly.glb` - butterfly model asset.

## Notes

- Keep API keys in `.env.local`.
- The 3D room is tuned for the current avatar rig and camera.
- Build was intentionally not run during the latest UI changes unless requested.
