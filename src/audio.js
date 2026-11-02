import { Howl } from "howler";
function tone(hz, seconds, loop = false) {
  const rate = 8000,
    n = Math.floor(rate * seconds),
    buf = new ArrayBuffer(44 + 2 * n),
    v = new DataView(buf);
  const tag = (i, s) =>
    [...s].forEach((c, k) => v.setUint8(i + k, c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + 2 * n, true);
  tag(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      env = loop ? Math.sin((Math.PI * i) / n) ** 2 : Math.exp((-6 * i) / n);
    v.setInt16(
      44 + 2 * i,
      env *
        8800 *
        (Math.sin(2 * Math.PI * hz * t) +
          0.32 * Math.sin(2 * Math.PI * hz * 1.5 * t)),
      true,
    );
  }
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return new Howl({
    src: ["data:audio/wav;base64," + btoa(s)],
    format: ["wav"],
    loop,
    volume: loop ? 0 : 0.35,
  });
}
let layers,
  fx,
  on = false;
export function toggle() {
  on = !on;
  if (!layers) {
    layers = [tone(262, 2, true), tone(146, 2, true), tone(83, 1, true)];
    fx = {
      news: tone(660, 0.32),
      kill: tone(88, 0.22),
      shot: tone(56, 0.13),
      rumor: tone(480, 0.16),
      fight: tone(140, 0.1),
      hug: tone(523, 0.16),
    };
  }
  for (const l of layers)
    if (on) l.play();
    else l.pause();
  return on;
}
export function mix(t) {
  if (on) {
    layers[0].volume(0.24 * (1 - t / 100));
    layers[1].volume((0.17 * t) / 100);
    layers[2].volume(0.19 * Math.max(0, (t - 55) / 45));
  }
}
export function cue(t) {
  if (on) (fx[t] || fx.news).play();
}
