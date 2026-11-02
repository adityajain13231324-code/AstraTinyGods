import { T, places, traits } from "../config/tunables.js";
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function random(seed) {
  return () => {
    let n = (seed += 0x6d2b79f5);
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export function shuffle(r, list) {
  for (let i = list.length - 1; i > 0; i--) {
    let j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
const names = "Pip Miso Fig Dot Rue Moss Wren Basil Fern Otto Luna Peach".split(
  " ",
);
const surnames = ["Thistle", "Puddle", "Clover", "Crumb", "Button"];
export function world(seed) {
  const r = random(seed),
    villagers = [],
    caps = {};
  const weapons = shuffle(r, [
    ...Object.entries(T.weapons).flatMap(([w, n]) => Array(n).fill(w)),
    ...Array(30).fill("none"),
  ]);
  for (let id = 0; id < T.group * 5; id++) {
    const faction = Math.floor(id / T.group),
      ts = [];
    for (let j = 0, count = 1 + Math.floor(r() * 2); j < count; j++) {
      const t = pick(
        r,
        traits.filter(
          (k) =>
            !ts.includes(k) && (caps[k] || 0) < (T.traitCaps[k] ?? Infinity),
        ),
      );
      ts.push(t);
      caps[t] = (caps[t] || 0) + 1;
    }
    if (
      weapons[id] === "gun" &&
      villagers.filter((v) => v.faction === faction && v.weapon === "gun")
        .length >= 2
    ) {
      const j = weapons.findIndex((w, k) => k > id && w !== "gun");
      if (j >= 0) [weapons[id], weapons[j]] = [weapons[j], weapons[id]];
    }
    villagers.push({
      id,
      name: names[id % 12] + " " + surnames[faction],
      faction,
      shape: Math.floor(r() * 4),
      x: 30 + r() * (T.width - 60),
      y: 40 + r() * (T.height - 80),
      hp: T.hp,
      courage: clamp(35 + r() * 40 - (ts.includes("Coward") ? 25 : 0), 0, 100),
      agg: 25 + r() * 30 + (ts.includes("Hothead") ? 25 : 0),
      mood: 0,
      op: Array.from({ length: 5 }, (_, i) => (i === faction ? 60 : r() * 10)),
      fear: Array(5).fill(0),
      trust: Array(4).fill(T.trust),
      traits: ts,
      weapon: weapons[id],
      ammo: T.gunAmmo,
      fx: [],
      state: "wander",
      thought: "",
      dx: 0,
      dy: 0,
      wait: 0,
      panic: 0,
      cause: null,
      lastHit: -1,
      hitTime: -100,
    });
  }
  return {
    r,
    seed,
    villagers,
    turn: 0,
    tick: 0,
    time: 0,
    armory: T.armory,
    events: [],
    history: [],
    rumors: [],
    points: [0, 0, 0, 0],
    bonus: [0, 0, 0, 0],
    carry: [0, 0, 0, 0],
    budget: [],
    tension: 0,
    beliefs: 0,
  };
}
export function living(w) {
  return Array.from(
    { length: 5 },
    (_, i) => w.villagers.filter((v) => v.hp > 0 && v.faction === i).length,
  );
}
export function wander(w, v) {
  const [, x, y] = pick(w.r, places);
  v.dx = x + (w.r() - 0.5) * 115;
  v.dy = y + (w.r() - 0.5) * 90;
  v.state = "wander";
  v.thought = "";
}
export function move(v, dt) {
  const x = v.dx - v.x,
    y = v.dy - v.y,
    d = Math.hypot(x, y);
  if (!d) return;
  const step = Math.min(
    d,
    dt * (["flee", "attack", "protect"].includes(v.state) ? T.run : T.walk),
  );
  v.x = clamp(v.x + (x / d) * step, 14, T.width - 14);
  v.y = clamp(v.y + (y / d) * step, 20, T.height - 15);
}
export function peaceful(w, v) {
  if (!v.dx || Math.hypot(v.dx - v.x, v.dy - v.y) < 3) {
    if (w.r() < 0.3) {
      v.state = "socialize";
      v.thought = "♫";
      v.wait = 0.8;
    } else wander(w, v);
  }
}
