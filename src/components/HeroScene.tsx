"use client";
import { useEffect, useRef } from "react";

/**
 * Pixel-art hero background: a 26s story, drawn at low resolution and scaled
 * up with nearest-neighbour sampling. The world is two screens tall and a
 * camera pans between the ground and the sky.
 *
 *   0–3s    the mascot sits on the hill stargazing; a shooting star passes
 *   3–7s    it walks to the top of the hill
 *   7–9s    stops, looks up — "!"
 *   9–12.5s the view drifts up to the ships in the sky, then back down
 *   12.5–14 it hops into its rocket; the engine rumbles
 *   14–17s  lift-off, the camera follows it up
 *   17–20s  a drone swarm rises and spells BELIEVE IN TON
 *   20–23s  the drones re-form into BITPAD
 *   23–25s  the mascot streaks away, the drones scatter
 *   25–26s  the view settles back on the hill
 * Decorative only — no data. Reduced motion shows a still of the drone show.
 */
const LOOP = 26;
const H = 150; // visible pixel rows
const WH = 300; // world rows (two screens)
const GROUND = WH - 20;
const STAR = ["#4b6069", "#a3b3b9", "#edf2f3", "#b3d6e2"];
const DRONE = "#b3d6e2";
const INK = "#edf2f3";
const EYE = "#0a1215";

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

/** The walking mascot (before it boards the rocket): fluffy body, big eyes. */
const WALKER = [
  "..#..#..#....",
  "...#######...",
  "..#########..",
  ".###########.",
  ".##ee###ee##.",
  ".##ee###ee##.",
  ".###########.",
  "############.",
  ".###########.",
  "..#########..",
  "...#######...",
];
const FEET = ["...##...##...", "..##.....##.."];

type Star = { x: number; y: number; c: number; p: number };
type Ship = { x: number; y: number; v: number; kind: 0 | 1 | 2 };
type Drone = { sx: number; sy: number; a: [number, number] | null; b: [number, number] | null; d: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };

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

    let W = 320;
    let stars: Star[] = [];
    let ships: Ship[] = [];
    let drones: Drone[] = [];
    let sparks: Spark[] = [];
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
      W = Math.max(160, Math.round((H * r.width) / Math.max(1, r.height)));
      canvas.width = W;
      canvas.height = H;
      seed = 42;
      hillX = Math.round(W * (W > 260 ? 0.78 : 0.62));
      stars = Array.from({ length: Math.round((W * WH) / 200) }, () => ({ x: Math.floor(rnd() * W), y: Math.floor(rnd() * (GROUND - 30)), c: Math.floor(rnd() * 3), p: rnd() * 6.28 }));
      ships = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * W, y: 12 + rnd() * 150, v: (3 + rnd() * 7) * (i % 2 ? -1 : 1), kind: (i % 3) as Ship["kind"] }));
      const one = W > 330;
      const a = glyphs(one ? ["BELIEVE IN TON"] : ["BELIEVE", "IN TON"]);
      const b = glyphs(["BITPAD"], 3);
      const n = Math.max(a.length, b.length);
      drones = Array.from({ length: n }, (_, i) => ({ sx: hillX + (rnd() - 0.5) * 60, sy: GROUND + 4 + rnd() * 20, a: a[i] ?? null, b: b[i] ?? null, d: rnd() * 1.2 }));
      // shuffle B targets so drones cross over when the message changes
      for (let i = drones.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [drones[i].b, drones[j].b] = [drones[j].b, drones[i].b];
      }
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

    /** Walker at (x, feet y), 2× scale. look: 0 = right, 1 = up. */
    function drawWalker(x: number, y: number, look: number, step: number, hop = 0) {
      const S = 2;
      const top = y - (WALKER.length + 1) * S - hop;
      const left = x - (WALKER[0].length * S) / 2;
      WALKER.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === ".") continue;
          px(left + rx * S, top + ry * S, ch === "e" ? EYE : INK, S, S);
        }
      });
      // pupils: two per eye block, shifted by gaze
      for (const ex of [3, 8]) {
        const pxX = left + (ex + (look ? 0.5 : 1)) * S;
        const pxY = top + (look ? 4 : 4.6) * S;
        px(pxX, pxY, INK, S, S / 2 + (look ? 0 : 0));
      }
      const feet = hop ? FEET[0] : FEET[step % 2];
      for (let rx = 0; rx < feet.length; rx++) if (feet[rx] === "#") px(left + rx * S, top + WALKER.length * S, "#a3b3b9", S, S);
    }

    function frame(now: number) {
      const t = reduce ? 21.5 : (now / 1000) % LOOP;
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
        step = Math.floor(sec / 0.16);
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
        const toB = seg(t, 20, 21.6);
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
        const fade = t > 25 ? seg(t, 25, 26) : 1;
        ctx.globalAlpha = fade;
        drawWalker(mx, my, look, step, hop);
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
