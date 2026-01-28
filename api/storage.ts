import { readdir, readFile, stat, open } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";
import { createInterface } from "readline";

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId?: string;
}

export interface Session {
  id: string;
  display: string;
  timestamp: number;
  project: string;
  projectName: string;
}

export interface ConversationMessage {
  type: "user" | "assistant" | "summary" | "file-history-snapshot";
  uuid?: string;
  parentUuid?: string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
    model?: string;
    usage?: TokenUsage;
  };
  summary?: string;
}

export interface ContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface StreamResult {
  messages: ConversationMessage[];
  nextOffset: number;
}

let claudeDir = join(homedir(), ".claude");
let projectsDir = join(claudeDir, "projects");
const fileIndex = new Map<string, string>();
let historyCache: HistoryEntry[] | null = null;
let sessionCache: Session[] | null = null;
const pendingRequests = new Map<string, Promise<unknown>>();

export function initStorage(dir?: string): void {
  claudeDir = dir ?? join(homedir(), ".claude");
  projectsDir = join(claudeDir, "projects");
}

export function getClaudeDir(): string {
  return claudeDir;
}

export function invalidateHistoryCache(): void {
  historyCache = null;
  sessionCache = null;
}

export function invalidateSessionCache(): void {
  sessionCache = null;
}

export function addToFileIndex(sessionId: string, filePath: string): void {
  fileIndex.set(sessionId, filePath);
}

function encodeProjectPath(path: string): string {
  return path.replace(/[/.]/g, "-");
}

function getProjectName(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

function projectDirToDisplayName(dirName: string): string {
  // Directory names like "-Users-michaelbrady-repos-claude-run" can't be
  // perfectly reversed since - is ambiguous (original -, encoded / or .).
  // Just use the last segment as a reasonable display name.
  const parts = dirName.split("-").filter(Boolean);
  return parts[parts.length - 1] || dirName;
}

function extractDisplayText(content: string | ContentBlock[]): string {
  if (typeof content === "string") {
    return content.slice(0, 200);
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "text" && block.text && !block.text.startsWith("<")) {
        return block.text.slice(0, 200);
      }
    }
    // Fallback: use any text block even if it starts with <
    for (const block of content) {
      if (block.type === "text" && block.text) {
        return block.text.slice(0, 200);
      }
    }
  }
  return "Untitled conversation";
}

async function readSessionMetadata(
  filePath: string
): Promise<{ display: string; timestamp: number; project: string } | null> {
  let fileHandle;
  try {
    fileHandle = await open(filePath, "r");
    const stream = fileHandle.createReadStream({ encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "user" && msg.message?.content) {
          const display = extractDisplayText(msg.message.content);
          const timestamp = msg.timestamp
            ? new Date(msg.timestamp).getTime()
            : Date.now();
          const project = msg.cwd || "";
          rl.close();
          return { display, timestamp, project };
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // File read error
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
  return null;
}

async function buildFileIndex(): Promise<void> {
  try {
    const projectDirs = await readdir(projectsDir, { withFileTypes: true });
    const directories = projectDirs.filter((d) => d.isDirectory());

    await Promise.all(
      directories.map(async (dir) => {
        try {
          const projectPath = join(projectsDir, dir.name);
          const files = await readdir(projectPath);
          for (const file of files) {
            if (file.endsWith(".jsonl")) {
              const sessionId = basename(file, ".jsonl");
              fileIndex.set(sessionId, join(projectPath, file));
            }
          }
        } catch {
          // Ignore errors for individual directories
        }
      })
    );
  } catch {
    // Projects directory may not exist yet
  }
}

async function loadHistoryCache(): Promise<HistoryEntry[]> {
  try {
    const historyPath = join(claudeDir, "history.jsonl");
    const content = await readFile(historyPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries: HistoryEntry[] = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    historyCache = entries;
    return entries;
  } catch {
    historyCache = [];
    return [];
  }
}

async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

async function findSessionByTimestamp(
  encodedProject: string,
  timestamp: number
): Promise<string | undefined> {
  try {
    const projectPath = join(projectsDir, encodedProject);
    const files = await readdir(projectPath);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

    const fileStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = join(projectPath, file);
        const fileStat = await stat(filePath);
        return { file, mtime: fileStat.mtimeMs };
      })
    );

    let closestFile: string | null = null;
    let closestTimeDiff = Infinity;

    for (const { file, mtime } of fileStats) {
      const timeDiff = Math.abs(mtime - timestamp);
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff;
        closestFile = file;
      }
    }

    if (closestFile) {
      return basename(closestFile, ".jsonl");
    }
  } catch {
    // Project directory doesn't exist
  }

  return undefined;
}

