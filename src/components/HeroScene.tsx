"use client";
import { useEffect, useRef } from "react";

/**
 * Pixel-art hero background: a 17s story, drawn at low resolution and scaled
 * up with nearest-neighbour sampling. The world is two screens tall and a
 * camera pans between the ground and a sky with the Milky Way, a moon and a
 * mothership cruising past.
 *
 *   0–1s     BIT (the logo mascot) on the hill; a shooting star passes
 *   1–3s     he dashes to the top of the hill
 *   3–4s     stops, looks up — "!"
 *   4–6.5s   the view sweeps up to the moon and the ships, then back down
 *   6.5–7.5  it hops into its rocket; the engine rumbles
 *   7.5–9.5  lift-off, the camera follows it up
 *   9.5–14.5 a drone swarm rises and spells BELIEVE IN TON
 *   14.5–16  the mascot streaks away, the drones scatter
 *   16–17    the view settles back on the hill
 * then BIT stands under the stars for PAUSE seconds before it replays.
 * The scene logic below is written on the original 26s clock; `storyClock`
 * maps the faster timeline onto it.
 * Decorative only — no data. Reduced motion shows a still of the drone show.
 */
const STORY = 17;
const PAUSE = 3;
/** Faster timeline (seconds) → the 26s clock the scene logic uses. */
const KEYS: [number, number][] = [[0, 0], [1, 3], [3, 7], [4, 9], [6.5, 12.5], [7.5, 14], [9.5, 17], [14.5, 23], [16, 25], [17, 26]];
function storyClock(t: number) {
  for (let i = 1; i < KEYS.length; i++) {
    const [a, oa] = KEYS[i - 1], [b, ob] = KEYS[i];
    if (t <= b) return oa + ((t - a) / (b - a)) * (ob - oa);
  }
  return 26;
}

/** Mothership, 24×9: # hull, h hull light, c canopy, l running lights, e engines. */
const MOTHERSHIP = [
  "..........####..........",
  "........##cccc##........",
  "......##cccccccc##......",
  "..####################..",
  "##hhhhhhhhhhhhhhhhhhhh##",
  "#llllllllllllllllllllll#",
  ".##hhhhhhhhhhhhhhhhhh##.",
  "...####..........####...",
  "....ee............ee....",
];
const MILKY = ["#2b2f52", "#3b3767", "#4f4a86", "#6a6bb0", "#9aa3d6", "#c8d3f0"];
const LOOP = STORY + PAUSE;

const WH = 300; // world rows (two screens)
const GROUND = WH - 20;
const STAR = ["#4b6069", "#a3b3b9", "#edf2f3", "#b3d6e2"];
const DRONE = "#b3d6e2";
const INK = "#edf2f3";

/** 5×7 bitmap glyphs for the drone messages. */
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
  " ": [],
};


