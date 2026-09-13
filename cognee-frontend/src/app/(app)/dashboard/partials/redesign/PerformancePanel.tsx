"use client";

import React from "react";
import type { DatasetGraphSummary } from "@/modules/datasets/getDatasetGraphSummary";
import { AsciiFrame } from "./AsciiFrame";
import { FONT, T } from "./mono";

/**
 * Self-hosted implementation — per-dataset graph inventory (nodes/edges),
 * from the GraphMetrics-cached /v1/datasets/graph-summary endpoint (fetched
 * by useGraphSummary). Replaces the open-source stub that rendered a
 * "Memory Coverage is a Cognee Cloud feature" notice.
 */

export interface TopicScore { name: string; pct: number | null }

interface PerformancePanelProps {
  graphSummary: DatasetGraphSummary[] | null;
  datasets: { id: string; name: string }[];
  loading?: boolean;
  onUpload?: () => void;
  onViewGraph?: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function PerformancePanel({ graphSummary, datasets, loading, onUpload, onViewGraph }: PerformancePanelProps): React.ReactElement {
  const nameById = new Map(datasets.map((d) => [d.id, d.name]));

  // Only rows the backend actually computed count toward the totals —
  // computedAt null with a run id means the count attempt degraded and the
  // backend retries on its next poll (see getDatasetGraphSummary).
  const rows = (graphSummary ?? [])
    .map((s) => ({ ...s, name: nameById.get(s.datasetId) ?? s.datasetId.slice(0, 8) }))
    .sort((a, b) => b.numNodes - a.numNodes);
  const counted = rows.filter((r) => r.computedAt != null);
  const totalNodes = counted.reduce((s, r) => s + r.numNodes, 0);
  const totalEdges = counted.reduce((s, r) => s + r.numEdges, 0);
  const maxNodes = Math.max(1, ...counted.map((r) => r.numNodes));

  const hasAny = datasets.length > 0;
  const hasCounts = counted.some((r) => r.numNodes > 0 || r.numEdges > 0);

  return (
    <AsciiFrame
      label="Memory"
      meta={
        onViewGraph && (
          <button type="button" onClick={onViewGraph} style={{ ...FONT, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T.lavender, padding: 0 }}>
            View graph →
          </button>
        )
      }
      minHeight={260}
    >
      {!hasAny ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, ...FONT }}>
          <span style={{ fontSize: 13, color: T.muted }}>No datasets yet — your graph builds as data lands.</span>
          {onUpload && (
            <button
              type="button"
              onClick={onUpload}
              style={{ background: T.lavender, color: "#000000", borderRadius: 0, padding: "7px 18px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Upload data
            </button>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, ...FONT, minHeight: 0 }}>
          {/* Totals row */}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>Nodes</span>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{fmt(totalNodes)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>Edges</span>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{fmt(totalEdges)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.faint }}>Datasets</span>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{datasets.length}</span>
            </div>
          </div>

          {/* Per-dataset node/edge bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", minHeight: 0 }}>
            {rows.map((r) => {
              const stale = r.computedAt == null;
              return (
                <div key={r.datasetId} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: T.muted, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ flex: 1, height: 6, background: T.chromeAlt, position: "relative", overflow: "hidden" }}>
                    <span style={{ position: "absolute", inset: 0, width: `${Math.max(2, (r.numNodes / maxNodes) * 100)}%`, background: stale ? T.faint : T.lavender, opacity: stale ? 0.4 : 0.75 }} />
                  </span>
                  <span style={{ fontSize: 11, color: stale ? T.faint : T.text, width: 108, textAlign: "right", flexShrink: 0 }}>
                    {stale ? (r.pipelineRunId ? "computing…" : "never cognified") : `${fmt(r.numNodes)}n · ${fmt(r.numEdges)}e`}
                  </span>
                </div>
              );
            })}
          </div>

          {!hasCounts && !loading && (
            <span style={{ fontSize: 11, color: T.faint }}>Counts appear after the first cognify run on a dataset.</span>
          )}
        </div>
      )}
    </AsciiFrame>
  );
}
