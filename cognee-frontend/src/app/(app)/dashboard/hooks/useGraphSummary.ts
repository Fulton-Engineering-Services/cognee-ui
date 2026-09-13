"use client";

import { useQuery } from "@tanstack/react-query";
import { useCogniInstance, useTenant } from "@/modules/tenant/TenantProvider";
import getDatasetGraphSummary, { type DatasetGraphSummary } from "@/modules/datasets/getDatasetGraphSummary";

// Background poll timeout headroom, same rationale as useDashboardTelemetry —
// a slow pod must not surface as a false error mid-cognify.
const SUMMARY_POLL_INTERVAL_MS = 30_000;
const SUMMARY_POLL_TIMEOUT_MS = 25_000;

export interface GraphSummaryResult {
  summary: DatasetGraphSummary[];
  loading: boolean;
}

/**
 * Per-dataset graph size (nodes/edges), from the GraphMetrics-cached
 * /v1/datasets/graph-summary endpoint — cheap enough to poll continuously,
 * unlike /datasets/{id}/graph's full traversal.
 *
 * Same enabled-gate contract as useDashboardTelemetry: tenantReady, not just
 * cogniInstance, so a freshly-provisioned workspace doesn't burst failed
 * requests against a pod that isn't answering yet.
 *
 * A computedAt of null with a non-null pipelineRunId means the backend's last
 * count attempt degraded and will retry on its next poll (see
 * getDatasetGraphSummary's comment) — callers render such rows as stale
 * rather than dropping them.
 */
export function useGraphSummary(): GraphSummaryResult {
  const { cogniInstance, isInitializing } = useCogniInstance();
  const { tenant, tenantReady } = useTenant();

  const query = useQuery({
    queryKey: ["graph-summary", tenant?.tenant_id ?? null],
    queryFn: async ({ signal }): Promise<DatasetGraphSummary[]> => {
      if (!cogniInstance) throw new Error("cogniInstance unavailable");
      const rows = await getDatasetGraphSummary(cogniInstance, undefined, signal, SUMMARY_POLL_TIMEOUT_MS);
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!cogniInstance && !isInitializing && tenantReady,
    refetchInterval: SUMMARY_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    // This is a poll — the next tick is the retry (same posture as
    // useDashboardTelemetry).
    retry: false,
  });

  return {
    summary: query.data ?? [],
    // isPending (not isLoading) so loading stays true while the query is
    // disabled (no instance yet) — matching useDashboardTelemetry's contract.
    loading: query.isPending,
  };
}
