import React from "react";
import {
  getAiUsageSummary,
  getAiFluencyScore,
  getPendingAllocations,
  getAiAllocationHistory,
  getSprintItems,
  getTeamMembers,
  acceptAllocation,
  manualAllocate,
  manualAllocateNoSuggestion,
} from "../../../services/api.js";

export function useUsoIa() {
  const [selectedUserId, setSelectedUserId] = React.useState(null);
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Summary
  const [summary, setSummary] = React.useState(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState(null);

  // Fluency
  const [fluency, setFluency] = React.useState(null);
  const [fluencyLoading, setFluencyLoading] = React.useState(false);
  const [fluencyError, setFluencyError] = React.useState(null);

  // Pending allocations
  const [pending, setPending] = React.useState([]);
  const [pendingLoading, setPendingLoading] = React.useState(false);
  const [pendingError, setPendingError] = React.useState(null);

  // History
  const [history, setHistory] = React.useState(null);
  const [historyPage, setHistoryPage] = React.useState(0);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState(null);

  // Sprint items
  const [sprintItems, setSprintItems] = React.useState([]);

  // Team members
  const [teamMembers, setTeamMembers] = React.useState([]);

  // Fetch summary, fluency, pending on selectedUserId or month change
  React.useEffect(() => {
    const params = selectedUserId ? { month, userId: selectedUserId } : { month };

    setSummaryLoading(true);
    setSummaryError(null);
    getAiUsageSummary(params)
      .then(setSummary)
      .catch((e) => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false));

    setFluencyLoading(true);
    setFluencyError(null);
    const fParams = selectedUserId ? { userId: selectedUserId } : {};
    getAiFluencyScore(fParams)
      .then(setFluency)
      .catch((e) => setFluencyError(e.message))
      .finally(() => setFluencyLoading(false));

    setPendingLoading(true);
    setPendingError(null);
    const pParams = selectedUserId ? { userId: selectedUserId } : {};
    getPendingAllocations(pParams)
      .then((data) => setPending(Array.isArray(data) ? data : []))
      .catch((e) => setPendingError(e.message))
      .finally(() => setPendingLoading(false));
  }, [selectedUserId, month]);

  // Fetch history when page changes
  React.useEffect(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    const hParams = {
      month,
      page: historyPage,
      size: 20,
      ...(selectedUserId ? { userId: selectedUserId } : {}),
    };
    getAiAllocationHistory(hParams)
      .then(setHistory)
      .catch((e) => setHistoryError(e.message))
      .finally(() => setHistoryLoading(false));
  }, [selectedUserId, month, historyPage]);

  // Fetch sprint items + team members once on mount
  React.useEffect(() => {
    getSprintItems()
      .then((data) => setSprintItems(Array.isArray(data) ? data : []))
      .catch(() => {});
    getTeamMembers()
      .then((data) => setTeamMembers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const removePendingCard = React.useCallback((day) => {
    setPending((prev) => prev.filter((b) => b.day !== day));
  }, []);

  return {
    selectedUserId,
    setSelectedUserId,
    month,
    setMonth,
    summary,
    summaryLoading,
    summaryError,
    fluency,
    fluencyLoading,
    fluencyError,
    pending,
    pendingLoading,
    pendingError,
    removePendingCard,
    history,
    historyPage,
    setHistoryPage,
    historyLoading,
    historyError,
    sprintItems,
    teamMembers,
    acceptAllocation,
    manualAllocate,
    manualAllocateNoSuggestion,
  };
}
