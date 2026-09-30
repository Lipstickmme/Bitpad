"use client";
import { useEffect, useRef } from "react";

/**
 * Pixel-art hero background, drawn at low resolution and scaled up with
 * nearest-neighbour sampling. A 16s loop:
 *   0–3s   the mascot sits on a hill under a starry sky, ships drift past
 *   3–6s   it lights its rocket and climbs
 *   6–12s  a drone swarm rises and spells BELIEVE IN TON
 *   12–15s the mascot streaks away, the drones scatter and fade
 * Decorative only — no data.
 */
const LOOP = 16;
const H = 150; // internal pixel rows; width follows the element's aspect ratio
const SKY = ["#071014", "#0b1a20", "#10262d"];
const STAR = ["#6c7f86", "#a3b3b9", "#edf2f3", "#b3d6e2"];
const DRONE = "#b3d6e2";

/** 5×7 bitmap glyphs for the drone message. */
const FONT: Record<string, string[]> = {
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  " ": [],
};

type Star ={ x: number; y: number; c: number; p: number };
type Ship = { x: number; y: number; v: number; kind: 0 | 1 | 2 };
type Drone = { sx: number; sy: number; tx: number; ty: number; d: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export function HeroScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mascot = new Image();
    mascot.src = "/brand/mark.png";

    let W = 320;
    let stars: Star[] = [];
    let ships: Ship[] = [];
    let drones: Drone[] = [];
    let sparks: Spark[] = [];
    let hill = { x: 0, y: 0 };
    let raf = 0;
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    function layout() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(160, Math.round((H * r.width) / Math.max(1, r.height)));
      canvas.width = W;
      canvas.height = H;
      seed = 42;
      stars = Array.from({ length: Math.round((W * H) / 190) }, () => ({ x: Math.floor(rnd() * W), y: Math.floor(rnd() * H * 0.85), c: Math.floor(rnd() * 3), p: rnd() * 6.28 }));
      ships = Array.from({ length: 4 }, (_, i) => ({ x: rnd() * W, y: 10 + rnd() * H * 0.45, v: (3 + rnd() * 6) * (i % 2 ? -1 : 1), kind: (i % 3) as Ship["kind"] }));
      // mascot's hill sits in the right third on wide screens, centred-right on narrow ones
      hill = { x: Math.round(W * (W > 260 ? 0.72 : 0.6)), y: H - 22 };
      drones = buildDrones();
    }

    function buildDrones(): Drone[] {
      // One drone per lit cell of a 5×7 pixel font, spaced 2px apart — a dotted, drone-show look
      const lines = W > 330 ? ["BELIEVE IN TON"] : ["BELIEVE", "IN TON"];
      const lit: [number, number][] = [];
      lines.forEach((line, li) => {
        const lx = ((lines[0].length - line.length) * 6) / 2;
        [...line].forEach((ch, ci) => {
          (FONT[ch] ?? []).forEach((row, ry) => {
            for (let rx = 0; rx < 5; rx++) if (row[rx] === "#") lit.push([lx + ci * 6 + rx, li * 9 + ry]);
          });
        });
      });
      const cols = lines[0].length * 6 - 1;
      const sp = cols * 2 + 12 <= W ? 2 : 1; // dotted on wide screens, solid when space is tight
      const textW = cols * sp;
      const cx = Math.min(W - textW / 2 - 6, Math.max(textW / 2 + 6, W * (W > 330 ? 0.68 : 0.5)));
      const ox = Math.round(cx - textW / 2);
      return lit.map(([x, y]) => ({ sx: hill.x + (rnd() - 0.5) * 50, sy: H + 4 + rnd() * 24, tx: ox + x * sp, ty: 12 + y * sp, d: rnd() * 1.2 }));
    }

    function px(x: number, y: number, c: string, w = 1, h = 1) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function drawShip(s: Ship, t: number) {
      const x = ((((s.x + s.v * t) % (W + 40)) + W + 40) % (W + 40)) - 20;
      const dir = s.v > 0 ? 1 : -1;
      if (s.kind === 0) {
        // tiny rocket with a flickering trail
        px(x, s.y, "#a3b3b9", 3, 1);
        px(x + (dir > 0 ? 3 : -1), s.y, "#edf2f3");
        for (let i = 1; i < 6; i++) if ((i + Math.floor(t * 10)) % 2) px(x - dir * (i + 1), s.y, i < 3 ? "#d6a64a" : "#2a3c43");
      } else if (s.kind === 1) {
        // saucer
        px(x - 2, s.y, "#6c7f86", 5, 1);
        px(x - 1, s.y - 1, "#b3d6e2", 3, 1);
        if (Math.floor(t * 4) % 2) px(x, s.y + 1, "#8cbfd1");
      } else {
        // far-off shuttle
        px(x, s.y, "#4b6069", 2, 1);
        px(x - dir, s.y, "#2a3c43");
      }
    }

    function frame(now: number) {
      const t = reduce ? 9 : (now / 1000) % LOOP;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, SKY[0]);
      g.addColorStop(0.6, SKY[1]);
      g.addColorStop(1, SKY[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        const tw = Math.sin(s.p + (now / 1000) * 2);
        px(s.x, s.y, STAR[tw > 0.85 ? 2 : s.c]);
        if (tw > 0.97) {
          px(s.x - 1, s.y, STAR[0]);
          px(s.x + 1, s.y, STAR[0]);
        }
      }
      for (const s of ships) drawShip(s, now / 1000);

      // distant hills
      ctx.fillStyle = "#0d1d22";
      for (let x = 0; x < W; x++) ctx.fillRect(x, Math.round(H - 12 - 5 * Math.sin(x / 23) - 3 * Math.sin(x / 7)), 1, H);
      ctx.fillStyle = "#132a31";
      for (let x = 0; x < W; x++) {
        const d = (x - hill.x) / 34;
        ctx.fillRect(x, Math.round(H - 6 - 16 * Math.exp(-d * d)), 1, H);
      }

      // drone show
      const show = seg(t, 6, 9);
      const scatter = seg(t, 12, 15);
      if (t > 5.5 && t < 15.5) {
        for (const d of drones) {
          const k = ease((t - 6 - d.d) / 2.4);
          if (k <= 0) continue;
          let x = d.sx + (d.tx - d.sx) * k;
          let y = d.sy + (d.ty - d.sy) * k;
          if (scatter > 0) {
            x += (d.tx - hill.x) * 0.6 * scatter;
            y -= (20 + d.d * 30) * scatter;
          }
          const a = (1 - scatter) * (0.6 + 0.4 * show) * (k < 1 ? 0.8 : 0.9 + 0.1 * Math.sin(now / 200 + d.tx * 0.5));
          ctx.globalAlpha = a * 0.3; // soft halo
          px(x - 1, y, DRONE, 3, 1);
          px(x, y - 1, DRONE, 1, 3);
          ctx.globalAlpha = a;
          px(x, y, k >= 1 ? "#ffffff" : DRONE);
        }
        ctx.globalAlpha = 1;
      }

      // mascot: rest → launch → hover → fly away → return
      const size = 28;
      const mw = (size * 720) / 567;
      let mx = hill.x - mw / 2;
      let my = hill.y - size - 1;
      const climb = seg(t, 3, 6);
      const away = seg(t, 12, 14.5);
      const back = seg(t, 15.2, 16);
      my -= climb * H * 0.35 + Math.sin(now / 300) * (climb > 0.99 ? 1.5 : 0.5);
      mx += climb * 14 + away * (W - hill.x + size) * 1.2;
      my -= away * H * 0.9;
      const visible = t < 14.6 || back > 0;
      if (t > 15.2) {
        mx = hill.x - mw / 2;
        my = hill.y - size - 1;
      }
      if (climb > 0 && t < 14.6 && !reduce) {
        for (let i = 0; i < 3; i++) sparks.push({ x: mx + 4, y: my + size - 3, vx: -0.6 - Math.random() * 0.8, vy: 0.6 + Math.random() * 1.2, life: 1 });
      }
      sparks = sparks.filter((s) => (s.life -= 0.035) > 0);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        px(s.x, s.y, s.life > 0.7 ? "#edf2f3" : s.life > 0.4 ? "#d6a64a" : "#4b6069");
      }
      if (visible && mascot.complete && mascot.naturalWidth) {
        ctx.globalAlpha = t > 15.2 ? back : 1;
        ctx.drawImage(mascot, Math.round(mx), Math.round(my), Math.round((size * 720) / 567), size);
        ctx.globalAlpha = 1;
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(canvas);
    mascot.onload = () => reduce && frame(0);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full [image-rendering:pixelated]" />;
}
