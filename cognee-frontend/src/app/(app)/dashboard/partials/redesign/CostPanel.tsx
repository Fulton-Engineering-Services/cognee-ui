"use client";

import React from "react";
import type { SessionRow } from "@/modules/sessions/getSessions";
import {
  estimateCostUsd,
  estimateNoCogneeCostUsd,
  channelForSessionId,
} from "@/modules/sessions/getSessions";
import type { TenantHourlyCosts } from "@/modules/billing/getTenantHourlyCosts";
import type { PipelineRun } from "@/ui/elements/AgentActivityTerminal";
import { AsciiFrame } from "./AsciiFrame";
import { FONT, T } from "./mono";
import { RangeToggle, type DashRange } from "./RangeToggle";

/**
 * Self-hosted implementation — token usage and estimated spend for the
 * selected range, derived entirely from data the pod reports (/v1/sessions
 * rows, polled by useDashboardTelemetry). The pod prices LiteLLM-routed
 * calls at $0 (it can't resolve the gateway alias), so cost is estimated
 * from token counts at the per-deploy NEXT_PUBLIC_* flat rates defined in
 * getSessions — the same math the Sessions page uses. Replaces the
 * open-source stub that rendered a "Cognee Cloud feature" notice.
 */

interface CostPanelProps {
  sessions: SessionRow[];
  runs: PipelineRun[];
  balanceUsd: number | null;
  range: DashRange;
  onRangeChange: (range: DashRange) => void;
  // Cloud-only billing endpoint — always null on a self-hosted pod. Kept in
  // the interface for upstream-merge safety; never rendered.
  hourlyCosts?: TenantHourlyCosts | null;
  onViewBreakdown?: () => void;
}

const CHANNEL_COLORS = [T.lavender, T.blue, T.green, T.amber];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StatBlock({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 600, color: color ?? T.text, letterSpacing: "-0.01em" }}>{value}</span>
      {hint && <span style={{ fontSize: 11, color: T.muted }}>{hint}</span>}
    </div>
  );
}

export function CostPanel({ sessions, runs, range, onRangeChange, onViewBreakdown }: CostPanelProps): React.ReactElement {
  const tokensIn = sessions.reduce((s, x) => s + (x.tokens_in || 0), 0);
  const tokensOut = sessions.reduce((s, x) => s + (x.tokens_out || 0), 0);
  const tokensTotal = tokensIn + tokensOut;
  const estCost = estimateCostUsd(tokensIn, tokensOut);
  // No-cognee baseline: the same work without memory re-sends ~7× the tokens
  // at frontier list price (getSessions' documented model). Estimated — the
  // multiplier and rates are env-overridable per deploy.
  const estSaved = estimateNoCogneeCostUsd(tokensTotal) - estCost;

  const active = sessions.filter((s) => s.effective_status === "running").length;
  const errored = sessions.reduce((s, x) => s + (x.error_count || 0), 0);

  // Token share per access channel (UI / per-agent / bare API) — the same
  // prefix detection the overview's agent list and the Sessions page use.
  const byChannel = new Map<string, number>();
  for (const s of sessions) {
    const ch = channelForSessionId(s.session_id);
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + (s.tokens_in || 0) + (s.tokens_out || 0));
  }
  const channels = [...byChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxChannel = channels[0]?.[1] ?? 0;

  const hasUsage = sessions.length > 0 || runs.length > 0;

  return (
    <AsciiFrame
      label="Token Usage"
      meta={<RangeToggle value={range} onChange={onRangeChange} />}
      minHeight={260}
    >
      {/* Panel-local keyframes: CostPanel can render without the memory flow
          diagram, which also declares flow-live. */}
      <style>{`@keyframes flow-live { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }`}</style>
      {!hasUsage ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...FONT }}>
          <span style={{ fontSize: 13, color: T.muted }}>No token usage in this range.</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, ...FONT }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <StatBlock label="Tokens in" value={fmtTokens(tokensIn)} />
            <StatBlock label="Tokens out" value={fmtTokens(tokensOut)} />
            <StatBlock label="Total" value={fmtTokens(tokensTotal)} />
            <StatBlock
              label="Est. spend"
              value={`$${estCost.toFixed(2)}`}
              hint={estSaved > 0 ? `~$${estSaved.toFixed(2)} avoided vs. no-memory baseline` : undefined}
              color={T.lavender}
            />
          </div>

          {/* Session health strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: T.muted, flexWrap: "wrap" }}>
            <span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
            {active > 0 && <span style={{ color: T.green, display: "inline-flex", alignItems: "center", gap: 5 }}><StatusDot /> {active} running</span>}
            {errored > 0 && <span style={{ color: T.red }}>{errored} error{errored === 1 ? "" : "s"}</span>}
          </div>

          {/* Token share by access channel */}
          {channels.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {channels.map(([name, tokens], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: T.muted, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  <span style={{ flex: 1, height: 6, background: T.chromeAlt, position: "relative", overflow: "hidden" }}>
                    <span style={{ position: "absolute", inset: 0, width: `${maxChannel > 0 ? Math.max(3, (tokens / maxChannel) * 100) : 0}%`, background: CHANNEL_COLORS[i % CHANNEL_COLORS.length], opacity: 0.75 }} />
                  </span>
                  <span style={{ fontSize: 11, color: T.text, width: 52, textAlign: "right", flexShrink: 0 }}>{fmtTokens(tokens)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onViewBreakdown}
              style={{ ...FONT, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.lavender, padding: 0 }}
            >
              View breakdown →
            </button>
          </div>
        </div>
      )}
    </AsciiFrame>
  );
}

function StatusDot(): React.ReactElement {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block", animation: "flow-live 1.8s ease-in-out infinite" }} />;
}
