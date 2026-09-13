"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useCogniInstance } from "@/modules/tenant/TenantProvider";
import { TrackPageView } from "@/modules/analytics";
import {
  listSessions,
  getSessionStats,
  estimateCostUsd,
  channelForSessionId,
  type SessionRow,
  type SessionStats,
} from "@/modules/sessions/getSessions";
import { RangeToggle, type DashRange } from "@/app/(app)/dashboard/partials/redesign/RangeToggle";
import { AsciiFrame } from "@/app/(app)/dashboard/partials/redesign/AsciiFrame";
import { FONT, T } from "@/app/(app)/dashboard/partials/redesign/mono";

/**
 * Self-hosted implementation — usage and token economics for the selected
 * range, from the pod's own endpoints (/v1/sessions, /v1/sessions/stats,
 * /v1/sessions/cost-by-model). Replaces the open-source stub that rendered
 * an "Analytics is a Cognee Cloud feature" notice.
 */

interface CostByModelRow {
  model: string;
  session_count: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
}

const CHANNEL_COLORS = [T.lavender, T.blue, T.green, T.amber];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.round(seconds)}s`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): React.ReactElement {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.frame}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{value}</span>
      {hint && <span style={{ fontSize: 11, color: T.muted }}>{hint}</span>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { cogniInstance, isInitializing } = useCogniInstance();
  const [range, setRange] = useState<DashRange>("7d");
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [byModel, setByModel] = useState<CostByModelRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!cogniInstance) { setLoading(false); return; }
    setLoading(true);
    const [statsRes, modelRes, sessionRes] = await Promise.all([
      getSessionStats(cogniInstance, range),
      // No module client for this endpoint yet — fetched directly; a malformed
      // payload degrades to an empty table rather than breaking the page.
      cogniInstance
        .fetch(`/v1/sessions/cost-by-model?range=${range}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      listSessions(cogniInstance, { range, limit: 200 }),
    ]);
    setStats(statsRes);
    setByModel(Array.isArray(modelRes) ? modelRes : []);
    setSessions(sessionRes.sessions);
    setLoading(false);
  }, [cogniInstance, range]);

  useEffect(() => { if (!isInitializing) load(); }, [isInitializing, load]);

  // Token share per access channel (UI / per-agent / bare API).
  const byChannel = new Map<string, number>();
  for (const s of sessions) {
    const ch = channelForSessionId(s.session_id);
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + (s.tokens_in || 0) + (s.tokens_out || 0));
  }
  const channels = [...byChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxChannel = channels[0]?.[1] ?? 0;
  const tokensTotal = (stats?.tokens_in ?? 0) + (stats?.tokens_out ?? 0);
  const estCost = estimateCostUsd(stats?.tokens_in ?? 0, stats?.tokens_out ?? 0);

  return (
    <div style={{ minHeight: "100%", padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 18, flexShrink: 0 }}>
      <TrackPageView page="Analytics" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ ...FONT, margin: 0, fontSize: 20, fontWeight: 300, color: T.text }}>Analytics</h1>
          <p style={{ ...FONT, margin: "5px 0 0", fontSize: 13, color: T.muted }}>
            Token usage and session economics across your workspace
          </p>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, ...FONT }}>
        <StatCard label="Sessions" value={stats ? String(stats.sessions) : "—"} hint={stats ? `${stats.running} running · ${stats.completed} done` : undefined} />
        <StatCard label="Success rate" value={stats ? `${Math.round(stats.success_rate * 100)}%` : "—"} hint={stats ? `${stats.failed} failed · ${stats.abandoned} abandoned` : undefined} />
        <StatCard label="Agent time" value={stats ? fmtDuration(stats.agent_time_s) : "—"} hint={stats ? `avg ${fmtDuration(stats.avg_session_s)}/session` : undefined} />
        <StatCard label="Tokens" value={stats ? fmtTokens(tokensTotal) : "—"} hint={stats ? `${fmtTokens(stats.tokens_in)} in · ${fmtTokens(stats.tokens_out)} out` : undefined} />
        <StatCard label="Est. spend" value={`$${estCost.toFixed(2)}`} hint="flat-rate estimate" />
      </div>

      {/* Per-model table */}
      <AsciiFrame label="By model" minHeight={200}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", ...FONT, minHeight: 0 }}>
          {byModel.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: T.muted }}>{loading ? "Loading…" : "No model usage in this range."}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.frameStrong}`, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>
                <span style={{ flex: "2 1 0", minWidth: 0 }}>Model</span>
                <span style={{ width: 64, textAlign: "right", flexShrink: 0 }}>Calls</span>
                <span style={{ width: 80, textAlign: "right", flexShrink: 0 }}>In</span>
                <span style={{ width: 80, textAlign: "right", flexShrink: 0 }}>Out</span>
                <span style={{ width: 84, textAlign: "right", flexShrink: 0 }}>Est. cost</span>
              </div>
              {byModel.map((m) => (
                <div key={m.model} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.chromeAlt}`, fontSize: 12, minWidth: 0 }}>
                  <span style={{ flex: "2 1 0", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.model}>{m.model}</span>
                  <span style={{ width: 64, textAlign: "right", color: T.muted, flexShrink: 0 }}>{m.session_count}</span>
                  <span style={{ width: 80, textAlign: "right", color: T.muted, flexShrink: 0 }}>{fmtTokens(m.tokens_in)}</span>
                  <span style={{ width: 80, textAlign: "right", color: T.muted, flexShrink: 0 }}>{fmtTokens(m.tokens_out)}</span>
                  <span style={{ width: 84, textAlign: "right", color: T.text, flexShrink: 0 }}>${estimateCostUsd(m.tokens_in, m.tokens_out).toFixed(2)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </AsciiFrame>

      {/* Token share by channel */}
      <AsciiFrame label="By access channel" minHeight={180}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, ...FONT, minHeight: 0, justifyContent: "center" }}>
          {channels.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: T.muted }}>{loading ? "Loading…" : "No token usage in this range."}</span>
            </div>
          ) : (
            channels.map(([name, tokens], i) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 11, color: T.muted, width: 130, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ flex: 1, height: 6, background: T.chromeAlt, position: "relative", overflow: "hidden" }}>
                  <span style={{ position: "absolute", inset: 0, width: `${maxChannel > 0 ? Math.max(3, (tokens / maxChannel) * 100) : 0}%`, background: CHANNEL_COLORS[i % CHANNEL_COLORS.length], opacity: 0.75 }} />
                </span>
                <span style={{ fontSize: 11, color: T.text, width: 56, textAlign: "right", flexShrink: 0 }}>{fmtTokens(tokens)}</span>
              </div>
            ))
          )}
        </div>
      </AsciiFrame>

      <p style={{ ...FONT, margin: 0, fontSize: 11, color: T.faint }}>
        Spend figures are estimates from token counts at a flat per-1M-token rate (NEXT_PUBLIC_LLM_COST_PER_1M_TOKENS);
        LiteLLM-routed calls report $0 to the pod. The avoided-spend comparison uses the no-memory baseline in
        getSessions (7× tokens at frontier list price) — both are per-deploy overridable.
      </p>
    </div>
  );
}
