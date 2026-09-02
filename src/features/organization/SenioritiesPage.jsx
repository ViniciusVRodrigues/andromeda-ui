/* Aba Senioridade da Organização (fatia B): lista de níveis + modal CRUD.
 * Senioridades vivem no documento da organização — derivam de
 * ['organizations','me'] e o save é um PUT com a lista completa. */

import React from "react";
import { Modal } from "../../core/ui/Modal.jsx";
import { useOrganization, useSaveSeniorities } from "./hooks.js";

export function SenioritiesPage() {
  const { data: orgData, isLoading, error, refetch } = useOrganization();
  const saveSeniorities = useSaveSeniorities();

  const seniorities = React.useMemo(() => {
    const names = Array.isArray(orgData?.seniorities) ? orgData.seniorities : [];
    return names.map((name, i) => ({ id: `s-${i}-${name}`, name }));
  }, [orgData]);

  const [editingSeniority, setEditingSeniority] = React.useState(null);

  const openEditSeniority = (s) => setEditingSeniority({ ...s });
  const openCreateSeniority = () => setEditingSeniority({ id: null, name: "" });
  const closeSeniority = () => setEditingSeniority(null);

  const saveSeniority = async () => {
    if (!editingSeniority || !editingSeniority.name.trim()) return;
    const name = editingSeniority.name.trim();

    /* Duplicado (case-insensitive) não entra — validação do comportamento legado */
    const isDuplicate = seniorities.some(
      (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSeniority.id,
    );
    if (isDuplicate) return;

    const nextNames = editingSeniority.id
      ? seniorities.map((s) => (s.id === editingSeniority.id ? name : s.name))
      : [...seniorities.map((s) => s.name), name];

    try {
      await saveSeniorities.mutateAsync(nextNames);
      setEditingSeniority(null);
    } catch (_) {
      /* mantém o modal aberto em falha */
    }
  };

  const deleteSeniority = async () => {
    if (!editingSeniority?.id) return;
    const nextNames = seniorities.filter((s) => s.id !== editingSeniority.id).map((s) => s.name);
    try {
      await saveSeniorities.mutateAsync(nextNames);
      setEditingSeniority(null);
    } catch (_) {
      /* ignore */
    }
  };

  if (error) {
    return (
      <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
        Não foi possível carregar os níveis de senioridade.{" "}
        <button className="btn" style={{ marginLeft: "var(--spacing-sm)" }} onClick={refetch}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="admin-section-head admin-section-head--row">
        <div>
          <h3 className="serif admin-section-title">Senioridade</h3>
          <p className="admin-section-sub">Defina os níveis de senioridade da organização.</p>
        </div>
        <button className="btn" onClick={openCreateSeniority}>
          + Novo nível
        </button>
      </div>

      {isLoading ? (
        <div className="admin-placeholder mono">Carregando…</div>
      ) : (
        <div className="role-list role-list--cols">
          {seniorities.map((s) => (
            <button
              key={s.id}
              type="button"
              className="role-card role-card--clickable"
              onClick={() => openEditSeniority(s)}
            >
              <div className="role-card-main">
                <div className="role-card-head">
                  <div className="serif role-card-name">{s.name}</div>
                </div>
              </div>
              <span className="edit-hint role-card-manage">editar</span>
            </button>
          ))}
        </div>
      )}

      {editingSeniority && (
        <Modal
          open
          onOpenChange={(o) => !o && closeSeniority()}
          eyebrow={editingSeniority.id ? "editar nível" : "novo nível"}
          title={
            editingSeniority.id ? (
              <>
                Editar <span className="ital accent">{editingSeniority.name || "nível"}</span>
              </>
            ) : (
              <>
                Criar <span className="ital accent">novo nível</span>
              </>
            )
          }
          footer={
            <>
              <button className="btn-ghost btn" onClick={closeSeniority}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={saveSeniority}
                disabled={!editingSeniority.name.trim() || saveSeniorities.isPending}
              >
                {editingSeniority.id ? "Salvar alterações" : "Criar nível"} →
              </button>
            </>
          }
        >
          <label className="ui-field">
            <span className="ui-field-label">Nome do nível</span>
            <input
              className="ui-field-input"
              type="text"
              autoFocus
              value={editingSeniority.name}
              placeholder="ex: Especialista"
              onChange={(e) => setEditingSeniority({ ...editingSeniority, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSeniority();
              }}
            />
          </label>

          {editingSeniority.id && (
            <div
              className="member-modal-actions member-modal-actions--single"
              style={{ marginTop: "var(--spacing-md)" }}
            >
              <button
                className="member-modal-danger member-modal-danger--strong"
                onClick={deleteSeniority}
              >
                Remover nível
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
