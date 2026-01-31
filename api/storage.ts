import { readdir, readFile, stat, open } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { calculateCost, getModelDisplayName } from "./pricing.js";

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

export interface SessionUsage {
  sessionId: string;
  display: string;
  project: string;
  projectName: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  messageCount: number;
  model: string;
  estimatedCost: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalEstimatedCost: number;
  sessionCount: number;
  messageCount: number;
  byModel: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cost: number;
      count: number;
    }
  >;
  byDate: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
    sessionCount: number;
  }>;
  byProject: Record<
    string,
    {
      projectName: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      sessionCount: number;
    }
  >;
}

export interface TimeRange {
  start?: string;
  end?: string;
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

/**
 * Calculate usage statistics for a single session
 */
export async function getSessionUsage(
  sessionId: string
): Promise<SessionUsage | null> {
  const messages = await getConversation(sessionId);
  if (messages.length === 0) return null;

  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let messageCount = 0;
  let estimatedCost = 0;
  let model = "Unknown";
  let firstMessageAt: string | null = null;
  let lastMessageAt: string | null = null;

  for (const msg of messages) {
    if (msg.type === "assistant" && msg.message?.usage) {
      const usage = msg.message.usage;
      totalInputTokens += usage.input_tokens || 0;
      totalOutputTokens += usage.output_tokens || 0;
      cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      cacheReadTokens += usage.cache_read_input_tokens || 0;
      estimatedCost += calculateCost(usage, msg.message.model);

      if (msg.message.model) {
        model = getModelDisplayName(msg.message.model);
      }
    }

    if (msg.type === "user" || msg.type === "assistant") {
      messageCount++;
      if (msg.timestamp) {
        if (!firstMessageAt) firstMessageAt = msg.timestamp;
        lastMessageAt = msg.timestamp;
      }
    }
  }

  return {
    sessionId,
    display: session?.display || "Unknown session",
    project: session?.project || "",
    projectName: session?.projectName || "",
    totalInputTokens,
    totalOutputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    messageCount,
    model,
    estimatedCost,
    firstMessageAt,
    lastMessageAt,
  };
}

/**
 * Get usage summary across all sessions with optional filters
 */
export async function getUsageSummary(options?: {
  timeRange?: TimeRange;
  project?: string;
}): Promise<UsageSummary> {
  const sessions = await getSessions();

  const summary: UsageSummary = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalEstimatedCost: 0,
    sessionCount: 0,
    messageCount: 0,
    byModel: {},
    byDate: [],
    byProject: {},
  };

