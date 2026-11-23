# Tickwell

One Node service does everything: it serves the app and runs the collaboration API. Users never enter a server address.

## Deploy on Render
1. Push this folder to a Git repo.
2. Render > New > Web Service > pick the repo. Runtime: Node. Build command: leave empty. Start command: `npm start`.
3. Environment variables:
   - `DATA` = `/var/data/tickwell-data.json`, plus a persistent disk mounted at `/var/data` (Render paid plans).
     Without a disk, Render wipes the file on every deploy or restart, and groups and shared tasks are lost.
   - `SERVER_URL` is optional. Set it only if the app is opened from a different domain than the server.
   - `PORT` is set by Render.
4. Open your Render URL. Collaboration works with no setup.

## Native app (Capacitor) or a separate static host
The installed app lives on its own origin, so bake in the server address once at build time:

Copy the generated `www/` into your Capacitor project. Do not commit secrets: the server address is public.

## Notes
- Each device has a public ID and a private secret kept on the device. The first request registers the secret.
- The free Render tier sleeps when idle, so the first request after a pause is slow.
- Run locally: `npm start`, then open http://localhost:8787
