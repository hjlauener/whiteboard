import {
  CaptureUpdateAction,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import type { BoardConfig, RemotePointer, RemoteUser, SyncResponse } from "./types";

type RemoteElements = Parameters<typeof reconcileElements>[1];

export type SyncStatus = "online" | "saving" | "offline";

/** colours for the pointers of the other people (picked by user id) */
const COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#9c36b5", "#c2255c", "#0c8599", "#f08c00", "#5f3dc4"];

/** at most this many elements per request */
const MAX_BATCH = 200;
/** wait this long after a change before sending (collects quick changes) */
const FLUSH_DELAY = 120;

/**
 * Keeps the board in sync with the server (ILIAS) by polling.
 *
 * - Own changes: every element whose version is higher than the last version
 *   known to the server is sent.
 * - Changes of others: the server returns all elements changed since the last
 *   revision; they are merged with Excalidraw's reconcileElements (higher
 *   version wins, elements being edited locally are kept).
 * - Pointers of the other people are shown as Excalidraw collaborators.
 */
export class BoardSync {
  private api: ExcalidrawImperativeAPI | null = null;
  private rev = 0;
  /** element id => version the server knows */
  private readonly known = new Map<string, number>();
  /** element id => element waiting to be sent */
  private readonly pending = new Map<string, ExcalidrawElement>();
  private pointer: RemotePointer | null = null;
  private busy = false;
  private timer: number | undefined;
  private failures = 0;
  private stopped = false;
  private readonly listeners: Array<(s: SyncStatus) => void> = [];

  constructor(private readonly config: BoardConfig) {}

  /** First request: whole board (revision 0). */
  async loadInitial(): Promise<OrderedExcalidrawElement[]> {
    const data = await this.request({ since: 0, elements: [] });
    this.rev = data.rev;
    const elements = restoreElements(data.elements as RemoteElements, null) as OrderedExcalidrawElement[];
    for (const el of elements) {
      this.known.set(el.id, el.version);
    }
    return elements;
  }

  attach(api: ExcalidrawImperativeAPI): void {
    this.api = api;
    this.schedule(this.config.pollInterval);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.schedule(0);
      }
    });
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.timer);
  }

  onStatus(listener: (s: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) {
        this.listeners.splice(i, 1);
      }
    };
  }

  /** Called by Excalidraw for every change of the scene. */
  handleChange(elements: readonly OrderedExcalidrawElement[]): void {
    if (!this.config.canEdit) {
      return;
    }
    let changed = false;
    for (const el of elements) {
      if ((this.known.get(el.id) ?? -1) < el.version) {
        this.pending.set(el.id, el);
        changed = true;
      }
    }
    if (changed) {
      this.emit("saving");
      this.schedule(FLUSH_DELAY);
    }
  }

  handlePointer(pointer: { x: number; y: number }): void {
    const x = Math.round(pointer.x);
    const y = Math.round(pointer.y);
    this.pointer = { x, y };
  }

  // ------------------------------------------------------------------

  private schedule(delay: number): void {
    if (this.stopped) {
      return;
    }
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.tick(), delay);
  }

  private nextDelay(): number {
    if (this.failures > 0) {
      return Math.min(30000, this.config.pollInterval * 2 ** this.failures);
    }
    if (this.pending.size > 0) {
      return FLUSH_DELAY;
    }
    return document.hidden ? this.config.pollInterval * 5 : this.config.pollInterval;
  }

  private async tick(): Promise<void> {
    if (this.busy || this.api === null) {
      this.schedule(this.config.pollInterval);
      return;
    }
    this.busy = true;

    const batch = Array.from(this.pending.values()).slice(0, MAX_BATCH);
    const sent = new Map(batch.map((el) => [el.id, el.version] as const));
    const pointer = this.pointer;

    try {
      const data = await this.request({ since: this.rev, elements: batch, pointer });
      this.failures = 0;

      // the server has the sent versions now (or a newer one, which comes back in data.elements)
      for (const [id, version] of sent) {
        this.known.set(id, Math.max(this.known.get(id) ?? -1, version));
        if (this.pending.get(id)?.version === version) {
          this.pending.delete(id);
        }
      }

      this.applyRemote(data.elements as RemoteElements);
      this.rev = Math.max(this.rev, data.rev);
      this.applyUsers(data.users);
      this.emit(this.pending.size > 0 ? "saving" : "online");
    } catch (e) {
      console.warn("Udon Whiteboard: sync failed", e);
      this.failures++;
      this.emit("offline");
    } finally {
      this.busy = false;
      this.schedule(this.nextDelay());
    }
  }

  private applyRemote(remote: RemoteElements): void {
    if (this.api === null || remote.length === 0) {
      return;
    }
    // only elements that are newer than what we already have from the server
    const fresh = remote.filter((el) => (this.known.get(el.id) ?? -1) < el.version || this.pending.has(el.id));
    for (const el of remote) {
      this.known.set(el.id, Math.max(this.known.get(el.id) ?? -1, el.version));
    }
    if (fresh.length === 0) {
      return;
    }
    const restored = restoreElements(fresh, null) as unknown as RemoteElements;
    const local = this.api.getSceneElementsIncludingDeleted();
    const appState = this.api.getAppState() as AppState;
    const merged = reconcileElements(local, restored, appState);

    // a remote version that won replaces a pending local change
    for (const el of restored) {
      const pending = this.pending.get(el.id);
      if (pending !== undefined && pending.version <= el.version) {
        this.pending.delete(el.id);
      }
    }

    this.api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
  }

  private applyUsers(users: RemoteUser[]): void {
    if (this.api === null) {
      return;
    }
    const collaborators = new Map<SocketId, Collaborator>();
    for (const user of users) {
      if (user.id === this.config.userId) {
        continue;
      }
      const color = COLORS[user.id % COLORS.length];
      collaborators.set(`u${user.id}` as SocketId, {
        id: String(user.id),
        username: user.name,
        color: { background: color, stroke: color },
        pointer: user.pointer ? { x: user.pointer.x, y: user.pointer.y, tool: "pointer" } : undefined,
      });
    }
    this.api.updateScene({ collaborators });
  }

  private async request(body: { since: number; elements: readonly unknown[]; pointer?: RemotePointer | null }): Promise<SyncResponse> {
    const response = await fetch(this.config.syncUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as SyncResponse;
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  private emit(status: SyncStatus): void {
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}
