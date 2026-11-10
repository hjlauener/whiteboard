import type { LaserBatch } from "./laser.ts";
/** Configuration written by ilObjUdonWhiteboardGUI into data-config. */
export interface BoardConfig {
  /** URL of the command syncBoard (POST, JSON) */
  syncUrl: string;
  /** base URL of js/dist/ (fonts are loaded from there) */
  assetPath: string;
  /** Excalidraw language code, e.g. "de-DE" */
  langCode: string;
  userId: number;
  canEdit: boolean;
  /** templates switched on, by topic ([id, name, description]), and the texts of their contents */
  templates: {
    topics: Array<{ id: string; name: string; items: Array<[string, string, string]> }>;
    texts: Record<string, string>;
  };
  /** names of the line shapes: [name, description] per id of linePatterns.ts */
  linePatterns: { title: string; items: Record<string, [string, string]> };
  /** colour palette of the board (palettes.ts), from the settings */
  palette: string;
  /** text for an AI (templates/ai_prompt_*.txt) with [[BOARD …]] and [[TASK …]] blocks */
  aiPrompt: string;
  /** poll interval in milliseconds */
  pollInterval: number;
  texts: {
    offline: string;
    saving: string;
    saved: string;
    viewOnly: string;
    cmdButton: string;
    cmdTitle: string;
    cmdClose: string;
    cmdRunInfo: string;
    cmdPlaceholder: string;
    menuZen: string;
    menuSmooth: string;
    ctxConvertRect: string;
    ctxConvertEllipse: string;
    ctxConvertDiamond: string;
    ctxConvertNote: string;
    ctxConvertArrow: string;
    ctxConvertLine: string;
    shapesButton: string;
    templatesButton: string;
    fillRemove: string;
    templatesTitle: string;
    templatesConfirmTitle: string;
    templatesConfirmText: string;
    templatesConfirmOk: string;
    templatesCancel: string;
    templatesNone: string;
    shapesTitle: string;
    shapesLibrary: string;
    shapesHint: string;
    shapesLoading: string;
    shapesSource: string;
    shapesLibNotes: string;
    shapesLibBasic: string;
    notesSquare: string;
    notesRound: string;
    notesPadSquare: string;
    notesPadRound: string;
    notesHint: string;
    notesStack: string;
    notesStackLabel: string;
    shapesLibPeople: string;
    shapesLibCharts: string;
    aiOpen: string;
    aiOpenInfo: string;
    aiOpenedPrefilled: string;
    aiOpenedPaste: string;
    cmdViewOnly: string;
    cmdErrors: string;
    cmdLine: string;
    cmdCopyErrors: string;
    cmdCopied: string;
    cmdChecked: string;
    cmdDone: string;
    cmdCheck: string;
    cmdRun: string;
    cmdCopyForAi: string;
    cmdCopyForAiDone: string;
    cmdCopyForAiInfo: string;
    cmdAiPrivacy: string;
    cmdAiPreview: string;
  };
}

export interface RemotePointer {
  x: number;
  y: number;
}

export interface RemoteUser {
  id: number;
  name: string;
  pointer: RemotePointer | null;
  /** laser pointer: batches of the last seconds (laser.ts) */
  laser?: LaserBatch[];
}

/** Answer of syncBoard */
export interface SyncResponse {
  rev: number;
  /** changed elements since the requested revision (Excalidraw JSON) */
  elements: unknown[];
  users: RemoteUser[];
  error?: string;
}
