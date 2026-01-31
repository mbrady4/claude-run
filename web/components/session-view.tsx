import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { ConversationMessage } from "@claude-run/api";
import { User, MessageSquare, Hash, Coins } from "lucide-react";
import MessageBlock from "./message-block";
import ScrollToBottomButton from "./scroll-to-bottom-button";
import { formatTokens, formatCost } from "./usage/types";

const MAX_RETRIES = 10;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const SCROLL_THRESHOLD_PX = 100;

interface SessionViewProps {
  sessionId: string;
}

function SessionView(props: SessionViewProps) {
  const { sessionId } = props;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showOnlyUserMessages, setShowOnlyUserMessages] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const isScrollingProgrammaticallyRef = useRef(false);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `/api/conversation/${sessionId}/stream?offset=${offsetRef.current}`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("messages", (event) => {
      retryCountRef.current = 0;
      const newMessages: ConversationMessage[] = JSON.parse(event.data);
      setLoading(false);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.uuid).filter(Boolean));
        const unique = newMessages.filter((m) => !existingIds.has(m.uuid));
        if (unique.length === 0) {
          return prev;
        }
        offsetRef.current += unique.length;
        return [...prev, ...unique];
      });
    });

    eventSource.onerror = () => {
      eventSource.close();
      setLoading(false);

      if (!mountedRef.current) {
        return;
      }

      if (retryCountRef.current < MAX_RETRIES) {
        const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY_MS);
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => connect(), delay);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setMessages([]);
    offsetRef.current = 0;
    retryCountRef.current = 0;

    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  const scrollToBottom = useCallback(() => {
    if (!lastMessageRef.current) {
      return;
    }
    isScrollingProgrammaticallyRef.current = true;
    lastMessageRef.current.scrollIntoView({ behavior: "instant" });
    requestAnimationFrame(() => {
      isScrollingProgrammaticallyRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll, scrollToBottom]);

  const handleScroll = () => {
    if (!containerRef.current || isScrollingProgrammaticallyRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_PX;
    setAutoScroll(isAtBottom);
  };

  const summary = messages.find((m) => m.type === "summary");
  const allConversationMessages = messages.filter(
    (m) => m.type === "user" || m.type === "assistant"
  );
  const conversationMessages = showOnlyUserMessages
    ? allConversationMessages.filter((m) => m.type === "user")
    : allConversationMessages;
  const userMessageCount = allConversationMessages.filter((m) => m.type === "user").length;

  // Calculate usage from messages
  const usageStats = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let cost = 0;

    for (const msg of messages) {
      if (msg.type === "assistant" && msg.message?.usage) {
        const usage = msg.message.usage;
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;

        // Simple cost estimation (using Sonnet 4.5 pricing as default)
        const inputCost = (usage.input_tokens || 0) / 1_000_000 * 3;
        const outputCost = (usage.output_tokens || 0) / 1_000_000 * 15;
        const cacheWriteCost = (usage.cache_creation_input_tokens || 0) / 1_000_000 * 3 * 1.25;
        const cacheReadCost = (usage.cache_read_input_tokens || 0) / 1_000_000 * 3 * 0.1;
        cost += inputCost + outputCost + cacheWriteCost + cacheReadCost;
      }
    }

    return { inputTokens, outputTokens, cost };
  }, [messages]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto bg-zinc-950"
      >
        <div className="mx-auto max-w-3xl px-4 py-4">
          {summary && (
            <div className="mb-6 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
              <h2 className="text-sm font-medium text-zinc-200 leading-relaxed">
                {summary.summary}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
                <span>{allConversationMessages.length} messages</span>
                {usageStats.inputTokens > 0 && (
                  <>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {formatTokens(usageStats.inputTokens + usageStats.outputTokens)} tokens
                    </span>
                    <span className="flex items-center gap-1 text-amber-500/70">
                      <Coins className="w-3 h-3" />
                      {formatCost(usageStats.cost)}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {!summary && usageStats.inputTokens > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500 px-1">
              <span>{allConversationMessages.length} messages</span>
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {formatTokens(usageStats.inputTokens + usageStats.outputTokens)} tokens
              </span>
              <span className="flex items-center gap-1 text-amber-500/70">
                <Coins className="w-3 h-3" />
                {formatCost(usageStats.cost)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {conversationMessages.map((message, index) => (
              <div
                key={message.uuid || index}
                ref={
                  index === conversationMessages.length - 1
                    ? lastMessageRef
                    : undefined
                }
              >
                <MessageBlock message={message} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {!autoScroll && (
        <ScrollToBottomButton
          onClick={() => {
            setAutoScroll(true);
            scrollToBottom();
          }}
        />
      )}

      <button
        onClick={() => setShowOnlyUserMessages(!showOnlyUserMessages)}
        className={`fixed bottom-4 left-6 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full shadow-lg transition-colors cursor-pointer ${
          showOnlyUserMessages
            ? "bg-indigo-600 text-white"
            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        }`}
        title={showOnlyUserMessages ? "Show all messages" : "Show only my messages"}
      >
        {showOnlyUserMessages ? (
          <>
            <User className="w-3.5 h-3.5" />
            <span>My messages</span>
          </>
        ) : (
          <>
            <MessageSquare className="w-3.5 h-3.5" />
            <span>All</span>
          </>
        )}
      </button>
    </div>
  );
}

export default SessionView;
