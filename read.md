# AI Companion App

## Overview
This is a web-based AI companion application that features an interactive, animated 3D avatar. The avatar is fully rigged to support procedural idle animations, dancing, and dynamic lip-syncing for speech.

## Features
- **3D Avatar Rendering:** Powered by `react-three-fiber` and `three.js`.
- **Dynamic Lip Sync:** Uses morph targets (blend shapes) mapped to vocal frequencies to procedurally move the character's mouth and jaw when talking.
- **Procedural Idle Animation:** The character has a natural idle state with breathing, head tracking, and gentle body swaying.
- **Dance Mode:** Supports playing custom FBX animations (e.g., `dance.fbx`), dynamically retargeting the animation tracks to the character's skeleton.

## Asset Management
### Characters
The application uses the Ready Player Me model format (`.glb`). 
- **Current Model:** `andra.glb` (Located in `/public/andra.glb`)
- **Rigging specs:** The model is rigged with full facial blend shapes (60 morph targets on `Wolf3D_Head` and `Wolf3D_Teeth`), enabling high-fidelity facial expressions and lip syncing.

### Updating the Character
If you want to update or change the character in the future:
1. Obtain a `.glb` model (preferably from Ready Player Me to ensure morph target compatibility).
2. Place the new `.glb` file in the `public/` directory.
3. Open `src/components/GirlAvatar.jsx`.
4. Update the `MODEL_URL` constant at the top of the file to point to your new file name (e.g., `const MODEL_URL = '/new_avatar.glb'`).
5. The dynamic rig mapping will automatically detect the bones and morph targets for the new model.

## Setup & Development
- **Run Locally:** `npm run dev`
- **Build for Production:** `npm run build`

## Future Updations
- **AI Integration:** Connect the avatar's `talk` action to an LLM stream (like Gemini or OpenAI) so it speaks dynamically generated text.
- **Audio Analysis:** Instead of purely simulated sine-wave lip movement, you can connect an audio analyzer to the morph targets for perfect audio-driven lip sync.
