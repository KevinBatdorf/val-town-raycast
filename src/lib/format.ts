import { Color, Icon } from "@raycast/api";
import type { FileType, Privacy } from "./types";

export function fileIcon(type: FileType): { source: Icon; tintColor?: Color } {
  switch (type) {
    case "directory":
      return { source: Icon.Folder };
    case "http":
      return { source: Icon.Globe, tintColor: Color.Blue };
    case "interval":
      return { source: Icon.Clock, tintColor: Color.Purple };
    case "email":
      return { source: Icon.Envelope, tintColor: Color.Orange };
    case "script":
      return { source: Icon.Terminal, tintColor: Color.Green };
    default:
      return { source: Icon.Document };
  }
}

export function privacyIcon(privacy: Privacy): Icon {
  switch (privacy) {
    case "private":
      return Icon.Lock;
    case "unlisted":
      return Icon.EyeDisabled;
    default:
      return Icon.Globe;
  }
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  json: "json",
  md: "md",
  html: "html",
  css: "css",
  txt: "text",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
};

export function languageFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXTENSION[extension] ?? "";
}

export function codeBlock(content: string, path: string): string {
  return `\`\`\`${languageFor(path)}\n${content}\n\`\`\``;
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
