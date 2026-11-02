import test from "node:test";
import assert from "node:assert/strict";
import { Game, blank } from "../src/game.js";
import { world, living } from "../src/sim/world.js";
import { begin, valid, apply, bot } from "../src/sim/orders.js";
import { styles, T } from "../src/config/tunables.js";
import { finish } from "../src/sim/turn.js";
test("trusted neutrals can join a faction at recap", () => {
  const w = world(19);
  begin(w);
  const neutral = w.villagers.find((v) => v.faction === 4);
  neutral.op[2] = T.recruitOpinion;
  neutral.trust[2] = T.recruitTrust;
  neutral.drivers[2] = 2;
  finish(w);
  assert.equal(neutral.faction, 2);
  assert.equal(w.highlights[0].cause, 2);
});
test("seeded town and capped roles", () => {
  for (let seed = 1; seed < 120; seed++) {
    const w = world(seed);
    assert.deepEqual(living(w), [12, 12, 12, 12, 12]);
    for (const [t, n] of Object.entries(T.traitCaps))
      assert.ok(w.villagers.filter((v) => v.traits.includes(t)).length <= n);
    for (let i = 0; i < 4; i++)
      assert.ok(
        w.villagers.filter((v) => v.faction === i && v.weapon === "gun")
          .length <= 2,
      );
  }
  assert.deepEqual(world(12).villagers, world(12).villagers);
});
test("host rejects invalid targets, spending, and repeat submissions", () => {
  const g = new Game(1, [0], styles);
  for (const a of [
    { verb: "Hate", target: "Well", s: 2 },
    { verb: "Follow", target: "Well", s: 4 },
    { verb: "inject", target: "none", s: 1 },
  ])
    assert.equal(g.input(0, "orders", { orders: [a] }), false);
  const a = { verb: "Love", target: "Tides", s: 3 };
  assert.equal(g.input(0, "orders", { orders: [a, a] }), false);
  assert.ok(g.input(0, "orders", blank()));
  assert.equal(g.input(0, "orders", blank()), false);
});
test("ghosts whisper for free and cannot issue orders", () => {
  const w = world(8);
  for (const v of w.villagers.filter((v) => v.faction === 0)) v.hp = 0;
  begin(w);
  assert.ok(
    valid(w, 0, { orders: [], rumor: { verb: "Warn", target: "Tides", s: 2 } }),
  );
  assert.equal(
    valid(w, 0, { orders: [{ verb: "Follow", target: "Well", s: 1 }] }),
    false,
  );
});
test("hidden provenance stays host-side until the reveal", () => {
  const g = new Game(7, [0, 1], styles);
  g.input(0, "orders", {
    orders: [],
    rumor: { verb: "Accuse", target: "Tides", s: 1 },
  });
  g.disconnect(1);
  g.advance(0.05);
  assert.equal(g.phase, "Simulation");
  const snapshot = g.view(1);
  assert.equal(snapshot.end, null);
  assert.ok(snapshot.events.length);
  assert.ok(snapshot.events.every((e) => !("cause" in e)));
  assert.equal(snapshot.people.find((v) => v.faction === 0).traits.length, 0);
});
test("full game including timed defaults and rematchable ending", () => {
  const g = new Game(33, [0], styles);
  g.speed = 4;
  for (let n = 0; n < 10000 && g.phase !== "End"; n++) g.advance(0.25);
  assert.equal(g.phase, "End");
  const end = g.view(0).end;
  assert.ok(end.win >= 0 && end.win < 4);
  assert.equal(end.history.length, g.w.turn * 4);
  assert.equal(end.rounds.length, g.w.turn);
});
test("all bots submit legal orders", () => {
  for (let seed = 0; seed < 30; seed++) {
    const w = world(seed);
    begin(w);
    for (let i = 0; i < 4; i++)
      for (const style of styles) assert.ok(valid(w, i, bot(w, i, style)));
  }
});