async function findSessionFile(sessionId: string): Promise<string | null> {
  if (fileIndex.has(sessionId)) {
    return fileIndex.get(sessionId)!;
  }

  const targetFile = `${sessionId}.jsonl`;

  try {
    const projectDirs = await readdir(projectsDir, { withFileTypes: true });
    const directories = projectDirs.filter((d) => d.isDirectory());

    const results = await Promise.all(
      directories.map(async (dir) => {
        try {
          const projectPath = join(projectsDir, dir.name);
          const files = await readdir(projectPath);
          if (files.includes(targetFile)) {
            return join(projectPath, targetFile);
          }
        } catch {
          // Ignore errors for individual directories
        }
        return null;
      })
    );

    const filePath = results.find((r) => r !== null);
    if (filePath) {
      fileIndex.set(sessionId, filePath);
      return filePath;
    }
  } catch (err) {
    console.error("Error finding session file:", err);
  }

  return null;
}

export async function loadStorage(): Promise<void> {
  await Promise.all([buildFileIndex(), loadHistoryCache()]);
}

export async function getSessions(): Promise<Session[]> {
  return dedupe("getSessions", async () => {
    if (sessionCache) {
      return sessionCache;
    }

    const sessions: Session[] = [];
    const seenIds = new Set<string>();

    // First, add sessions from history.jsonl (they have good display text)
    const entries = historyCache ?? (await loadHistoryCache());
    const historySessionIds = new Map<string, HistoryEntry>();

    for (const entry of entries) {
      let sessionId = entry.sessionId;
      if (!sessionId) {
        const encodedProject = encodeProjectPath(entry.project);
        sessionId = await findSessionByTimestamp(encodedProject, entry.timestamp);
      }

      if (!sessionId || seenIds.has(sessionId)) {
        continue;
      }

      seenIds.add(sessionId);
      historySessionIds.set(sessionId, entry);
      sessions.push({
        id: sessionId,
        display: entry.display,
        timestamp: entry.timestamp,
        project: entry.project,
        projectName: getProjectName(entry.project),
      });
    }

    // Then, discover sessions from project directories on the filesystem
    // This catches sessions not in history.jsonl (e.g., VS Code extension sessions)
    try {
      const projectDirs = await readdir(projectsDir, { withFileTypes: true });
      const directories = projectDirs.filter((d) => d.isDirectory());

      // Map from dir name to resolved project path (discovered from session cwd fields)
      const dirToProjectPath = new Map<string, string>();

      const discoveredSessions = await Promise.all(
        directories.map(async (dir) => {
          const results: { session: Session; hasCwd: boolean }[] = [];
          try {
            const projectPath = join(projectsDir, dir.name);
            const files = await readdir(projectPath);
            const jsonlFiles = files.filter(
              (f) => f.endsWith(".jsonl")
            );

            for (const file of jsonlFiles) {
              const sessionId = basename(file, ".jsonl");
              if (seenIds.has(sessionId)) {
                continue;
              }

              const filePath = join(projectPath, file);
              const meta = await readSessionMetadata(filePath);
              if (meta) {
                if (meta.project) {
                  dirToProjectPath.set(dir.name, meta.project);
                }
                results.push({
                  hasCwd: !!meta.project,
                  session: {
                    id: sessionId,
                    display: meta.display,
                    timestamp: meta.timestamp,
                    project: meta.project || dir.name,
                    projectName: meta.project
                      ? getProjectName(meta.project)
                      : projectDirToDisplayName(dir.name),
                  },
                });
              } else {
                // Fallback: use file stat for timestamp
                try {
                  const fileStat = await stat(filePath);
                  results.push({
                    hasCwd: false,
                    session: {
                      id: sessionId,
                      display: "Untitled conversation",
                      timestamp: fileStat.mtimeMs,
                      project: dir.name,
                      projectName: projectDirToDisplayName(dir.name),
                    },
                  });
                } catch {
                  // Skip files we can't stat
                }
              }
            }
          } catch {
            // Ignore errors for individual directories
          }
          return { dirName: dir.name, results };
        })
      );

      // Resolve project paths for sessions that didn't have cwd,
      // using the path discovered from other sessions in the same directory
      for (const { dirName, results } of discoveredSessions) {
        const resolvedPath = dirToProjectPath.get(dirName);
        for (const { session, hasCwd } of results) {
          if (!hasCwd && resolvedPath) {
            session.project = resolvedPath;
            session.projectName = getProjectName(resolvedPath);
          }
          if (!seenIds.has(session.id)) {
            seenIds.add(session.id);
            sessions.push(session);
          }
        }
      }
    } catch {
      // Projects directory may not exist yet
    }

    sessions.sort((a, b) => b.timestamp - a.timestamp);
    sessionCache = sessions;
    return sessions;
  });
}