type Star = { x: number; y: number; c: number; p: number };
type Ship = { x: number; y: number; v: number; kind: 0 | 1 | 2 };
type Drone = { sx: number; sy: number; a: [number, number] | null; b: [number, number] | null; d: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };
type Dust = { x: number; y: number; c: number; a: number };

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function HeroScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rocket = new Image();
    rocket.src = "/brand/mark.png";
    // BIT himself (the logo without the rocket), walking before lift-off
    const bit = new Image();
    bit.src = "/brand/bit.png";

    let W = 320;
    let H = 150; // visible pixel rows — both follow the element so pixels stay square
    let stars: Star[] = [];
    let ships: Ship[] = [];
    let drones: Drone[] = [];
    let sparks: Spark[] = [];
    let milky: Dust[] = [];
    let hillX = 0;
    let raf = 0;
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const hillY = (x: number) => {
      const d = (x - hillX) / 38;
      return Math.round(GROUND - 16 * Math.exp(-d * d));
    };

    function layout() {
      const r = canvas.getBoundingClientRect();
      // One art pixel = P screen pixels, the same on both axes (no squashing on
      // tall phone / Mini App screens). ~150 rows on desktop, ~110 columns on phones.
      const P = Math.max(2, Math.floor(Math.min(r.width / 110, r.height / 150)));
      W = Math.max(60, Math.round(r.width / P));
      H = Math.min(WH - 40, Math.max(60, Math.round(r.height / P)));
      canvas.width = W;
      canvas.height = H;
      ctx.imageSmoothingEnabled = false;
      seed = 42;
      hillX = Math.round(W * (W > 260 ? 0.78 : 0.62));
      stars = Array.from({ length: Math.round((W * WH) / 200) }, () => ({ x: Math.floor(rnd() * W), y: Math.floor(rnd() * (GROUND - 30)), c: Math.floor(rnd() * 3), p: rnd() * 6.28 }));
      // Milky Way: a soft diagonal band of dust and dense stars across the sky
      milky = Array.from({ length: Math.round(W * 7) }, () => {
        const u = rnd();
        const g = (rnd() + rnd() + rnd() - 1.5) / 1.5; // ~gaussian spread across the band
        const core = 1 - Math.abs(g);
        return { x: Math.floor(u * (W + 40) - 20), y: Math.floor(lerp(GROUND - 70, -10, u) + g * 22), c: Math.min(5, Math.floor(core * core * 6 * rnd() + rnd() * 1.5)), a: 0.18 + core * 0.5 * rnd() };
      });
      ships = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * W, y: 12 + rnd() * 150, v: (3 + rnd() * 7) * (i % 2 ? -1 : 1), kind: (i % 3) as Ship["kind"] }));
      const one = W > 330;
      const a = glyphs(one ? ["BELIEVE IN TON"] : ["BELIEVE", "IN TON"]);
      drones = a.map((p) => ({ sx: hillX + (rnd() - 0.5) * 60, sy: GROUND + 4 + rnd() * 20, a: p, b: null, d: rnd() * 1.2 }));
    }

    /** World positions of lit font cells, centred in the upper sky. */
    function glyphs(lines: string[], want = 2): [number, number][] {
      const cols = Math.max(...lines.map((l) => l.length)) * 6 - 1;
      const sp = cols * want + 12 <= W ? want : cols * 2 + 12 <= W ? 2 : 1;
      const cx = Math.min(W - (cols * sp) / 2 - 6, Math.max((cols * sp) / 2 + 6, W * (W > 330 ? 0.66 : 0.5)));
      const ox = Math.round(cx - (cols * sp) / 2);
      const out: [number, number][] = [];
      lines.forEach((line, li) => {
        const lx = ((Math.max(...lines.map((l) => l.length)) - line.length) * 6) / 2;
        [...line].forEach((ch, ci) =>
          (FONT[ch] ?? []).forEach((row, ry) => {
            for (let rx = 0; rx < 5; rx++) if (row[rx] === "#") out.push([ox + (lx + ci * 6 + rx) * sp, 14 + (li * 9 + ry) * sp]);
          }),
        );
      });
      return out;
    }

    let camY = GROUND - H + 20; // world row at the top of the view
    const px = (x: number, y: number, c: string, w = 1, h = 1) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y - camY), w, h);
    };

    /** A pixel moon with craters and a faint halo, slow parallax against the stars. */
    function drawMoon(t: number) {
      const R = W > 200 ? 11 : 8;
      const cx = Math.round(W > 330 ? W - R - 18 : W * 0.8); // the open right side, clear of the headline
      // far away, so it barely moves when the camera pans: in view from the hill and from the sky
      // (lower on narrow screens, where BELIEVE IN TON fills the top rows)
      const cy = Math.round(camY * 0.9 + R + (W > 330 ? 36 : 56));
      if (cy + R + 4 < camY || cy - R - 4 > camY + H) return;
      ctx.globalAlpha = 0.07 + 0.02 * Math.sin(t);
      for (let r = R + 6; r > R; r -= 2) for (let y = -r; y <= r; y++) {
        const w = Math.round(Math.sqrt(r * r - y * y));
        px(cx - w, cy + y, "#b3d6e2", w * 2 + 1, 1);
      }
      ctx.globalAlpha = 1;
      for (let y = -R; y <= R; y++) {
        const w = Math.round(Math.sqrt(R * R - y * y));
        for (let x = -w; x <= w; x++) {
          const lit = x - y * 0.3 > -R * 0.35; // terminator: the lower-left limb in shadow
          const crater = (x - 3) ** 2 + (y + 2) ** 2 < 6 || (x + 4) ** 2 + (y - 4) ** 2 < 4 || (x + 1) ** 2 + (y + 6) ** 2 < 2 || (x - 5) ** 2 + (y - 5) ** 2 < 2;
          px(cx + x, cy + y, crater ? (lit ? "#b9c4c7" : "#5d6a6e") : lit ? "#e7eef0" : "#8a979b");
        }
      }
    }

    /** A big mothership cruising slowly across the upper sky, lights chasing. */
    function drawMothership(t: number, lt: number) {
      const S = W > 200 ? 2 : 1; // big: two art pixels per cell on wider screens
      const sw = MOTHERSHIP[0].length * S;
      // crosses once per loop, timed to be on screen for the sky sweep and the drone show
      const x = Math.round(-sw + (W + sw * 2) * ((lt + 3) / (LOOP + 3)));
      const y = 118; // below the moon and the hovering rocket
      if (y + 10 * S + 8 < camY || y - 2 > camY + H) return;
      const chase = Math.floor(t * 8);
      MOTHERSHIP.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === ".") continue;
          const c = ch === "#" ? "#4b6069" : ch === "h" ? "#8a9ca2" : ch === "c" ? "#8cbfd1" : ch === "l" ? ((rx + chase) % 4 === 0 ? "#f5c518" : "#2a3c43") : (rx + chase) % 2 ? "#e5484d" : "#f5c518";
          px(x + rx * S, y + ry * S, c, S, S);
        }
      });
      // engine glow trailing behind (it flies left to right)
      for (let i = 1; i < 7 * S; i++) {
        ctx.globalAlpha = 0.5 * (1 - i / (7 * S));
        px(x + 4 * S - i, y + 8 * S, "#e5484d", 1, S);
        px(x + 18 * S - i, y + 8 * S, "#e5484d", 1, S);
      }
      ctx.globalAlpha = 1;
    }

    function drawShip(s: Ship, t: number) {
      const x = ((((s.x + s.v * t) % (W + 40)) + W + 40) % (W + 40)) - 20;
      const dir = s.v > 0 ? 1 : -1;
      if (s.kind === 0) {
        px(x, s.y, "#a3b3b9", 3, 1);
        px(x + (dir > 0 ? 3 : -1), s.y, INK);
        for (let i = 1; i < 6; i++) if ((i + Math.floor(t * 10)) % 2) px(x - dir * (i + 1), s.y, i < 3 ? "#d6a64a" : "#2a3c43");
      } else if (s.kind === 1) {
        px(x - 2, s.y, "#6c7f86", 5, 1);
        px(x - 1, s.y - 1, "#b3d6e2", 3, 1);
        if (Math.floor(t * 4) % 2) px(x, s.y + 1, "#8cbfd1");
      } else {
        px(x, s.y, "#4b6069", 2, 1);
        px(x - dir, s.y, "#2a3c43");
      }
    }

    /**
     * BIT on foot at (x, feet y): the logo mascot without its rocket, tilted
     * upright. look: 0 = walking right (bob + rock), 1 = gazing up.
     */
    function drawBit(x: number, y: number, look: number, step: number, hop = 0) {
      if (!bit.complete || !bit.naturalWidth) return;
      const h = 24;
      const w = Math.round((h * bit.naturalWidth) / bit.naturalHeight);
      const bob = look ? 0 : step % 2;
      const tilt = look ? -0.12 : 0.28 + (step % 2 ? 0.05 : -0.05); // radians: upright-ish while walking, leaning back to look up
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y - camY - hop - bob));
      ctx.rotate(tilt);
      ctx.drawImage(bit, -Math.round(w / 2), -h, w, h);
      ctx.restore();
    }

    function frame(now: number) {
      // the story, then a quiet hold on the opening frame before it starts again
      const lt = (now / 1000) % LOOP;
      const t = reduce ? 21.5 : storyClock(lt < STORY ? lt : 0);
      const sec = now / 1000;

      // ── camera ───────────────────────────────────────────────────────
      const ground = GROUND - H + 20;
      const startX = hillX - Math.min(48, W * 0.2);
      let mx = startX;
      let my = hillY(startX);
      let mode: "walker" | "rocket" | "gone" = "walker";
      let look = 1;
      let step = 0;
      let hop = 0;

      if (t < 3) {
        look = 1;
      } else if (t < 7) {
        const k = (t - 3) / 4;
        mx = lerp(startX, hillX, k);
        my = hillY(mx);
        look = 0;
        step = Math.floor(sec / 0.09);
      } else if (t < 12.5) {
        mx = hillX;
        my = hillY(hillX);
        look = 1;
      } else if (t < 14) {
        mx = hillX;
        my = hillY(hillX);
        hop = t < 13 ? Math.round(4 * Math.sin(((t - 12.5) / 0.5) * Math.PI)) : 0;
        mode = t < 13 ? "walker" : "rocket";
      } else if (t < 23) {
        mode = "rocket";
        const k = seg(t, 14, 17);
        mx = hillX + k * 16;
        my = lerp(hillY(hillX), 96, k) + (k >= 1 ? Math.sin(sec * 3) * 1.5 : 0);
      } else if (t < 25) {
        mode = "rocket";
        const k = seg(t, 23, 24.8);
        mx = hillX + 16 + k * (W - hillX + 60);
        my = 96 - k * 150;
      } else {
        mode = "gone";
      }

      const sky = 0;
      if (t < 9) camY = ground;
      else if (t < 12.5) camY = t < 10.5 ? lerp(ground, sky, seg(t, 9, 10.5)) : t < 11.2 ? sky : lerp(sky, ground, seg(t, 11.2, 12.5));
      else if (t < 14) camY = ground;
      else if (t < 17) camY = Math.max(sky, Math.min(ground, my - 90));
      else if (t < 25) camY = sky;
      else camY = lerp(sky, ground, seg(t, 25, 26));
      if (reduce) camY = sky;
      camY = Math.round(camY);

      // ── sky, stars, ships ─────────────────────────────────────────────
      const g = ctx.createLinearGradient(0, -camY, 0, WH - camY);
      g.addColorStop(0, "#04090b");
      g.addColorStop(0.55, "#081519");
      g.addColorStop(1, "#11272e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const d of milky) {
        if (d.y < camY - 1 || d.y > camY + H) continue;
        ctx.globalAlpha = d.a;
        px(d.x, d.y, MILKY[d.c]);
      }
      ctx.globalAlpha = 1;
      drawMoon(sec);
      drawMothership(sec, reduce ? 12 : lt);
      for (const s of stars) {
        if (s.y < camY - 1 || s.y > camY + H) continue;
        const tw = Math.sin(s.p + sec * 2);
        px(s.x, s.y, STAR[tw > 0.85 ? 2 : s.c]);
        if (tw > 0.97) {
          px(s.x - 1, s.y, STAR[0]);
          px(s.x + 1, s.y, STAR[0]);
        }
      }
      for (const s of ships) drawShip(s, sec);
      // shooting star while stargazing
      if (t > 0.8 && t < 2.6) {
        const k = (t - 0.8) / 1.8;
        const sx = W * 0.15 + k * W * 0.5;
        const sy = camY + 14 + k * 30;
        for (let i = 0; i < 8; i++) {
          ctx.globalAlpha = (1 - i / 8) * (1 - k * 0.5);
          px(sx - i * 2, sy - i * 0.6, i ? "#a3b3b9" : INK);
        }
        ctx.globalAlpha = 1;
      }

      // ── hills ─────────────────────────────────────────────────────────
      for (let x = 0; x < W; x++) px(x, Math.round(GROUND + 6 - 5 * Math.sin(x / 23) - 3 * Math.sin(x / 7)), "#0d1d22", 1, 40);
      for (let x = 0; x < W; x++) px(x, hillY(x), "#132a31", 1, 40);

      // ── drone show ────────────────────────────────────────────────────
      if (t > 16.5 && t < 25.5) {
        const scatter = seg(t, 23.5, 25.3);
        const toB = 0; // one message only: BELIEVE IN TON
        for (const d of drones) {
          const k = ease((t - 17 - d.d) / 2.2);
          if (k <= 0) continue;
          const A = d.a ?? d.b!;
          const B = d.b ?? [d.a![0], -20];
          let x = lerp(d.sx, A[0], k);
          let y = lerp(d.sy, A[1], k);
          if (toB > 0) {
            x = lerp(x, B[0], toB);
            y = lerp(y, B[1], toB);
          }
          if (scatter > 0) {
            x += (x - hillX) * 0.5 * scatter;
            y -= (20 + d.d * 30) * scatter;
          }
          const inA = !!d.a;
          const inB = !!d.b;
          const vis = toB > 0 ? (inB ? 1 : 1 - toB) : inA ? 1 : 0;
          const a = vis * (1 - scatter) * (k < 1 ? 0.8 : 0.9 + 0.1 * Math.sin(sec * 5 + d.sx));
          if (a <= 0.02) continue;
          ctx.globalAlpha = a * 0.3;
          px(x - 1, y, DRONE, 3, 1);
          px(x, y - 1, DRONE, 1, 3);
          ctx.globalAlpha = a;
          px(x, y, k >= 1 ? "#ffffff" : DRONE);
        }
        ctx.globalAlpha = 1;
      }

      // ── mascot ────────────────────────────────────────────────────────
      if (mode === "walker") {
        const fade = !reduce && lt >= STORY ? seg(lt, STORY, STORY + 1) : 1; // BIT fades back in at the start of the pause
        ctx.globalAlpha = fade;
        drawBit(mx, my, look, step, hop);
        ctx.globalAlpha = 1;
        // "!" when it notices the sky
        if (t > 7.3 && t < 9 && Math.floor(sec * 4) % 4 !== 0) {
          px(mx + 12, my - 36, INK, 2, 5);
          px(mx + 12, my - 29, INK, 2, 2);
        }
      } else if (mode === "rocket") {
        const size = 28;
        const w = Math.round((size * 720) / 567);
        const shake = t < 14.6 ? Math.round(Math.sin(sec * 60)) : 0;
        const dx = mx - w / 2 + shake;
        const dy = my - size;
        if (!reduce) for (let i = 0; i < 3; i++) sparks.push({ x: dx + 5, y: dy + size - 4, vx: -0.6 - Math.random() * 0.8, vy: 0.6 + Math.random() * 1.2, life: 1 });
        if (rocket.complete && rocket.naturalWidth) ctx.drawImage(rocket, Math.round(dx), Math.round(dy - camY), w, size);
      }
      sparks = sparks.filter((s) => (s.life -= 0.035) > 0);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        px(s.x, s.y, s.life > 0.7 ? INK : s.life > 0.4 ? "#d6a64a" : "#4b6069");
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(canvas);
    rocket.onload = () => reduce && frame(0);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full [image-rendering:pixelated]" />;
}
