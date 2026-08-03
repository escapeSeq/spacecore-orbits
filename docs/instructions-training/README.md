# Spacecore Orbits — instructions video

Annotated walkthrough of the live app with the same narration voice as Overmind pilot-card training:

**en-GB-LibbyNeural · rate +5%**

Output:

- `Spacecore-Orbits-Instructions.mp4`
- copied to `public/videos/instructions.mp4` for the in-app Instructions modal

## Rebuild

1. Start the app (dev recommended so UI matches source):

   ```bash
   docker compose --profile dev up -d --build spacecore-dev
   ```

   Or local: `npm start` (default http://localhost:3000 — set `SPACECORE_URL`).

2. Capture a live interactive walkthrough (clicks + WebGL animation):

   ```bash
   cd docs/instructions-training
   set SPACECORE_URL=http://localhost:3000
   python capture_live.py
   ```

3. Build narrated video (muxes live clips + SoniaNeural voice):

   ```bash
   python build_video.py
   ```

Requires: Python 3 + `playwright` + `edge-tts`, and `ffmpeg` / `ffprobe` on PATH.
