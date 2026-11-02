import { T, verbs, rumors, places, factions } from "../config/tunables.js";
import { clamp, living, pick, shuffle } from "./world.js";
export function targets(verb) {
  if (verb === "Arm up" || verb === "Peace talk") return ["none"];
  if (verb === "Follow") return places.map((p) => p[0]);
  if (["Protect", "Avoid"].includes(verb))
    return [...factions, ...places.map((p) => p[0])];
  return factions;
}
export function begin(w) {
  w.turn++;
  w.events = [];
  w.time = 0;
  w.tick = 0;
  const count = living(w);
  w.budget = w.carry.map((n, i) =>
    count[i]
      ? T.influence +
        n +
        w.bonus[i] +
        (count[i] < count.slice(0, 4).reduce((a, b) => a + b) / 8
          ? T.comeback
          : 0)
      : 0,
  );
  w.bonus.fill(0);
  for (const v of w.villagers) {
    v.fx = [];
    v.hitTime = -100;
    v.cool = 0;
    v.cause = null;
    v.drivers = {};
    v.wait = 0;
    if (w.turn >= T.suddenTurn) {
      v.agg = clamp(v.agg + T.tensionAgg, 0, 100);
      v.courage = clamp(v.courage - T.tensionCourage, 0, 100);
      for (let i = 0; i < 4; i++)
        if (i !== v.faction) v.op[i] = Math.max(-100, v.op[i] - T.opinion);
    }
  }
}
export function valid(w, seat, packet) {
  if (
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= 4 ||
    !packet ||
    !Array.isArray(packet.orders) ||
    packet.orders.length > T.orderLimit
  )
    return false;
  const ghost = !living(w)[seat],
    items = [...packet.orders, ...(packet.rumor ? [packet.rumor] : [])];
  if (ghost && packet.orders.length) return false;
  return (
    items.every(
      (a, i) =>
        a &&
        typeof a === "object" &&
        (i < packet.orders.length ? verbs : rumors).includes(a.verb) &&
        targets(a.verb).includes(a.target) &&
        Number.isInteger(a.s) &&
        a.s >= 1 &&
        a.s <= (i < packet.orders.length ? 3 : 2),
    ) &&
    (ghost || items.reduce((n, a) => n + a.s, 0) <= w.budget[seat])
  );
}
export function event(w, v, text, score, cause = null, type = "news") {
  const e = {
    id: w.events.length,
    text,
    x: v.x,
    y: v.y,
    score,
    cause,
    type,
    tick: w.tick,
  };
  w.events.push(e);
  return e;
}
function believe(w, v, r) {
  if (r.heard.has(v.id) || v.hp <= 0) return;
  r.heard.add(v.id);
  const p = clamp(
    v.trust[r.seat] +
      T.beliefBase +
      (v.traits.includes("Gullible") - v.traits.includes("Skeptic")) *
        T.traitBelief,
    0.05,
    0.95,
  );
  if (w.r() > p) return;
  r.spread.add(v.id);
  w.beliefs++;
  let i = factions.indexOf(r.target);
  if (r.verb === "Peace talk")
    v.agg = clamp(v.agg - T.rumorShift * r.s, 0, 100);
  else if (r.verb === "Warn")
    v.fear[i] = clamp(v.fear[i] + T.rumorShift * r.s, 0, 100);
  else {
    v.op[i] = clamp(
      v.op[i] + (r.verb === "Accuse" ? -1 : 1) * T.rumorShift * r.s,
      -100,
      100,
    );
    v.drivers[i] = r.seat;
  }
  v.thought = "?";
}
export function spread(w) {
  w.rumors = w.rumors.filter((r) => w.turn - r.start < 2);
  for (const r of w.rumors) {
    for (const id of [...r.spread]) {
      const v = w.villagers[id];
      if (
        !v.hp ||
        w.r() > (v.traits.includes("Gossip") ? T.gossipChance : T.repeatChance)
      )
        continue;
      for (const b of w.villagers)
        if (
          !r.heard.has(b.id) &&
          Math.hypot(v.x - b.x, v.y - b.y) < T.gossipRadius
        )
          believe(w, b, r);
    }
  }
}
export function apply(w, seat, packet) {
  if (!valid(w, seat, packet)) throw Error("Invalid secret orders");
  const { orders, rumor } = packet;
  w.history.push({ turn: w.turn, seat, orders, rumor });
  w.carry[seat] = Math.min(
    T.carry,
    Math.max(
      0,
      w.budget[seat] - orders.reduce((n, a) => n + a.s, 0) - (rumor?.s || 0),
    ),
  );
  for (const a of orders)
    for (const v of w.villagers) {
      if (!v.hp || (v.faction !== seat && v.faction !== 4)) continue;
      const s = a.s * (v.faction === 4 ? v.trust[seat] : 1),
        i = factions.indexOf(a.target);
      v.fx.push({ ...a, s, seat });
      if (a.verb === "Hate" || a.verb === "Love") {
        let sign = a.verb === "Love" ? 1 : -1;
        v.op[i] = clamp(v.op[i] + sign * T.opinion * s, -100, 100);
        v.agg = clamp(
          v.agg - sign * (sign === 1 ? T.loveCalm : T.hateAgg) * s,
          0,
          100,
        );
        v.drivers[i] = seat;
        if (v.faction === 4 && sign * v.op[i] > 0)
          v.trust[seat] = clamp(v.trust[seat] + 0.015, 0, 1);
      }
      if (a.verb === "Fear")
        v.fear[i] = clamp(v.fear[i] + T.opinion * s, 0, 100);
      if (a.verb === "Arm up" && v.weapon !== "none") {
        v.agg = clamp(v.agg + 5 * s, 0, 100);
        if (v.weapon === "gun") v.ammo = Math.min(T.gunAmmo, v.ammo + 1);
      }
    }
  if (rumor) {
    if (rumor.verb === "Peace talk")
      w.rumors = w.rumors.filter((r) => r.s >= rumor.s);
    const v =
      pick(
        w.r,
        w.villagers.filter((v) => v.hp && v.faction === 4),
      ) || w.villagers.find((v) => v.hp);
    if (v) {
      const r = {
        ...rumor,
        seat,
        start: w.turn,
        spread: new Set([v.id]),
        heard: new Set(),
      };
      w.rumors.push(r);
      believe(w, v, r);
      event(
        w,
        v,
        `A whisper near ${v.name}: ${r.verb.toLowerCase()} ${r.target === "none" ? "in the town" : r.target}.`,
        3,
        seat,
        "rumor",
      );
    }
  }
}
export function bot(w, seat, style) {
  const count = living(w),
    others = [0, 1, 2, 3].filter((i) => i !== seat && count[i]);
  if (!count[seat])
    return {
      orders: [],
      rumor: { verb: "Warn", target: factions[pick(w.r, others) ?? 0], s: 1 },
    };
  const strong = shuffle(w.r, others).sort((a, b) => count[b] - count[a]),
    i = (style === "Opportunist" ? strong.at(-1) : strong[0]) ?? seat,
    target = factions[i];
  const orders = [],
    add = (verb, target, s) => orders.push({ verb, target, s });
  if (style === "Pacifist") {
    add("Love", target, 2);
    add("Protect", factions[seat], 2);
  } else if (style === "Gossip") {
    add("Avoid", target, 1);
    add("Follow", "Market", 1);
  } else if (style === "Chaos") {
    for (let j = 0; j < 2; j++) {
      const v = pick(w.r, verbs);
      add(v, pick(w.r, targets(v)), 1 + Math.floor(w.r() * 2));
    }
  } else {
    add("Hate", target, 3);
    add("Arm up", "none", 1);
  }
  return {
    orders,
    rumor: {
      verb: style === "Pacifist" ? "Praise" : "Accuse",
      target,
      s: style === "Gossip" ? 2 : 1,
    },
  };
}
