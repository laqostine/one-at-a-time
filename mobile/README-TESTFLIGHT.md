# One at a time — iOS app (TestFlight)

The iOS app is a native shell (Capacitor) that loads the live web app from https://table.akilion.ai.
Every web deploy updates the app instantly; you only re-archive when native things change (icon, permissions).

## First time (about 15 minutes, needs your Apple developer login)
1. `cd mobile && npx cap open ios` (opens Xcode 16).
2. In Xcode: select the **App** target → **Signing & Capabilities** → Team **4S998Y9CAQ** (your account) → tick *Automatically manage signing*. Bundle id is `ai.akilion.oneatatime` (change if App Store Connect already owns it).
3. App Store Connect → **My Apps → + → New App**: platform iOS, name *One at a time*, bundle id `ai.akilion.oneatatime`, SKU `oneatatime`.
4. Xcode: choose **Any iOS Device (arm64)** as the run destination → **Product → Archive** → in the Organizer **Distribute App → TestFlight & App Store → Upload**.
5. App Store Connect → TestFlight → add yourself and friends as internal testers (up to 100, no review). They get the TestFlight invite by email within minutes.

## Permissions already declared
- Microphone: "Your phone is your mic at the table. Audio is transcribed live and never stored."
- Camera: "Only to notice when you look away from the table. Nothing is stored or sent."

## Notes
- The app needs the laptop stack running (`bin/demo.sh`) because table.akilion.ai is served from it. For a permanent app, host the server on the Hetzner box behind the same domain.
- Listener: open the app, it lands on the listener page. Phones: share the join link from Settings → Add phones; the same app opens it.
- Rebuild the native shell only after `npx cap sync ios`.
