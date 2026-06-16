import React from "react";
import { useUsoIa } from "./hooks/useUsoIa.js";
import { MetricsHeader } from "./components/MetricsHeader.jsx";
import { FluencyScoreSection } from "./components/FluencyScoreSection.jsx";
import { PendingAllocationCard } from "./components/PendingAllocationCard.jsx";
import { AllocationModal } from "./components/AllocationModal.jsx";
import { AllocationHistory } from "./components/AllocationHistory.jsx";

/**
 * @param {{ can: (tab: string) => boolean }} props
 */
export function UsoIaPage({ can }) {
  const {
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
  } = useUsoIa();

  const [modalBatch, setModalBatch] = React.useState(null);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const canSeeTeam = can("uso-ia-team");
  const isReadOnly = !!selectedUserId && canSeeTeam;

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAccept(batch) {
    try {
      await acceptAllocation(batch.suggestionAllocationId);
      removePendingCard(batch.day);
      showToast("Alocação aceita com sucesso.");
    } catch {
      showToast("Erro ao aceitar alocação.", false);
    }
  }

  function handleAdjust(batch) {
    setModalBatch(batch);
  }

  async function handleModalConfirm(splits) {
    setModalLoading(true);
    try {
      if (modalBatch.suggestionAllocationId) {
        await manualAllocate(modalBatch.suggestionAllocationId, splits);
      } else {
        await manualAllocateNoSuggestion(modalBatch.day, splits);
      }
      removePendingCard(modalBatch.day);
      setModalBatch(null);
      showToast("Alocação salva com sucesso.");
    } catch {
      showToast("Erro ao salvar alocação.", false);
    } finally {
      setModalLoading(false);
    }
  }

  const selectedMember = canSeeTeam && selectedUserId
    ? teamMembers.find((m) => m.id === selectedUserId)
    : null;

  return (
    <section>
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">
          {selectedMember ? `Uso IA — ${selectedMember.name || selectedMember.email}` : "Uso IA"}
        </h2>
        <p className="admin-section-sub">
          Acompanhe o consumo de IA, score de fluência e aloque o uso aos work items.
        </p>
      </div>

      {/* Manager team member selector */}
      {canSeeTeam && teamMembers.length > 0 && (
        <div style={{ marginBottom: "var(--spacing-md, 16px)", display: "flex", alignItems: "center", gap: 8 }}>
          <label className="label" style={{ fontSize: "0.8rem" }}>Visualizar como:</label>
          <div className="signup-select" style={{ minWidth: 200 }}>
            <select
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              aria-label="Selecionar membro para visualizar">
              <option value="">Meu uso</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
            <span className="signup-select-caret">▾</span>
          </div>
        </div>
      )}

      {/* Metrics header */}
      <MetricsHeader
        summary={summary}
        loading={summaryLoading}
        month={month}
        onMonthChange={setMonth}
      />

      {summaryError && (
        <div style={{ color: "var(--bad)", fontSize: "0.85rem", marginBottom: "var(--spacing-md, 16px)" }}>
          Erro ao carregar resumo: {summaryError}
        </div>
      )}

      {/* Fluency score */}
      <FluencyScoreSection
        fluency={fluency}
        loading={fluencyLoading}
        error={fluencyError}
      />

      {/* Pending allocations */}
      {(pendingLoading || pendingError || pending.length > 0) && (
        <div style={{ marginBottom: "var(--spacing-lg, 32px)" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "var(--spacing-sm, 8px)" }}>
            Alocações pendentes
          </h3>

          {pendingLoading && (
            <div style={{ background: "var(--line)", borderRadius: 4, height: 72 }} />
          )}

          {!pendingLoading && pendingError && (
            <div style={{ color: "var(--bad)", fontSize: "0.85rem" }}>
              Erro ao carregar pendências: {pendingError}
            </div>
          )}

          {!pendingLoading && !pendingError && pending.length === 0 && (
            <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>
              Nenhuma alocação pendente.
            </p>
          )}

          {!pendingLoading && !pendingError && pending.map((batch) => (
            <PendingAllocationCard
              key={batch.day}
              batch={batch}
              onAccept={handleAccept}
              onAdjust={handleAdjust}
              readOnly={isReadOnly}
            />
          ))}
        </div>
      )}

      {/* Allocation history */}
      <AllocationHistory
        history={history}
        loading={historyLoading}
        error={historyError}
        historyPage={historyPage}
        onPageChange={setHistoryPage}
      />

      {/* Allocation modal */}
      {modalBatch && (
        <AllocationModal
          batch={modalBatch}
          sprintItems={sprintItems}
          onClose={() => !modalLoading && setModalBatch(null)}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.ok ? "var(--good)" : "var(--bad)",
          color: "var(--bg)",
          padding: "10px 20px",
          borderRadius: "var(--radius-sm)",
          zIndex: 2000,
          fontSize: 13,
          pointerEvents: "none",
        }}>
          {toast.msg}
        </div>
      )}
    </section>
  );
}
