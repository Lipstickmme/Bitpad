# BITPAD — 30-second motion graphics prompt

Create a 30-second, 16:9 (1920×1080, 60 fps) motion graphics promo for **BITPAD**, a TON blockchain app where people **buy tokenized stocks on TON** and **launch creator jettons backed by them**. Build it as a single self-contained HTML file using HTML, CSS and SVG animation (GSAP from cdnjs is allowed). Everything must loop seamlessly, play automatically, and look premium: think Apple keynote meets Bloomberg terminal meets 8-bit arcade.

## Brand

- **Name:** BITPAD, always in caps, extra-bold, letter-spacing 0.08em.
- **Mascot:** BIT, a small white pixel-art astronaut-bird with a round helmet and a tiny rocket pack, drawn in crisp square pixels (no anti-aliasing, `image-rendering: pixelated`).
- **Palette:** background `#071014` → `#0a1215`; surfaces `#0f191d`; lines `#1c2a30`; text `#edf2f3` and `#a3b3b9`; accent ice-blue `#8cbfd1`; launch red `#e5484d`; up green `#3fbf8f`; down red `#f0566f`; news yellow `#f5c518`; verified blue `#1d9bf0`.
- **Type:** Geist or Inter. Headlines uppercase, extra-bold, tight leading. Numbers in tabular figures.
- **Finish:** glass. Frosted panels with a soft top highlight, thin 1px inner rim, and a diagonal light sweep that glides across buttons. No neon glow on red buttons, only glass and shine.

## Timeline (30 s)

**0.0–3.0 s · Cold open: the night sky**
Black-teal sky. Pixel stars twinkle in on a grid, a few at a time. A thin horizon line draws itself left to right. BIT walks in from the left in 4-frame pixel steps, stops, looks up. Subtle low hum.

**3.0–6.0 s · "BELIEVE IN TON"**
The camera tilts up. Stars rearrange into pixel letters that spell **BELIEVE IN TON**, hold for a beat, then scatter back into stars. BIT's rocket pack ignites (pixel flame, 3 frames) and he lifts off, leaving a dotted trail.

**6.0–9.5 s · The ticker world**
Smash cut as BIT flies through a wall of glass. We're inside the BITPAD interface. A live price ticker scrolls across the top: AAPLx $333.02 +1.1%, NVDAx $228.38 +0.5%, TSLAx $354.81 +0.6%, SPYx, QQQx, XAUt (gold), TON, GRAM, NOT. Beneath it a yellow news strip with a black **NEWS** tag slides in: "STOCKS CLOSE AT RECORD AS NVIDIA LEADS…", "BITCOIN ETFS LOG FIFTH DAY OF INFLOWS…". Each stock ticker has a tiny blue verified check that pops in with a spring.

**9.5–13.0 s · "BUY STOCKS ON TON."**
Big uppercase headline types in, word by word, with a hard cut on each word: **BUY STOCKS ON TON.** Behind it, a grid of glass cards (Apple, Tesla, NVIDIA, S&P 500, Gold) flips in one by one in 3D. A cursor taps the ⚡ quick-buy button on TSLAx: the button presses down 1px, a light sweeps across it, a toast slides up: "Bought $TSLAx ✓".

**13.0–17.5 s · "LAUNCH CREATOR JETTONS."**
Second headline line slams in under the first in ice-blue: **LAUNCH CREATOR JETTONS.** The launch form assembles from glass panels: avatar, name "S&P CAT", ticker $SPYCAT, a Telegram ✓ verified badge. A "Back it with" picker scrolls through SPYx, XAUt, NVDAx, TON and locks on **SPYx**. The red **Launch Creator Jetton** button gets pressed.

**17.5–21.0 s · One transaction, live from block one**
Diagram moment, clean and fast: the press sends a single glowing packet into a hexagon labelled **Factory**. It splits into three: **Jetton** (fixed supply), **Pool** (with a padlock: "liquidity locked forever"), **Staking vault**. A price chart starts drawing immediately in green: "LIVE FROM BLOCK ONE · NO BONDING CURVE". A row in a market table softly pulses amber: "unusual volume".

**21.0–25.0 s · Everyone earns**
Three glass tiles flip in, each with a counter rolling up:
- **Creators:** earn on every trade
- **Referrers:** paid for every buyer they bring
- **Holders:** stake and earn TON
Coins arc from the pool into each tile. Below, the Trench Chat bubble pops open with messages labelled OFF-CHAIN and ON-CHAIN: "gm trenches", "$SPYCAT to the moon 🚀", a sticker that says "BELIEVE IN TON".

**25.0–28.0 s · Across chains**
Zoom out to a globe of nodes: TON in the center, Solana and Ethereum orbiting, lines connecting them. Small labels: "xStocks", "Gold", "Bitcoin", "Memecoins". BIT flies one lap around the globe.

**28.0–30.0 s · End card**
Everything collapses into the BIT pixel mark. Next to it **BITPAD** in caps. Tagline under it: **BUY STOCKS ON TON. LAUNCH CREATOR JETTONS.** A glass "Open BITPAD" button with a single light sweep. Fade the stars back in so the last frame matches the first (seamless loop).

## Motion rules

- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` for UI, `steps(4)` for pixel art, springs (overshoot ~8%) for checkmarks and toasts.
- Cuts on the beat: assume a 120 BPM track, so major changes land every 2 s (every 1 s for word hits).
- Depth: subtle parallax (stars 0.2×, UI 1×, foreground glass 1.3×).
- Keep text on screen at least 1.2 s and never smaller than 28 px at 1080p.
- No real company logos: use letter avatars (AA, NV, TS, SP) in colored circles.
- Respect `prefers-reduced-motion` by crossfading scenes instead of moving them.

## Deliverable

One HTML file, no external assets except Google Fonts and GSAP from cdnjs. Include a small play/pause control and a scrubber in the bottom corner, hidden until hover. Export-friendly: the stage is a fixed 1920×1080 box scaled to fit the window.
