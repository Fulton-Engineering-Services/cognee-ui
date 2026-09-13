"use client";

import React from "react";
import { FONT, T } from "./mono";

/**
 * Self-hosted implementation — the hub-and-spoke memory graph (data sources,
 * live agent/health status) built from the pod's own API: sources are the
 * workspace's datasets (FilterContext + /v1/datasets/status), the core's
 * health is the /health probe, and agents derive from session-id prefixes.
 * Replaces the open-source stub that blurred this out as a Cognee Cloud
 * feature. Upstream merge note: the props interface is unchanged from the
 * stub, so the SaaS build keeps syncing unchanged.
 */

export type NodeStatus = "live" | "connected" | "reconnect" | "disconnected";

export interface FlowNodeData {
  name: string;
  logo: string;
  status: NodeStatus;
  avatar?: { initials: string; color: string };
}

export type FlowSource = FlowNodeData;
export type FlowAgent = FlowNodeData;
export type FlowUserNode = FlowNodeData;

interface MemoryFlowDiagramProps {
  sources: FlowSource[];
  agents: FlowAgent[];
  healthy: boolean;
  onInvite?: () => void;
  onCoreClick?: () => void;
  onNodeNavigate?: () => void;
  onTeamsClick?: () => void;
}

const STATUS_META: Record<NodeStatus, { color: string; label: string }> = {
  live:         { color: T.green,   label: "live" },
  connected:    { color: T.green,   label: "connected" },
  reconnect:    { color: T.amber,   label: "processing" },
  disconnected: { color: T.faint,   label: "idle" },
};

/** Dataset glyph — a simple database cylinder, drawn inline (no asset needed). */
function DatasetGlyph(): React.ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.lavender} strokeWidth="1.6" aria-hidden>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.66 3.58 3 8 3s8-1.34 8-3v-13" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

function StatusDot({ status, pulse }: { status: NodeStatus; pulse?: boolean }): React.ReactElement {
  const { color } = STATUS_META[status];
  return (
    <span
      aria-hidden
      style={{
        width: 7, height: 7, borderRadius: "50%", background: color,
        flexShrink: 0, display: "inline-block",
        animation: pulse ? "flow-live 1.8s ease-in-out infinite" : undefined,
      }}
    />
  );
}

function LogoChip({ logo }: { logo: string }): React.ReactElement {
  if (logo === "dataset") return <DatasetGlyph />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/visuals/logos/${logo}.svg`}
      alt=""
      width={22}
      height={22}
      style={{ flexShrink: 0, opacity: 0.9 }}
      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
    />
  );
}

function NodeChip({ node, glyph, onClick }: { node: FlowNodeData; glyph?: "dataset"; onClick?: () => void }): React.ReactElement {
  const meta = STATUS_META[node.status];
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-label={`${node.name}: ${meta.label}`}
      title={`${node.name} — ${meta.label}`}
      style={{
        ...FONT,
        display: "flex", alignItems: "center", gap: 9,
        maxWidth: 190, padding: "7px 12px",
        background: T.chromeAlt, border: `1px solid ${T.frame}`,
        borderRadius: 0, cursor: interactive ? "pointer" : "default",
        color: T.text, textAlign: "left", pointerEvents: interactive ? "auto" : "none",
      }}
    >
      {glyph === "dataset" ? <DatasetGlyph /> : <LogoChip logo={node.logo} />}
      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
      <StatusDot status={node.status} pulse={node.status === "live"} />
    </button>
  );
}

/** Dotted leader line between a node chip and the core, with the status color. */
function Leader({ status }: { status: NodeStatus }): React.ReactElement {
  return (
    <span aria-hidden style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 24 }}>
      <span style={{ flex: 1, borderTop: `1px dashed ${T.frameStrong}` }} />
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_META[status].color, opacity: 0.8, flexShrink: 0 }} />
    </span>
  );
}

export function MemoryFlowDiagram({
  sources, agents, healthy, onCoreClick, onNodeNavigate,
}: MemoryFlowDiagramProps): React.ReactElement {
  // Persistent layout even when empty, so the panel never collapses: each
  // side reserves room for at least one muted placeholder chip.
  const sourceNodes = sources.length > 0 ? sources : [{ name: "No datasets yet", logo: "dataset", status: "disconnected" as NodeStatus }];
  const agentNodes = agents.length > 0 ? agents : [{ name: "No agents connected", logo: "mcp", status: "disconnected" as NodeStatus }];

  return (
    <div style={{ position: "relative" }} role="img" aria-label={`Memory graph: ${sources.length} datasets, core ${healthy ? "healthy" : "unreachable"}, ${agents.length} agents`}>
      <style>{`@keyframes flow-live { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
      @keyframes core-pulse { 0%,100%{ box-shadow: 0 0 0 0 rgba(188,155,255,0.30);} 50%{ box-shadow: 0 0 0 10px rgba(188,155,255,0);} }`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "30px 18px", flexWrap: "wrap" }}>
        {/* Sources (datasets) — chips aligned toward the core with leader lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 240, alignItems: "stretch" }}>
          {sourceNodes.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <NodeChip node={s} glyph="dataset" />
              <Leader status={s.status} />
            </div>
          ))}
        </div>

        {/* Core — cognee memory; health from the /health probe */}
        <button
          type="button"
          onClick={onCoreClick}
          aria-label={healthy ? "cognee memory core — healthy" : "cognee memory core — unreachable"}
          title={healthy ? "Memory core is healthy" : "Memory core is unreachable"}
          style={{
            ...FONT, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "0 22px", background: "none", border: "none", cursor: "pointer", flexShrink: 0,
          }}
        >
          <span style={{
            width: 68, height: 68, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: healthy ? T.purpleSoft : "rgba(240,128,138,0.12)",
            border: `1px solid ${healthy ? T.frameStrong : "rgba(240,128,138,0.4)"}`,
            animation: healthy ? "core-pulse 2.4s ease-in-out infinite" : undefined,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/visuals/logos/cognee.svg" alt="" width={30} height={30} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </span>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: healthy ? T.green : T.red }}>
            {healthy ? "memory live" : "unreachable"}
          </span>
        </button>

        {/* Agents — live while a matching session is running (OverviewPage derives) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 240, alignItems: "stretch" }}>
          {agentNodes.map((a) => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <Leader status={a.status} />
              <NodeChip node={a} onClick={onNodeNavigate} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