export async function getProjects(): Promise<string[]> {
  // Get projects from sessions (which now includes filesystem-discovered ones)
  const sessions = await getSessions();
  const projects = new Set<string>();

  for (const session of sessions) {
    if (session.project) {
      projects.add(session.project);
    }
  }

  return [...projects].sort();
}

export async function getConversation(
  sessionId: string
): Promise<ConversationMessage[]> {
  return dedupe(`getConversation:${sessionId}`, async () => {
    const filePath = await findSessionFile(sessionId);

    if (!filePath) {
      return [];
    }

    const messages: ConversationMessage[] = [];

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const msg: ConversationMessage = JSON.parse(line);
          if (msg.type === "user" || msg.type === "assistant") {
            messages.push(msg);
          } else if (msg.type === "summary") {
            messages.unshift(msg);
          }
        } catch {
          // Skip malformed lines
        }
      }
    } catch (err) {
      console.error("Error reading conversation:", err);
    }

    return messages;
  });
}

export async function getConversationStream(
  sessionId: string,
  fromOffset: number = 0
): Promise<StreamResult> {
  const filePath = await findSessionFile(sessionId);

  if (!filePath) {
    return { messages: [], nextOffset: 0 };
  }

  const messages: ConversationMessage[] = [];

  let fileHandle;
  try {
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;

    if (fromOffset >= fileSize) {
      return { messages: [], nextOffset: fromOffset };
    }

    fileHandle = await open(filePath, "r");
    const stream = fileHandle.createReadStream({
      start: fromOffset,
      encoding: "utf-8",
    });

    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let bytesConsumed = 0;

    for await (const line of rl) {
      const lineBytes = Buffer.byteLength(line, "utf-8") + 1;

      if (line.trim()) {
        try {
          const msg: ConversationMessage = JSON.parse(line);
          if (msg.type === "user" || msg.type === "assistant") {
            messages.push(msg);
          }
          bytesConsumed += lineBytes;
        } catch {
          break;
        }
      } else {
        bytesConsumed += lineBytes;
      }
    }

    const actualOffset = fromOffset + bytesConsumed;
    const nextOffset = actualOffset > fileSize ? fileSize : actualOffset;

    return { messages, nextOffset };
  } catch (err) {
    console.error("Error reading conversation stream:", err);
    return { messages: [], nextOffset: fromOffset };
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}
