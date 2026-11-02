import { T, factions, places } from "../config/tunables.js";
import { clamp, living, move, peaceful, pick, wander } from "./world.js";
import { event, spread } from "./orders.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const nearby = (v, vs) =>
  vs.filter(
    (b) =>
      b !== v &&
      b.hp > 0 &&
      Math.abs(v.x - b.x) < T.panic &&
      Math.abs(v.y - b.y) < T.panic,
  );
function hit(w, a, b, near) {
  if (a.cool > 0) return;
  a.cool = T.attackDelay;
  let weapon = a.weapon === "gun" && !a.ammo ? "none" : a.weapon;
  if (distance(a, b) > T.range[weapon]) return;
  if (weapon === "gun") {
    a.ammo--;
    for (const v of near)
      if (
        distance(a, v) < T.panic &&
        !v.traits.some((t) => ["Hothead", "Sheriff"].includes(t))
      )
        v.panic = 2;
    event(
      w,
      a,
      `${a.name} fires into the air of Littleborough!`,
      5,
      a.drivers[b.faction] ?? null,
      "shot",
    );
  }
  const guard = near.find(
    (v) =>
      v !== b &&
      v !== a &&
      v.state === "protect" &&
      v.guardId === b.id &&
      distance(v, b) < T.guardRadius,
  );
  if (guard) b = guard;
  if (w.r() > clamp(0.5 + (a.courage - b.courage) / 200, 0.15, 0.85)) return;
  b.hitTime = w.time;
  b.lastHit = a.faction;
  let defended = b.fx.find(
    (o) => o.verb === "Protect" && b.state === "protect",
  );
  const alliance = a.op[b.faction] > 40 && b.op[a.faction] > 40 ? 5 : 0;
  b.hp = Math.max(
    0,
    b.hp -
      (T.openingDamage[w.turn - 1] ?? 1) *
        Math.max(
          1,
          T.damage[weapon] +
            a.agg / 20 +
            w.r() * 5 -
            b.courage / 25 -
            (defended ? T.protect * defended.s : 0) -
            alliance,
        ),
  );
  const cause = a.drivers[b.faction] ?? null;
  if (b.hp > 0) {
    if (w.r() < 0.07)
      event(
        w,
        a,
        `${a.name} swings a ${weapon === "none" ? "fist" : weapon} at ${b.name}.`,
        4,
        cause,
        "fight",
      );
    return;
  }
  b.state = "dead";
  b.thought = "";
  event(
    w,
    b,
    `${b.name} falls to ${a.name} (${weapon}).`,
    b.traits.includes("Sheriff") ? 12 : 10,
    cause,
    "kill",
  ).victimFaction = b.faction;
  for (const v of nearby(b, w.villagers))
    if (distance(v, b) < T.witness) {
      if (v.op[b.faction] > 0) {
        v.op[a.faction] = clamp(v.op[a.faction] - 25, -100, 100);
        v.fear[a.faction] = clamp(v.fear[a.faction] + 15, 0, 100);
        delete v.drivers[a.faction];
        if (v.faction === 4 && a.faction < 4)
          v.trust[a.faction] = Math.max(0, v.trust[a.faction] - 0.05);
      } else if (v.op[a.faction] > 0) v.agg = clamp(v.agg + 10, 0, 100);
    }
}
function think(w, v) {
  if (v.traits.includes("Loyal"))
    v.op[v.faction] = Math.max(T.loyalFloor, v.op[v.faction]);
  if (v.traits.includes("Traitor") && v.op[v.faction] < T.betray) {
    let best = v.op.slice(0, 4).indexOf(Math.max(...v.op.slice(0, 4)));
    if (best !== v.faction) {
      v.faction = best;
      event(
        w,
        v,
        `${v.name} defects to ${factions[best]}.`,
        9,
        v.drivers[best] ?? null,
        "betrayal",
      );
    }
  }
  const near = nearby(v, w.villagers),
    sheriff = near.some(
      (b) => b.traits.includes("Sheriff") && distance(v, b) < 75,
    );
  let choice = { score: 2, state: "wander", thought: "" };
  function offer(score, state, thought, b, flee = false) {
    if (score > choice.score) choice = { score, state, thought, b, flee };
  }
  for (const a of v.fx) {
    let place = places.find((p) => p[0] === a.target),
      b = place
        ? { x: place[1], y: place[2] }
        : near
            .filter((b) => factions[b.faction] === a.target)
            .sort((a, b) => distance(v, a) - distance(v, b))[0];
    if (a.verb === "Arm up" && v.weapon === "none" && w.armory) {
      const [, x, y] = places[5];
      offer(30, "seek", "⚒", { x, y });
      if (distance(v, { x, y }) < 30) {
        w.armory--;
        v.weapon = pick(w.r, ["bat", "knife"]);
      }
    }
    if (!b) continue;
    if (a.verb === "Follow") offer(15, "seek", "⚑", b);
    if (a.verb === "Protect") {
      offer(21, "protect", "◇", b);
      v.guardId = b.id;
    }
    if (a.verb === "Avoid" && distance(v, b) < T.avoid)
      offer(49, "flee", "!", b, true);
  }
  for (const b of near) {
    const d = distance(v, b),
      o = v.op[b.faction],
      fear = v.fear[b.faction],
      retaliate = v.lastHit === b.faction && w.time - v.hitTime < 3;
    if (d > T.panic) continue;
    if (v.panic > 0) offer(99, "flee", "!", b, true);
    if (fear > 20 && d < 100)
      offer(fear * 0.58 - v.courage * 0.12, "flee", "!", b, true);
    if (
      (o < T.hostility || retaliate) &&
      !v.traits.includes("Medic") &&
      (!v.traits.includes("Pacifist") || retaliate) &&
      !v.fx.some(
        (a) =>
          a.verb === "Avoid" && a.target === factions[b.faction] && !retaliate,
      ) &&
      v.agg + w.r() * 30 - (sheriff ? 32 : 0) > v.courage * 0.6
    )
      offer(51 + Math.max(-o, 0) * 0.2 - d * 0.08, "attack", "!", b);
    if (o > 35 && d < 38)
      offer(8 + w.r() * 5, "hug", fear > 25 ? "♥?" : "♥", b);
    else if (d < 27) offer(5 + w.r() * 3, "socialize", "♫", b);
  }
  let b = choice.b;
  if (!b) {
    if (v.state !== "wander" && v.state !== "socialize") wander(w, v);
    peaceful(w, v);
    return;
  }
  v.state = choice.state;
  v.thought = choice.thought;
  if (choice.flee) {
    v.dx = clamp(v.x + (v.x - b.x), 15, T.width - 15);
    v.dy = clamp(v.y + (v.y - b.y), 20, T.height - 15);
  } else {
    v.dx = b.x;
    v.dy = b.y;
    if (distance(v, b) < 13 && v.state !== "attack") {
      v.dx = v.x;
      v.dy = v.y;
    }
  }
  if (v.state === "attack") hit(w, v, b, near);
}
export function step(w) {
  w.tick++;
  w.time = w.tick * T.dt;
  const thinkNow = w.tick % Math.round(T.think / T.dt) === 1;
  if (w.tick % Math.round(1 / T.dt) === 0) spread(w);
  for (const v of w.villagers)
    if (v.hp > 0) {
      v.cool -= T.dt;
      v.panic -= T.dt;
      if (thinkNow) think(w, v);
      move(v, T.dt);
    }
  if (thinkNow)
    w.tension = clamp(
      Math.round(
        w.villagers.filter((v) => v.state === "attack" || v.state === "flee")
          .length *
          3 +
          (w.turn - 1) * 4,
      ),
      0,
      100,
    );
}
export function finish(w) {
  for (const v of w.villagers)
    if (v.hp > 0 && v.traits.includes("Medic")) {
      const b = nearby(v, w.villagers)
        .filter((b) => b.hp < T.hp && distance(v, b) < 90)
        .sort((a, b) => a.hp - b.hp)[0];
      if (b) b.hp = Math.min(T.hp, b.hp + T.heal);
    }
  for (const v of w.villagers)
    if (v.hp > 0 && v.faction === 4) {
      const eligible = [0, 1, 2, 3]
        .filter(
          (i) => v.op[i] >= T.recruitOpinion && v.trust[i] >= T.recruitTrust,
        )
        .sort((a, b) => v.op[b] - v.op[a]);
      const seat = eligible[0];
      if (seat !== undefined) {
        v.faction = seat;
        event(
          w,
          v,
          v.name + " pledges allegiance to " + factions[seat] + ".",
          7,
          v.drivers[seat] ?? null,
          "recruit",
        );
      }
    }
  w.highlights = [...w.events].sort((a, b) => b.score - a.score).slice(0, 3);
  if (!w.highlights.length)
    w.highlights = [
      {
        id: -1,
        text: "A quiet afternoon. The Well remains the town’s biggest gossip.",
        x: 180,
        y: 376,
        score: 0,
        cause: null,
        type: "quiet",
      },
    ];
  w.questions = w.highlights.filter((e) => e.cause !== null).slice(0, 2);
}
export function winner(w) {
  const counts = living(w);
  if (w.turn < T.lastTurn && counts.slice(0, 4).filter(Boolean).length > 1)
    return null;
  const hp = [0, 0, 0, 0];
  for (const v of w.villagers) if (v.faction < 4) hp[v.faction] += v.hp;
  return [0, 1, 2, 3].sort(
    (a, b) =>
      counts[b] - counts[a] || hp[b] - hp[a] || w.points[b] - w.points[a],
  )[0];
}
export function score(w, seat, guesses) {
  const n = w.questions.filter((e, i) => guesses[i] === e.cause).length;
  w.points[seat] += n;
  w.bonus[seat] += n;
  return n;
}
