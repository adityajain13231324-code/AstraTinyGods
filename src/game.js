import { world, living, shuffle } from "./sim/world.js";
import { begin, valid, apply, bot } from "./sim/orders.js";
import { step, finish, winner, score } from "./sim/turn.js";
import { T, styles, factions } from "./config/tunables.js";
import { matchesOrder, observation } from "./field-report.js";
export const blank = () => ({ orders: [], rumor: null });
export class Game {
  constructor(seed, seats, bots) {
    this.w = world(seed);
    this.humans = new Set(seats);
    this.bots = bots;
    this.speed = 1;
    this.phase = "";
    this.rev = 0;
    this.acc = 0;
    this.votes = {};
    this.clips = [];
    this.rounds = [];
    this.lastGuesses = [];
    this.next();
  }
  phaseTo(name, seconds) {
    this.phase = name;
    this.left = seconds;
    this.rev++;
  }
  next() {
    begin(this.w);
    this.openingCounts = living(this.w);
    this.reports = [[], [], [], []];
    for (const v of this.w.villagers) v.startedUnarmed = v.weapon === "none";
    this.entries = new Map();
    this.answers = new Map();
    this.votes = {};
    this.film = [];
    this.clips = [];
    this.phaseTo("Command", T.commandSeconds);
    for (let i = 0; i < 4; i++)
      if (!this.humans.has(i))
        this.entries.set(i, bot(this.w, i, this.bots[i]));
  }
  input(i, kind, data) {
    if (!this.humans.has(i)) return false;
    if (
      kind === "orders" &&
      this.phase === "Command" &&
      !this.entries.has(i) &&
      valid(this.w, i, data)
    ) {
      this.entries.set(i, data);
      this.rev++;
      return true;
    }
    if (
      kind === "guess" &&
      this.phase === "Guess" &&
      !this.answers.has(i) &&
      Array.isArray(data) &&
      data.length === this.w.questions.length &&
      data.every((n) => Number.isInteger(n) && n >= -1 && n < 4)
    ) {
      this.answers.set(i, data);
      this.rev++;
      return true;
    }
    if (
      kind === "vote" &&
      this.phase === "Recap" &&
      !living(this.w)[i] &&
      Number.isInteger(data) &&
      this.w.highlights.some((e) => e.id === data)
    ) {
      this.votes[i] = data;
      this.rev++;
      return true;
    }
    return false;
  }
  disconnect(i) {
    this.humans.delete(i);
    if (this.phase === "Command" && !this.entries.has(i))
      this.entries.set(i, bot(this.w, i, this.bots[i]));
    this.rev++;
  }
  startSim() {
    for (const i of shuffle(this.w.r, [0, 1, 2, 3])) {
      const packet = this.entries.get(i) || blank();
      apply(this.w, i, packet);
      this.reports[i] = packet.orders.map((order) => ({
        order,
        seen: new Set(),
      }));
    }
    this.phaseTo("Simulation", T.simSeconds);
    this.acc = 0;
  }
  advance(dt) {
    if (this.phase === "End") return;
    if (this.phase === "Simulation") {
      this.acc += dt * this.speed;
      while (this.acc >= T.dt && this.w.time < T.simSeconds) {
        step(this.w);
        if (this.w.tick % Math.round(T.think / T.dt) === 1) {
          for (const v of this.w.villagers) {
            for (const report of this.reports[v.faction] || [])
              if (
                !report.seen.has(v.id) &&
                matchesOrder(v, this.w.villagers, report.order)
              )
                report.seen.add(v.id);
          }
        }
        this.acc -= T.dt;
        if (this.w.tick % 5 === 0)
          this.film.push({
            tick: this.w.tick,
            people: this.w.villagers.map((v) => [
              Math.round(v.x),
              Math.round(v.y),
              Math.ceil(v.hp),
              v.state,
              v.thought,
            ]),
          });
      }
      this.left = T.simSeconds - this.w.time;
      if (this.left <= 0) {
        finish(this.w);
        this.clips = this.w.highlights.map((e) =>
          this.film.filter((f) => Math.abs(f.tick - e.tick) <= 24),
        );
        this.rounds.push({
          turn: this.w.turn,
          headline: this.w.highlights[0].text,
          highlights: this.w.highlights.map((e) => ({
            id: e.id,
            text: e.text,
            cause: e.cause,
          })),
          kills: this.w.events.filter((e) => e.type === "kill").length,
        });
        this.phaseTo("Recap", T.recapSeconds);
      }
      return;
    }
    if (!(this.untimedPlanning && this.phase === "Command")) this.left -= dt;
    if (this.phase === "Command" && (this.left <= 0 || this.entries.size === 4))
      this.startSim();
    else if (this.phase === "Recap" && this.left <= 0)
      this.phaseTo("Guess", T.guessSeconds);
    else if (
      this.phase === "Guess" &&
      (this.left <= 0 ||
        [...this.humans].every((i) => this.answers.has(i)) ||
        !this.w.questions.length)
    ) {
      for (let i = 0; i < 4; i++) {
        let answers = this.answers.get(i) || [];
        if (!this.humans.has(i)) {
          const c = living(this.w);
          answers = this.w.questions.map((e) => {
            const rival = c
              .slice(0, 4)
              .map((n, i) => ({ i, n }))
              .filter((o) => !e.text.includes(factions[o.i]))
              .sort((a, b) => b.n - a.n);
            return rival[0]?.i ?? i;
          });
        }
        this.lastGuesses[i] = {
          correct: score(this.w, i, answers),
          total: this.w.questions.length,
        };
      }
      this.rounds.at(-1).votes = { ...this.votes };
      const win = winner(this.w);
      if (win === null) this.next();
      else {
        this.win = win;
        this.phaseTo("End", 0);
      }
    }
  }
  view(i, withClips = true) {
    const w = this.w,
      c = living(w),
      ghost = !c[i],
      publicEvent = ({ cause, ...rest }) => rest;
    const people = w.villagers.map((v) => ({
      id: v.id,
      name: v.name,
      x: +v.x.toFixed(1),
      y: +v.y.toFixed(1),
      hp: Math.ceil(v.hp),
      state: v.state,
      actionTarget: v.hp ? v.actionTarget : null,
      actionPlace: v.hp ? v.actionPlace : null,
      reason: v.hp ? v.reason : "",
      thought: v.thought,
      shape: v.shape,
      faction: v.faction,
      weapon: v.weapon,
      traits: ghost || v.faction === i ? v.traits : [],
      op: v.op.map(Math.round),
    }));
    return {
      rev: this.rev,
      seat: i,
      turn: w.turn,
      left: this.left,
      phase: this.phase,
      speed: this.speed,
      tension: w.tension,
      counts: c,
      openingCount: this.openingCounts[i],
      report: this.reports[i].map(({ order, seen }) => ({
        order,
        count: seen.size,
        outcome: observation[order.verb],
      })),
      whisper: w.rumors
        .filter((r) => r.seat === i && r.start === w.turn)
        .map((r) => ({
          verb: r.verb,
          target: r.target,
          believed: r.believed || 0,
        }))[0],
      budget: w.budget[i],
      lastGuess: this.lastGuesses[i],
      people,
      submitted: this.entries.has(i),
      guessed: this.answers.has(i),
      events: w.events.slice(-8).map(publicEvent),
      kills: w.events.filter((e) => e.type === "kill").map(publicEvent),
      highlights: ["Recap", "Guess"].includes(this.phase)
        ? w.highlights.map(publicEvent)
        : [],
      questions: this.phase === "Guess" ? w.questions.map(publicEvent) : [],
      clips: this.phase === "Recap" && withClips ? this.clips : null,
      vote: this.votes[i],
      votes: Object.keys(this.votes).length,
      end:
        this.phase === "End"
          ? {
              win: this.win,
              history: w.history,
              rounds: this.rounds,
              points: w.points,
              beliefs: w.beliefs,
            }
          : null,
    };
  }
}
