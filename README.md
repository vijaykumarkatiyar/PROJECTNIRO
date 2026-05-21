# PROJECTNIRO AI Companion

An interactive React + Vite AI companion experience with Hindi/English AI teacher modes, male/female 3D avatars, voice input, mimic speech, expressive lip sync, a 3D desk room, and a butterfly cursor companion.

## Features

- Female and male AI teacher avatars with matching voice/reply perspective.
- 3D AI teacher avatar behavior with idle, talking, seated room, and dance modes.
- Hindi and English response mode switch.
- Voice input, read-text mode, and mimic mode for repeating spoken text.
- Audio-clocked lip sync for greetings and replies, with stronger mouth articulation and user-facing gaze while speaking.
- OpenAI-powered local API routes through the Vite dev server, plus PHP endpoints for hosted static deployment.
- Mode Selection panel for background, room, dance, lighting, character, and cursor controls.
- 3D room with desk, chair, monitor, keyboard, mouse, solid floor, realistic shadows, and adjusted avatar sitting pose.
- Animated GLB butterfly cursor with optional normal cursor mode.
- NIPUN marquee background with moving colorful text rows.

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

Do not commit `.env`, `.env.local`, or any API key. Environment files are intentionally ignored.

For Gemini chat replies, use a Gemini key in the app's explicit key field or via the supported URL key query. For OpenAI speech/chat, use an OpenAI `sk-` key locally or configure it on the hosted PHP backend.

## Development

Start the local dev server:

```bash
npm run dev
```

Open the companion route:

```text
http://localhost:5173/companion/
```

## Hosted Deployment

The app is configured for the `/companion/` base path. After building, upload the `dist` contents to the hosted companion folder and keep the `public/api/*.php` endpoints available on the same path when using hosted OpenAI chat or speech.

Supported explicit key flows:

- Use the in-app Mode Selection panel to save an API key in the browser.
- Use URL query keys when needed, such as `?key=`, `?gemini_key=`, or `?openai_key=`.
- Never commit real keys to GitHub.

## Build

Create a production build only when ready:

```bash
npm run build
```

## Project Structure

- `src/App.jsx` - main companion UI, modes, voice controls, and cursor state.
- `src/components/AvatarCanvas.jsx` - 3D scene, camera, room, desk, and controls.
- `src/components/GirlAvatar.jsx` - avatar rig, male/female character handling, seated pose, blink, talk, gaze, lip sync, and dance behavior.
- `src/components/ButterflyCursor.jsx` - GLB butterfly cursor rendering and animation.
- `src/services/geminiService.js` - chat service client used by the UI.
- `src/services/lipsync.js`, `src/services/lipsyncEn.js`, and `src/services/lipsyncHi.js` - English/Hindi viseme timeline helpers.
- `public/butterfly.glb` - butterfly model asset.
- `public/ready_player_me_male_avatar.glb` - male avatar model asset.
- `public/api/chat.php` and `public/api/speech.php` - hosted PHP API endpoints.

## Notes

- Keep API keys out of Git.
- The 3D room and seated pose are tuned for the current avatar rigs and camera.
- Lip sync is driven by actual audio playback time where possible, so greetings and replies should start and end with the voice.
- Build was intentionally not run during the latest UI changes unless requested.
