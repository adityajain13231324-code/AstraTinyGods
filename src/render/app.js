import { Application, Graphics, Container, Text } from "pixi.js";
import { colors, factions, symbols, T } from "../config/tunables.js";
import { drawMap } from "./map.js";
const ink = "#373d34";
function body(g, v) {
  const dead = v.hp <= 0,
    c = dead ? "#adae9b" : colors[v.faction];
  g.clear();
  if (dead) {
    g.roundRect(-6, -7, 12, 14, 4).fill(c).stroke({ width: 1.4, color: ink });
    for (const x of [-2.5, 2.5])
      g.moveTo(x - 1, -2)
        .lineTo(x + 1, 0)
        .moveTo(x + 1, -2)
        .lineTo(x - 1, 0)
        .stroke({ color: ink, width: 1 });
    return;
  }
  g.ellipse(0, 8, 9, 3).fill({ color: "#39412d", alpha: 0.23 });
  if (v.shape === 0) g.circle(0, 0, 8);
  else if (v.shape === 1) g.roundRect(-8, -8, 16, 16, 3);
  else if (v.shape === 2) g.poly([0, -10, 10, 7, -10, 7]);
  else g.poly([-8, -4, 0, -9, 8, -4, 8, 5, 0, 9, -8, 5]);
  g.fill(c).stroke({ width: 1.6, color: ink });
  if (v.faction === 0)
    g.poly([-6, -8, 0, -15, 5, -8]).fill(c).stroke({ width: 1, color: ink });
  if (v.faction === 1)
    g.moveTo(-5, -9)
      .quadraticCurveTo(-2, -13, 1, -10)
      .lineTo(5, -12)
      .stroke({ width: 2, color: ink });
  if (v.faction === 2)
    g.ellipse(2, -10, 5, 2.7).fill("#54845c").stroke({ width: 1, color: ink });
  if (v.faction === 3)
    g.star(0, -10, 5, 5, 2.4).fill("#ffdf86").stroke({ width: 1, color: ink });
  const happy = ["hug", "socialize"].includes(v.state),
    angry = v.state === "attack",
    scared = v.state === "flee";
  for (const x of [-3, 3]) {
    if (v.state === "hug")
      g.poly([
        x,
        -0.4,
        x - 2,
        -2,
        x - 1,
        -3.1,
        x,
        -2.5,
        x + 1,
        -3.1,
        x + 2,
        -2,
      ]).fill("#974945");
    else if (v.thought === "?") {
      g.circle(x + 1, -1, 1.2).fill(ink);
      if (x > 0)
        g.moveTo(x - 2, -4)
          .lineTo(x + 2, -5)
          .stroke({ color: ink, width: 1 });
    } else g.circle(x, -1, 1.3).fill(ink);
    if (angry)
      g.moveTo(x - 2, -4)
        .lineTo(x + 2, -3 + Math.sign(x) * -1)
        .stroke({ color: ink, width: 1 });
  }
  if (scared) g.circle(0, 3, 1.5).fill(ink);
  else
    g.moveTo(-2, 3)
      .quadraticCurveTo(0, happy ? 7 : 4, 2, 3)
      .stroke({ color: ink, width: 1 });
}
export async function renderer(select) {
  const el = document.querySelector("#town");
  el.innerHTML = drawMap();
  const app = new Application();
  await app.init({
    width: T.width,
    height: T.height,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(devicePixelRatio, 2),
    preference: "webgl",
  });
  el.append(app.canvas);
  const layer = new Container(),
    lines = new Graphics(),
    effects = new Graphics();
  app.stage.addChild(lines, layer, effects);
  const particles = Array.from({ length: 72 }, () => ({ life: 0 }));
  let slot = 0;
  function burst(v, color, count) {
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      Object.assign(particles[slot++ % particles.length], {
        x: v.x,
        y: v.y,
        dx: Math.cos(a) * 20,
        dy: Math.sin(a) * 16 - 8,
        life: 0.6,
        color,
      });
    }
  }
  let nodes = [],
    selected = -1,
    focus = null;
  function inspectAt(e) {
    const b = app.canvas.getBoundingClientRect(),
      x = ((e.clientX - b.left) / b.width) * T.width,
      y = ((e.clientY - b.top) / b.height) * T.height;
    let best = nodes
      .map((n) => [Math.hypot(x - n.c.x, y - n.c.y), n.id])
      .sort((a, b) => a[0] - b[0])[0];
    selected = best && best[0] < 25 ? best[1] : -1;
    select(selected);
  }
  el.onpointerdown = inspectAt;
  el.onpointermove = (e) => {
    if (e.pointerType === "mouse") inspectAt(e);
  };
  return {
    focus(e) {
      focus = e ? { ...e, until: performance.now() + 1800 } : null;
    },
    draw(list, dt) {
      const active = focus && performance.now() < focus.until;
      for (const surface of el.children) {
        surface.style.transformOrigin = active
          ? (focus.x / T.width) * 100 + "% " + (focus.y / T.height) * 100 + "%"
          : "center";
        surface.style.transform = active ? "scale(1.18)" : "scale(1)";
      }
      lines.clear();
      effects.clear();
      const now = performance.now() / 1000;
      for (const v of list) {
        let n = nodes[v.id];
        if (!n) {
          const c = new Container(),
            g = new Graphics(),
            t = new Text({
              text: "",
              style: {
                fontSize: 13,
                fontWeight: "bold",
                fill: ink,
                stroke: { color: "#fff4d8", width: 3 },
              },
            });
          t.anchor.set(0.5, 1);
          t.y = -14;
          c.addChild(g, t);
          layer.addChild(c);
          n = nodes[v.id] = { c, g, t, id: v.id, key: "" };
          c.position.set(v.x, v.y);
        }
        if (n.lastHp !== undefined && n.lastHp > v.hp) {
          n.flash = now + 0.14;
          burst(v, v.hp <= 0 ? "#faf3d5" : "#df976d", v.hp <= 0 ? 9 : 4);
        }
        if (v.state === "hug" && n.lastState !== "hug") burst(v, "#d78786", 3);
        n.lastHp = v.hp;
        n.lastState = v.state;
        const k = [
          v.hp <= 0,
          v.shape,
          v.faction,
          v.state,
          v.thought === "?",
        ].join();
        if (k !== n.key) {
          body(n.g, v);
          n.key = k;
        }
        n.c.x += (v.x - n.c.x) * Math.min(1, dt * 18);
        n.c.y += (v.y - n.c.y) * Math.min(1, dt * 18);
        n.g.rotation =
          v.hp > 0
            ? Math.sin(now * (v.state === "flee" ? 24 : 6) + v.id) * 0.07
            : 0;
        n.g.scale.y = 1 + (v.hp > 0 ? 0.04 * Math.sin(now * 5 + v.id) : 0);
        n.g.x = v.state === "attack" ? Math.sin(now * 15) * 3 : 0;
        n.g.tint = n.flash > now ? 0xffc9a6 : 0xffffff;
        n.t.text = v.hp > 0 ? v.thought || "" : "";
        n.t.visible =
          v.id === selected || (Boolean(v.thought) && v.id % 3 === 0);
        if (v.id === selected) {
          lines.circle(v.x, v.y, 16).stroke({ width: 2, color: "#fff4d8" });
          for (const b of list) {
            const o = v.op?.[b.faction] ?? 0;
            if (
              b.id !== v.id &&
              b.hp > 0 &&
              Math.abs(o) > 38 &&
              Math.hypot(v.x - b.x, v.y - b.y) < 130
            )
              lines
                .moveTo(v.x, v.y)
                .lineTo(b.x, b.y)
                .stroke({
                  width: 1,
                  color: o < 0 ? "#be664c" : "#528756",
                  alpha: 0.65,
                });
          }
        }
      }
      for (const p of particles)
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.dx * dt;
          p.y += p.dy * dt;
          effects
            .circle(p.x, p.y, Math.max(0.3, p.life * 5))
            .fill({ color: p.color, alpha: Math.max(0, p.life) });
        }
      if (active) {
        lines
          .circle(focus.x, focus.y, 23 + Math.sin(now * 6) * 4)
          .stroke({ color: "#fbf0b5", width: 3 });
      }
    },
  };
}
export function inspect(v) {
  return v
    ? `${symbols[v.faction]} ${v.name} · ${factions[v.faction]} · ${Math.ceil(v.hp)} HP · ${v.weapon} · ${v.state} · ${v.traits?.join(", ") || "traits unknown"}`
    : "Select a villager to inspect their feelings.";
}
