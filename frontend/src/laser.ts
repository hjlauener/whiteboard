/**
 * Laser pointer for everybody on the board.
 *
 * Excalidraw draws the laser trail of another person frame by frame from that
 * person's pointer ("tool: laser", "button: down"). The board only polls
 * (no live connection), so the points are sent in batches with their time
 * (LaserOutbox), the server keeps the batches of the last seconds, and the
 * other boards play them back at the original pace (LaserPlayer). The trail
 * arrives smoothly, about half a second late.
 */
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from "@excalidraw/excalidraw/types";

/** [time in ms (clock of the sender), x, y, end of the stroke 0/1] */
export type LaserPoint = [number, number, number, number];

/** numbered batch of points of one person, as kept by the server */
export interface LaserBatch {
  s: number;
  p: LaserPoint[];
}

/** at most one point per this many ms */
const SAMPLE_INTERVAL = 16;
/** delay of the playback, so that the next batch is there in time */
const LEAD = 150;
/** after a stroke the pointer of the person shows as normal pointer again */
const RELEASE_AFTER = 1500;

/** Collects the points of the own laser pointer until the next request. */
export class LaserOutbox {
  private points: LaserPoint[] = [];
  private down = false;
  private lastTime = 0;

  /** pointer update from Excalidraw; true while the laser is used */
  add(pointer: { x: number; y: number; tool?: string }, button: string | undefined): boolean {
    const now = Date.now();
    const x = Math.round(pointer.x * 10) / 10;
    const y = Math.round(pointer.y * 10) / 10;
    if (pointer.tool === "laser" && button === "down") {
      if (!this.down || now - this.lastTime >= SAMPLE_INTERVAL) {
        this.points.push([now, x, y, 0]);
        this.lastTime = now;
      }
      this.down = true;
    } else if (this.down) {
      this.points.push([now, x, y, 1]);
      this.down = false;
    }
    return this.active;
  }

  /** the laser is being used, or points are waiting */
  get active(): boolean {
    return this.down || this.points.length > 0;
  }

  /** points for the next request (taken out) */
  take(): LaserPoint[] {
    const out = this.points;
    this.points = [];
    return out;
  }
}

interface Track {
  lastSeq: number | undefined;
  queue: Array<{ at: number; x: number; y: number; end: boolean }>;
  /** offset between the clock of the sender and performance.now() for the current stroke */
  offset: number | null;
  state: { x: number; y: number; button: "down" | "up" } | null;
  releaseAt: number;
  lastBatchAt: number;
}

/** Plays back the laser points of the other people. */
export class LaserPlayer {
  private readonly tracks = new Map<number, Track>();
  private base = new Map<SocketId, Collaborator>();
  private frame: number | null = null;

  constructor(private readonly api: ExcalidrawImperativeAPI) {}

  /** someone used the laser in the last seconds: poll more often */
  get busy(): boolean {
    const now = performance.now();
    for (const track of this.tracks.values()) {
      if (track.queue.length > 0 || now - track.lastBatchAt < 2500) return true;
    }
    return false;
  }

  /** new batches of a person (from the answer of the server) */
  receive(userId: number, batches: readonly LaserBatch[] | undefined): void {
    let track = this.tracks.get(userId);
    if (track === undefined) {
      track = { lastSeq: undefined, queue: [], offset: null, state: null, releaseAt: 0, lastBatchAt: 0 };
      this.tracks.set(userId, track);
    }
    if (!batches || batches.length === 0) return;
    const max = Math.max(...batches.map((b) => b.s));
    if (track.lastSeq === undefined) {
      track.lastSeq = max; // just arrived: older strokes are not played
      return;
    }
    if (max < track.lastSeq) track.lastSeq = 0; // the person came back (new numbering)
    const fresh = batches.filter((b) => b.s > (track.lastSeq ?? 0)).sort((a, b) => a.s - b.s);
    track.lastSeq = max;
    if (fresh.length === 0) return;
    track.lastBatchAt = performance.now();
    for (const batch of fresh) {
      for (const [t, x, y, end] of batch.p) {
        if (track.offset === null) track.offset = performance.now() + LEAD - t;
        track.queue.push({ at: t + track.offset, x, y, end: end === 1 });
        if (end === 1) track.offset = null; // next stroke: new clock
      }
    }
    this.run();
  }

  /** the pointers of the people as shown by the sync; the laser overrides them */
  setBase(collaborators: Map<SocketId, Collaborator>): Map<SocketId, Collaborator> {
    this.base = collaborators;
    return this.withLaser();
  }

  private withLaser(): Map<SocketId, Collaborator> {
    const out = new Map(this.base);
    for (const [userId, track] of this.tracks) {
      const key = `u${userId}` as SocketId;
      const c = out.get(key);
      if (c === undefined || track.state === null) continue;
      out.set(key, { ...c, pointer: { x: track.state.x, y: track.state.y, tool: "laser" }, button: track.state.button });
    }
    return out;
  }

  private run(): void {
    if (this.frame !== null) return;
    const step = () => {
      this.frame = null;
      const now = performance.now();
      let changed = false;
      let waiting = false;
      for (const track of this.tracks.values()) {
        // behind (tab was in the background): skip points, but keep the end of a stroke
        while (track.queue.length > 3 && track.queue[1].at <= now && !track.queue[0].end) track.queue.shift();
        const next = track.queue[0];
        if (next !== undefined && next.at <= now) {
          track.queue.shift();
          track.state = { x: next.x, y: next.y, button: next.end ? "up" : "down" };
          track.releaseAt = next.end ? now + RELEASE_AFTER : 0;
          changed = true;
        } else if (track.state !== null && track.releaseAt > 0 && now >= track.releaseAt) {
          track.state = null;
          track.releaseAt = 0;
          changed = true;
        } else if (track.state?.button === "down" && track.queue.length === 0 && now - track.lastBatchAt > 3000) {
          // the end of the stroke never came (request lost)
          track.state = { ...track.state, button: "up" };
          track.releaseAt = now + RELEASE_AFTER;
          changed = true;
        }
        if (track.queue.length > 0 || track.releaseAt > 0 || track.state?.button === "down") waiting = true;
      }
      if (changed) this.api.updateScene({ collaborators: this.withLaser() });
      if (waiting) this.frame = window.requestAnimationFrame(step);
    };
    this.frame = window.requestAnimationFrame(step);
  }
}
