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
}

/** Answer of syncBoard */
export interface SyncResponse {
  rev: number;
  /** changed elements since the requested revision (Excalidraw JSON) */
  elements: unknown[];
  users: RemoteUser[];
  error?: string;
}
