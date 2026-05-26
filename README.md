# CrypGo Mobile — Local Development (Android Emulator)

How to run the passenger and driver apps locally without a physical device.

---

## Prerequisites

| Tool | Notes |
|---|---|
| Node.js 20 LTS | Required by Expo |
| Android Studio | Includes the Android SDK and AVD Manager |
| A running CrypGo backend | See `../README.md` |

---

## One-time setup

### 1. Install Android Studio

Download from [developer.android.com/studio](https://developer.android.com/studio) and install
with the default options. The installer sets up the Android SDK automatically.

### 2. Set the ANDROID_HOME environment variable

Open **Environment Variables** (`Win + R` → `sysdm.cpl` → Advanced → Environment Variables).

In **User variables** → **New**:

| Field | Value |
|---|---|
| Variable name | `ANDROID_HOME` |
| Variable value | `C:\Users\<your-username>\AppData\Local\Android\Sdk` |

Then find the `Path` entry → **Edit** → **New**:

```
C:\Users\<your-username>\AppData\Local\Android\Sdk\platform-tools
```

Open a **new** PowerShell window and verify:

```powershell
$env:ANDROID_HOME   # should print the SDK path
adb --version       # should print an adb version number
```

### 3. Create a virtual device (AVD)

1. Open Android Studio → **More Actions → Virtual Device Manager**
2. Click **Create Device**
3. Select **Pixel 8** → Next
4. Select system image **API 35** (download if needed) → Next → Finish

---

## Starting the apps

Run each command in its own terminal. Order matters — start the backend first.

### Terminal 1 — Docker infrastructure

From the project root (where `docker-compose.yml` is):

```bash
docker compose up -d postgres redis
```

### Terminal 2 — NestJS backend

```bash
cd cryptgo-backend
npm run start:dev
```

Wait until you see:

```
🚀 CrypGo API is running on http://localhost:3000
✅ PostgreSQL connected
✅ Redis connected
```

### Terminal 3 — Launch the Android emulator

In Android Studio open **Device Manager** and press ▶️ next to your AVD.
Wait for the emulator to fully boot (home screen visible) before continuing.

### Terminal 4 — Port forwarding (required after every emulator start)

The Android emulator runs in an isolated network. `adb reverse` creates a tunnel so the
emulator can reach the Metro bundler running on the host machine.

```powershell
adb reverse tcp:8081 tcp:8081   # passenger-app (default Metro port)
adb reverse tcp:8082 tcp:8082   # driver-app
```

> **Run this every time you restart the emulator.** Without it the apps show a black screen
> because the JavaScript bundle cannot be downloaded.

### Terminal 5 — Passenger App

```powershell
cd cryptgo-mobile/passenger-app
npx expo start --android
```

Expo detects the running emulator and installs the app automatically.

### Terminal 6 — Driver App

Open a second terminal:

```powershell
cd cryptgo-mobile/driver-app
npx expo start --android --port 8082
```

The `--port 8082` flag avoids a conflict with the passenger-app Metro server already running
on 8081.

---

## Backend connection

Both apps connect to the backend via the `apiBaseUrl` set in `app.json`:

```json
"extra": {
  "apiBaseUrl": "http://10.0.2.2:3000"
}
```

**`10.0.2.2` is the Android emulator's built-in alias for the host machine's `localhost`.**
No changes are needed — the emulator reaches the NestJS server on port 3000 automatically.

### Physical device (optional)

If you want to test on a real phone, the phone and the computer must be on the same Wi-Fi
network. Replace `10.0.2.2` with the computer's local IP in both `app.json` files:

```powershell
# Find your local IP
ipconfig | Select-String "IPv4"
```

```json
"extra": {
  "apiBaseUrl": "http://192.168.1.XXX:3000"
}
```

Then scan the QR code shown in the Expo terminal with the
**Expo Go** app ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) /
[iOS](https://apps.apple.com/app/expo-go/id982107779)).

> The QR code that appears in the terminal is only for physical devices — it is not needed
> when using the emulator.

---

## Useful Expo terminal shortcuts

| Key | Action |
|---|---|
| `r` | Reload the app (clears the red error screen) |
| `m` | Open the developer menu inside the emulator |
| `j` | Open the JavaScript debugger |
| `Ctrl + C` | Stop the Expo server |

---

## Troubleshooting

**Black screen, no errors in the Metro terminal** — `adb reverse` is not set up (or was reset
when the emulator restarted). Run:

```powershell
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082
```

Then press `r` in each Metro terminal to reload the bundle.

**Red error screen on first launch** — press `r` in the Expo terminal to reload. If the error
persists, copy the message from the red screen and check the terminal for the full stack trace.

**`TypeError: property is not writable` crash** — two copies of React were loaded from
different `node_modules` directories. Make sure `cryptgo-mobile/node_modules/react` does
**not** exist (only the apps' own copies should). Delete it if present:

```powershell
Remove-Item -Recurse -Force "cryptgo-mobile\node_modules\react"
```

Then restart Metro with `--clear`.

**`adb: command not found`** — `platform-tools` is not in `PATH`. Re-check the environment
variable setup and open a new terminal window. As a temporary fix:

```powershell
$env:PATH += ";$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools"
```

**Emulator not detected by Expo** — make sure the AVD is fully booted (home screen visible)
before running `npx expo start --android`.

**`ANDROID_HOME` still empty after setting it** — environment variables are only visible to
processes started after they were set. Close all terminals and open a new one.
