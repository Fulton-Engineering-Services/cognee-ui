"use client";

import React from "react";
import type { SessionRow } from "@/modules/sessions/getSessions";
import type { PipelineRun } from "@/ui/elements/AgentActivityTerminal";
import { ownerDisplayName, actorColor } from "@/ui/elements/AgentActivityTerminal";
import { timeAgo } from "@/utils/timeAgo";
import type { Agent, Dataset } from "@/ui/layout/FilterContext";
import { AsciiFrame } from "./AsciiFrame";
import { FONT, T } from "./mono";

/**
 * Self-hosted implementation — a compact live feed of the workspace's memory
 * events (pipeline runs + single operations), from the same polled data the
 * full /activity terminal uses. Replaces the open-source stub that rendered
 * an "Activity is a Cognee Cloud feature" notice.
 */

interface ActivityPanelProps {
  runs: PipelineRun[];
  sessions: SessionRow[];
  agents: Agent[];
  datasets: Dataset[];
  onViewFullLog?: () => void;
}

type Outcome = "done" | "error" | "running" | "other";
const OUTCOME_COLOR: Record<Outcome, string> = {
  done: T.green,
  error: T.red,
  running: T.amber,
  other: T.faint,
};

function runOutcome(run: PipelineRun): Outcome {
  // PipelineRun.outcome (when the backend reports it) is authoritative;
  // otherwise classify from the pipeline status string.
  if (run.outcome === "hit" || run.outcome === "done") return "done";
  if (run.outcome === "error") return "error";
  if (run.outcome === "empty") return "other";
  const s = run.status ?? "";
  if (s.includes("COMPLETED") || s.includes("SUCCESS")) return "done";
  if (s.includes("ERROR") || s.includes("FAIL")) return "error";
  if (s.includes("START") || s.includes("REQUEST") || s.includes("PROGRESS") || run.outcome === "running") return "running";
  return "other";
}

function runLabel(run: PipelineRun): string {
  if (run.kind === "operation") return run.operation_name ?? "operation";
  const n = run.pipeline_name ?? "pipeline";
  if (n.includes("cognify")) return "cognee.cognify";
  if (n.includes("add")) return "cognee.add";
  if (n.includes("memify")) return "cognee.memify";
  if (n.includes("search")) return "cognee.search";
  return n;
}

function OutcomeMark({ outcome }: { outcome: Outcome }): React.ReactElement {
  if (outcome === "running") {
    return <span aria-hidden style={{ color: OUTCOME_COLOR.running, flexShrink: 0, width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${T.frameStrong}`, borderTopColor: OUTCOME_COLOR.running, animation: "flow-spin 0.8s linear infinite", display: "inline-block" }} />;
  }
  const mark = outcome === "done" ? "✓" : outcome === "error" ? "✗" : "·";
  return <span aria-hidden style={{ color: OUTCOME_COLOR[outcome], flexShrink: 0 }}>{mark}</span>;
}

const VISIBLE_ROWS = 8;

export function ActivityPanel({ runs, sessions, onViewFullLog }: ActivityPanelProps): React.ReactElement {
  const anyRunning = runs.some((r) => runOutcome(r) === "running") || sessions.some((s) => s.effective_status === "running");
  // Newest first; useDashboardTelemetry already dedupes by pipeline_run_id.
  const rows = [...runs]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, VISIBLE_ROWS);

  return (
    <AsciiFrame
      label="Activity"
      meta={
        anyRunning ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.green, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block", animation: "flow-live 1.8s ease-in-out infinite" }} />
            live
          </span>
        ) : undefined
      }
      minHeight={260}
    >
      {/* Keyframes declared here too: this panel can render without the memory
          flow diagram on the page (it shares the flow-live/flow-spin names). */}
      <style>{`@keyframes flow-live { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
      @keyframes flow-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", ...FONT, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", minHeight: 0 }}>
          {rows.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: T.muted }}>No memory events in this window.</span>
            </div>
          ) : (
            rows.map((r) => {
              const outcome = runOutcome(r);
              const actor = ownerDisplayName(r.owner_email);
              return (
                <div
                  key={r.pipeline_run_id || r.id}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: `1px solid ${T.chromeAlt}`, minWidth: 0 }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: actorColor(actor), flexShrink: 0 }} aria-hidden />
                  <span style={{ fontSize: 11, color: T.faint, width: 52, flexShrink: 0 }}>{timeAgo(r.created_at ?? "")}</span>
                  <span style={{ fontSize: 12, color: T.text, flexShrink: 0 }}>{runLabel(r)}</span>
                  <span style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.kind === "operation" ? actor : (r.dataset_name ?? "")}
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <OutcomeMark outcome={outcome} />
                  </span>
                </div>
              );
            })
          )}
        </div>
        {onViewFullLog && (
          <button
            type="button"
            onClick={onViewFullLog}
            style={{ ...FONT, flexShrink: 0, marginTop: 8, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.lavender, padding: 0, textAlign: "right" }}
          >
            View full log →
          </button>
        )}
      </div>
    </AsciiFrame>
  );
}
