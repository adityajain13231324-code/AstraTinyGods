import { factions, places } from "./config/tunables.js";

export function preview(verb, target) {
  const lines = {
    Follow: `Rally at the ${target}. Watch your villagers head for the same landmark.`,
    Hate: `Turn your villagers against the ${target}. Hostile villagers may attack when a target is nearby.`,
    Fear: `Make your villagers fear the ${target}. Look for them running from a close encounter.`,
    Love: `Make your villagers friendlier to the ${target}. Look for hugs when they meet.`,
    Protect: `Send guards toward the ${target}. Nearby guards can intercept attacks.`,
    Avoid: `Give the ${target} a wide berth. Villagers may still defend themselves.`,
    "Arm up": "Send unarmed villagers to the Armory. Supplies are limited.",
    Accuse: `Spread a story against the ${target}. Believers grow more hostile.`,
    Praise: `Spread praise for the ${target}. Believers grow friendlier.`,
    Warn: `Warn that the ${target} are armed. Believers grow more fearful.`,
    "Peace talk": "Spread a call for peace. Believers become less aggressive.",
  };
  return lines[verb];
}

export function scene(v, people) {
  if (!v) return "No living villagers remain in this faction.";
  const who = v.name,
    b = people[v.actionTarget],
    other = b ? b.name + " (" + factions[b.faction] + ")" : v.actionPlace;
  if (!v.hp) return who + " has fallen.";
  if (v.state === "seek") {
    const place = places.find((p) => p[0] === v.actionPlace);
    if (place && Math.hypot(v.x - place[1], v.y - place[2]) < 44)
      return who + " is at the " + place[0] + ".";
    return (
      who +
      " is heading to the " +
      (v.actionPlace || "town center") +
      (v.reason === "seeking a weapon" ? " for a weapon." : ".")
    );
  }
  if (v.state === "attack")
    return (
      who +
      (v.reason === "fighting back"
        ? " is fighting back against "
        : " is pursuing ") +
      (other || "a rival") +
      " with " +
      (v.weapon === "none" ? "bare fists" : v.weapon) +
      "."
    );
  if (v.state === "flee")
    return v.reason === "startled by gunfire"
      ? who + " is running from gunfire."
      : who + " is backing away from " + (other || "danger") + ".";
  if (v.state === "protect")
    return who + " is guarding " + (other || "the area") + ".";
  if (v.state === "hug")
    return who + " is hugging " + (other || "a neighbor") + ".";
  if (v.state === "socialize")
    return who + " is talking with " + (other || "neighbors") + ".";
  return who + " is wandering between landmarks.";
}

// Count distinct witnesses to an observable outcome. A match is not proof of sole causation.
export function matchesOrder(v, people, order) {
  if (!v.hp) return false;
  const b = people[v.actionTarget],
    target = b ? factions[b.faction] : v.actionPlace;
  if (order.verb === "Arm up") return v.weapon !== "none" && v.startedUnarmed;
  if (order.verb === "Follow") {
    const place = places.find((p) => p[0] === order.target);
    return (
      v.reason === "rallying" &&
      v.actionPlace === order.target &&
      Math.hypot(v.x - place[1], v.y - place[2]) < 44
    );
  }
  const required = {
    Hate: "attack",
    Love: "hug",
    Fear: "flee",
    Protect: "protect",
    Avoid: "flee",
  }[order.verb];
  return (
    v.state === required &&
    target === order.target &&
    (order.verb !== "Avoid" || v.reason === "keeping away") &&
    (order.verb !== "Fear" || v.reason === "afraid")
  );
}
export const observation = {
  Follow: "reached the rally point",
  Hate: "pursued the target",
  Love: "hugged the target",
  Fear: "fled in fear",
  Protect: "stood guard",
  Avoid: "kept their distance",
  "Arm up": "picked up a weapon",
};
