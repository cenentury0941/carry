"use client";

import { useCallback, useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MoveProject, MoveStepName, MoveStreamEvent } from "@/contracts";

type State =
  | { status: "idle" }
  | { status: "running"; steps: Partial<Record<MoveStepName, "start" | "done">> }
  | { status: "done"; move: MoveProject }
  | { status: "error"; message: string };

type Action =
  | { type: "start" }
  | { type: "event"; event: MoveStreamEvent }
  | { type: "reset" };

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
          state.status === "running" ? { ...state.steps } : {};
        steps[e.step] = e.status;
        return { status: "running", steps };
      }
      if (e.type === "move") return { status: "done", move: e.move };
      if (e.type === "error")
        return { status: "error", message: e.message };
      return state;
    }
    default:
      return state;
  }
}

export function useMoveStream() {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });
  const queryClient = useQueryClient();

  const start = useCallback(
    async (moveId: string) => {
      dispatch({ type: "start" });
      try {
        const res = await fetch(`/api/moves/${moveId}/run`, { method: "POST" });
        if (!res.body) {
          dispatch({
            type: "event",
            event: {
              type: "error",
              kind: "upstream",
              message: "No response stream",
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
              const event = JSON.parse(line) as MoveStreamEvent;
              dispatch({ type: "event", event });
              if (event.type === "move") {
                queryClient.setQueryData(["move", moveId], event.move);
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        dispatch({
          type: "event",
          event: {
            type: "error",
            kind: "internal",
            message: err instanceof Error ? err.message : "Run failed",
          },
        });
      }
    },
    [queryClient],
  );

  return { state, start, reset: () => dispatch({ type: "reset" }) };
}
