# Tickwell: deploy and build guide

Order matters: deploy the server on Render first. Every other build points at it.

## 0. Before you start
- Install Node 22 or newer (nodejs.org) and Git. Create a GitHub account.
- Push this whole folder to a new GitHub repo.

## 1. Render (the server and the web app)
1. render.com > New > Web Service > connect GitHub > pick the repo.
2. Runtime Node. Build command `npm install`. Start command `npm start`. Health check path `/health`.
3. Free plan is fine for testing. To keep data, pick a paid plan, open Advanced > Add Disk: name `tickwell-data`, mount path `/var/data`.
4. Environment variables: `DATA` = `/var/data/tickwell-data.json`. (`SERVER_URL` is not needed here.)
5. Create Web Service. Wait for "Live", then open the `https://<name>.onrender.com` address: the app loads and Collaboration works.
6. Put that address into `server.config.json` (`{"url": "https://<name>.onrender.com"}`) and commit. Every other build below reads it.
Free plan: sleeps after 15 minutes idle (first request is slow) and wipes data on restart or deploy.

## 2. Netlify (static copy of the app, talks to your Render server)
1. app.netlify.com > Add new project > Import an existing project > GitHub > the repo.
2. Build command `npm run build`, publish directory `www` (already set in netlify.toml).
3. Site configuration > Environment variables > add `SERVER_URL` = your Render address (or rely on server.config.json).
4. Deploy. Open the Netlify address. Collaboration uses the Render server.
5. Skip Netlify if you are happy with the Render address; Render already serves the app.

## 3. Android APK (Capacitor + Android Studio)
Install Android Studio (it bundles the JDK). In its SDK Manager install a recent Android SDK platform.
1. `cd mobile`
2. `npm install @capacitor/core @capacitor/android @capacitor/local-notifications`
3. `npm install -D @capacitor/cli @capacitor/assets`
4. `npm run prep` (copies the app into `mobile/www` with your server address baked in)
5. `npx cap add android`
6. `npm run assets` (makes launcher icons from `mobile/assets`)
7. `npm run sync`
8. Edit `mobile/android/app/src/main/AndroidManifest.xml`, add inside `<manifest>`, above `<application>`:
   `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`
   `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />`
9. `npx cap open android`. Wait for Gradle sync to finish.
10. Test: pick a phone or emulator, press Run.
11. Installable file: Build > Build Bundle(s) / APK(s) > Build APK(s). File: `android/app/build/outputs/apk/debug/app-debug.apk`.
12. For a signed release APK: Build > Generate Signed App Bundle / APK > APK > create a keystore (back it up) > release.
Change `appId` in `mobile/capacitor.config.json` first (for example `com.yourname.tickwell`). After any app change run `npm run sync` again.

## 4. Windows .exe (Electron)
1. `cd desktop`
2. `npm install -D electron electron-builder`
3. Try it: `npm start`
4. Build: `npm run dist`
5. Find the installer and a portable exe in `desktop/dist/`.
Build on Windows. Building the exe from Mac or Linux needs extra tools (Wine). Unsigned exes show a Windows SmartScreen warning.

## Known limits
- Reminders arrive with the app closed only in the Android app. Desktop and web reminders fire while the app is open.
- In the Android app, "Export file" may not save a file. Use "Copy to clipboard" (works) or ask for a Share-sheet export.
- Exact-time alarms on Android 12+ may need the user to allow "Alarms & reminders"; otherwise reminders can be a few minutes late.
