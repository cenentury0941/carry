"use client";

import { useEffect, useRef, useState } from "react";
import type { MoveChatResult, MoveProject } from "@/contracts";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  moveId: string;
  destinationId?: string;
  onMoveUpdated: (move: MoveProject) => void;
};

async function readChatResult(res: Response): Promise<MoveChatResult> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      kind: "error",
      message: res.ok
        ? "Empty response from chat. Try again."
        : `Chat failed (${res.status}). Try again.`,
    };
  }
  try {
    return JSON.parse(text) as MoveChatResult;
  } catch {
    return {
      kind: "error",
      message: `Chat returned non-JSON (${res.status}). Try again.`,
    };
  }
}

export function ResultsChat({ moveId, destinationId, onMoveUpdated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask about continuity, venues, or tastes — or tell me to change priorities, add tags/targets, and I’ll refresh Qloo matches. Want better local fits? Edit the move and add more day-to-day places or spots you’re into around your current home, then re-run.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setBusy(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`/api/moves/${moveId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          destinationId,
          history,
        }),
      });
      const json = await readChatResult(res);
      if (!res.ok || json.kind === "error") {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content:
              json.kind === "error"
                ? json.message
                : "Something went wrong. Try again.",
          },
        ]);
        return;
      }
      if (json.kind === "move") {
        onMoveUpdated(json.move);
      }
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: json.message,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : "Chat failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-zinc-200 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">Carry chat</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <p className="text-xs text-zinc-500">Thinking…</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={send}
        className="shrink-0 border-t border-zinc-200 p-3"
      >
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            placeholder="Ask or change tastes…"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