  const byDateMap = new Map<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      cost: number;
      sessionCount: number;
    }
  >();

  // Filter sessions by project if specified
  let filteredSessions = sessions;
  if (options?.project) {
    filteredSessions = sessions.filter((s) => s.project === options.project);
  }

  // Filter sessions by time range if specified
  if (options?.timeRange?.start || options?.timeRange?.end) {
    const startTime = options.timeRange.start
      ? new Date(options.timeRange.start).getTime()
      : 0;
    const endTime = options.timeRange.end
      ? new Date(options.timeRange.end).getTime()
      : Infinity;

    filteredSessions = filteredSessions.filter(
      (s) => s.timestamp >= startTime && s.timestamp <= endTime
    );
  }

  // Process each session
  for (const session of filteredSessions) {
    const messages = await getConversation(session.id);

    let sessionInputTokens = 0;
    let sessionOutputTokens = 0;
    let sessionCacheCreationTokens = 0;
    let sessionCacheReadTokens = 0;
    let sessionCost = 0;
    let sessionMessageCount = 0;

    for (const msg of messages) {
      if (msg.type === "assistant" && msg.message?.usage) {
        const usage = msg.message.usage;
        const model = msg.message.model;
        const cost = calculateCost(usage, model);
        const modelName = getModelDisplayName(model);

        sessionInputTokens += usage.input_tokens || 0;
        sessionOutputTokens += usage.output_tokens || 0;
        sessionCacheCreationTokens += usage.cache_creation_input_tokens || 0;
        sessionCacheReadTokens += usage.cache_read_input_tokens || 0;
        summary.totalCacheCreationTokens +=
          usage.cache_creation_input_tokens || 0;
        summary.totalCacheReadTokens += usage.cache_read_input_tokens || 0;
        sessionCost += cost;

        // Aggregate by model
        if (!summary.byModel[modelName]) {
          summary.byModel[modelName] = {
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            count: 0,
          };
        }
        summary.byModel[modelName].inputTokens += usage.input_tokens || 0;
        summary.byModel[modelName].outputTokens += usage.output_tokens || 0;
        summary.byModel[modelName].cost += cost;
        summary.byModel[modelName].count++;
      }

      if (msg.type === "user" || msg.type === "assistant") {
        sessionMessageCount++;
      }
    }

    if (sessionMessageCount > 0) {
      summary.sessionCount++;
      summary.messageCount += sessionMessageCount;
      summary.totalInputTokens += sessionInputTokens;
      summary.totalOutputTokens += sessionOutputTokens;
      summary.totalEstimatedCost += sessionCost;

      // Aggregate by date
      const date = new Date(session.timestamp).toISOString().split("T")[0];
      const dateEntry = byDateMap.get(date) || {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        cost: 0,
        sessionCount: 0,
      };
      dateEntry.inputTokens += sessionInputTokens;
      dateEntry.outputTokens += sessionOutputTokens;
      dateEntry.cacheCreationTokens += sessionCacheCreationTokens;
      dateEntry.cacheReadTokens += sessionCacheReadTokens;
      dateEntry.cost += sessionCost;
      dateEntry.sessionCount++;
      byDateMap.set(date, dateEntry);

      // Aggregate by project
      const projectKey = session.project || "Unknown";
      if (!summary.byProject[projectKey]) {
        summary.byProject[projectKey] = {
          projectName: session.projectName || "Unknown",
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          sessionCount: 0,
        };
      }
      summary.byProject[projectKey].inputTokens += sessionInputTokens;
      summary.byProject[projectKey].outputTokens += sessionOutputTokens;
      summary.byProject[projectKey].cost += sessionCost;
      summary.byProject[projectKey].sessionCount++;
    }
  }

  // Convert date map to sorted array
  summary.byDate = Array.from(byDateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return summary;
}

/**
 * Get daily usage for the last N days
 */
export async function getDailyUsage(
  days: number = 30
): Promise<
  Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
    sessionCount: number;
  }>
> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const summary = await getUsageSummary({
    timeRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  });

  // Fill in missing dates with zeros
  const result: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
    sessionCount: number;
  }> = [];

  const dateMap = new Map(summary.byDate.map((d) => [d.date, d]));
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    result.push(
      dateMap.get(dateStr) || {
        date: dateStr,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        cost: 0,
        sessionCount: 0,
      }
    );
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Get sessions with their usage data, sorted by specified field
 */
export async function getSessionsWithUsage(options?: {
  limit?: number;
  offset?: number;
  sortBy?: "cost" | "tokens" | "date";
  project?: string;
}): Promise<{
  sessions: SessionUsage[];
  total: number;
}> {
  const sessions = await getSessions();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const sortBy = options?.sortBy || "date";

  // Filter by project if specified
  let filteredSessions = sessions;
  if (options?.project) {
    filteredSessions = sessions.filter((s) => s.project === options.project);
  }

  // Get usage for all sessions
  const sessionsWithUsage: SessionUsage[] = [];

  for (const session of filteredSessions) {
    const usage = await getSessionUsage(session.id);
    if (usage) {
      sessionsWithUsage.push(usage);
    }
  }

  // Sort
  sessionsWithUsage.sort((a, b) => {
    switch (sortBy) {
      case "cost":
        return b.estimatedCost - a.estimatedCost;
      case "tokens":
        return (
          b.totalInputTokens +
          b.totalOutputTokens -
          (a.totalInputTokens + a.totalOutputTokens)
        );
      case "date":
      default:
        const aTime = a.lastMessageAt
          ? new Date(a.lastMessageAt).getTime()
          : 0;
        const bTime = b.lastMessageAt
          ? new Date(b.lastMessageAt).getTime()
          : 0;
        return bTime - aTime;
    }
  });

  return {
    sessions: sessionsWithUsage.slice(offset, offset + limit),
    total: sessionsWithUsage.length,
  };
}
