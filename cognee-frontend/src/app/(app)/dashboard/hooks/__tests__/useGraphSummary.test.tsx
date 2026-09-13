import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockUseCogniInstance = jest.fn();
const mockUseTenant = jest.fn();
jest.mock("@/modules/tenant/TenantProvider", () => ({
  useCogniInstance: () => mockUseCogniInstance(),
  useTenant: () => mockUseTenant(),
}));

import { useGraphSummary } from "../useGraphSummary";

const mockFetch = jest.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseCogniInstance.mockReturnValue({ cogniInstance: { fetch: mockFetch }, isInitializing: false });
  mockUseTenant.mockReturnValue({ tenant: { tenant_id: "t1" }, tenantReady: true });
  mockFetch.mockResolvedValue({ json: async () => [] });
});

describe("useGraphSummary", () => {
  it("fetches graph-summary for every readable dataset", async () => {
    mockFetch.mockResolvedValue({
      json: async () => [
        { datasetId: "ds-1", pipelineRunId: "run-1", numNodes: 5, numEdges: 8, computedAt: "2026-09-13T00:00:00Z" },
      ],
    });

    const { result } = renderHook(() => useGraphSummary(), { wrapper: Wrapper });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/v1/datasets/graph-summary", expect.anything()));
    await waitFor(() => expect(result.current.summary).toHaveLength(1));
    expect(result.current.summary[0].numNodes).toBe(5);
    expect(result.current.loading).toBe(false);
  });

  it("does not poll while the workspace isn't ready", async () => {
    mockUseTenant.mockReturnValue({ tenant: { tenant_id: "t1" }, tenantReady: false });

    const { result } = renderHook(() => useGraphSummary(), { wrapper: Wrapper });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockFetch).not.toHaveBeenCalled();
    // Loading stays true while the query is disabled — the panel keeps its
    // skeleton instead of flashing an empty state against a dead pod.
    expect(result.current.loading).toBe(true);
  });

  it("does not poll without a cogniInstance", async () => {
    mockUseCogniInstance.mockReturnValue({ cogniInstance: null, isInitializing: false });

    renderHook(() => useGraphSummary(), { wrapper: Wrapper });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("degrades a malformed payload to an empty summary", async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ error: "boom" }) });

    const { result } = renderHook(() => useGraphSummary(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary).toEqual([]);
  });
});
