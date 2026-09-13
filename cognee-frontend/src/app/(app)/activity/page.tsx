"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useCogniInstance } from "@/modules/tenant/TenantProvider";
import { useFilter } from "@/ui/layout/FilterContext";
import { AgentActivityTerminal, type Range } from "@/ui/elements/AgentActivityTerminal";
import { useDashboardTelemetry } from "@/app/(app)/dashboard/hooks/useDashboardTelemetry";
import { RangeToggle } from "@/app/(app)/dashboard/partials/redesign/RangeToggle";
import { FONT, T } from "@/app/(app)/dashboard/partials/redesign/mono";
import { TrackPageView } from "@/modules/analytics";

/**
 * Self-hosted implementation — the full memory-event log: the same
 * AgentActivityTerminal the onboarding flow uses, fed by the dashboard's
 * polled telemetry (pipeline runs + sessions). Replaces the open-source
 * stub that rendered an "Activity is a Cognee Cloud feature" notice.
 */
export default function ActivityLogPage() {
  const router = useRouter();
  const { cogniInstance, isInitializing } = useCogniInstance();
  const { datasets, agents, selectedDataset, loading: filterLoading } = useFilter();
  const [range, setRange] = useState<Range>("7d");
  const { runs, sessions, loading } = useDashboardTelemetry(range);

  const dataLoading = loading || isInitializing || filterLoading;

  return (
    <div style={{ minHeight: "100%", padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 18, flexShrink: 0 }}>
      <TrackPageView page="Activity" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ ...FONT, margin: 0, fontSize: 20, fontWeight: 300, color: T.text }}>Activity</h1>
          <p style={{ ...FONT, margin: "5px 0 0", fontSize: 13, color: T.muted }}>
            Every memory event — pipeline runs, recalls, and agent searches — with the evidence behind each answer.
          </p>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>

      <AgentActivityTerminal
        sessions={sessions}
        runs={runs}
        agents={agents}
        datasets={datasets}
        selectedDataset={selectedDataset}
        cogniInstance={cogniInstance}
        dataLoading={dataLoading}
        range={range}
        onNavigate={(path) => router.push(path)}
      />
    </div>
  );
}
