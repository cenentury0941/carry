"use client";

import { useCallback, useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Brief, BriefInput, ErrorKind, StepName, StreamEvent } from "@/contracts";

type State =
  | { status: "idle" }
  | { status: "running"; steps: Partial<Record<StepName, "start" | "done">> }
  | { status: "done"; brief: Brief }
  | { status: "error"; kind: ErrorKind; message: string };

type Action =
  | { type: "reset" }
  | { type: "start" }
  | { type: "event"; event: StreamEvent };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return { status: "idle" };
    case "start":
      return { status: "running", steps: {} };
    case "event": {
      const e = action.event;
      if (e.type === "step") {
        const steps =
          state.status === "running" ? { ...state.steps } : ({} as State extends never ? never : Partial<Record<StepName, "start" | "done">>);
        steps[e.step] = e.status;
        return { status: "running", steps };
      }
      if (e.type === "brief") {
        return { status: "done", brief: e.brief };
      }
      if (e.type === "error") {
        return { status: "error", kind: e.kind, message: e.message };
      }
      return state;
    }
    default:
      return state;
  }
}

export function useBriefStream() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });
  const queryClient = useQueryClient();

  const start = useCallback(
    async (input: BriefInput) => {
      dispatch({ type: "start" });
      try {
        const res = await fetch("/api/briefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.body) {
          dispatch({
            type: "event",
            event: {
              type: "error",
              kind: "upstream",
              message: "No response stream.",
            },
          });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as StreamEvent;
              dispatch({ type: "event", event });
              if (event.type === "brief") {
                queryClient.setQueryData(["brief", event.brief.id], event.brief);
              }
            } catch {
              // ignore malformed line
            }
          }
        }
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer) as StreamEvent;
            dispatch({ type: "event", event });
            if (event.type === "brief") {
              queryClient.setQueryData(["brief", event.brief.id], event.brief);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        dispatch({
          type: "event",
          event: {
            type: "error",
            kind: "internal",
            message: err instanceof Error ? err.message : "Request failed",
          },
        });
      }
    },
    [queryClient],
  );

  return { state, start, reset: () => dispatch({ type: "reset" }) };
}
