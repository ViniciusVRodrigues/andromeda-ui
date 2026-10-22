/* Aba Senioridade da Organização (fatia B): lista de níveis + modal CRUD.
 * Senioridades vivem no documento da organização — derivam de
 * ['organizations','me'] e o save é um PUT com a lista completa. */

import React from "react";
import { Link } from "react-router-dom";
import { Modal } from "../../core/ui/Modal.jsx";
import { useOrganization, useSaveSeniorities } from "./hooks.js";
import { useUsers } from "../users/hooks.js";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import SectionHeader from "../../core/ui/SectionHeader.jsx";

const key = (name) => (name || "").trim().toLowerCase();
const people = (n) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;

export function SenioritiesPage() {
  const { data: orgData, isLoading, error, refetch } = useOrganization();
  const saveSeniorities = useSaveSeniorities();

  const seniorities = React.useMemo(() => {
    const names = Array.isArray(orgData?.seniorities) ? orgData.seniorities : [];
    return names.map((name, i) => ({ id: `s-${i}-${name}`, name }));
  }, [orgData]);

  const [editingSeniority, setEditingSeniority] = React.useState(null);

  /* Pessoas por nível (mesma regra da matriz de cargos: só quem está ativo) e quem
   * ficou sem nível — inclusive com um nível que não existe mais (ex.: renomeado). */
  const { orgSlug } = useIdentity();
  const usersQuery = useUsers();
  const { counts, withoutLevel } = React.useMemo(() => {
    const known = new Set(seniorities.map((s) => key(s.name)));
    const byLevel = new Map();
    const orphans = [];
    for (const m of usersQuery.data || []) {
      if (m.active === false) continue;
      const k = key(m.seniority);
      if (k && known.has(k)) byLevel.set(k, (byLevel.get(k) || 0) + 1);
      else orphans.push({ ...m, staleLevel: k ? m.seniority : null });
    }
    return { counts: byLevel, withoutLevel: orphans };
  }, [usersQuery.data, seniorities]);

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
      <SectionHeader
        title="Senioridade"
        description="Os níveis de senioridade que aparecem no perfil de cada pessoa."
        actions={
          <button className="btn" onClick={openCreateSeniority}>
            + Novo nível
          </button>
        }
      />

      {isLoading ? (
        <div className="admin-placeholder mono">Carregando…</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seniorities.map((s) => {
              const n = counts.get(key(s.name)) || 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="role-card role-card--clickable text-left"
                  onClick={() => openEditSeniority(s)}
                  aria-label={`${s.name}: ${people(n)}. Editar nível`}
                >
                  <div className="role-card-main">
                    <div className="role-card-head">
                      <div className="serif role-card-name">{s.name}</div>
                    </div>
                    <div className="text-fg-muted mt-1 font-mono text-[12px]">
                      {usersQuery.isPending ? "…" : usersQuery.isError ? "—" : people(n)}
                    </div>
                  </div>
                  <span className="edit-hint role-card-manage">editar</span>
                </button>
              );
            })}
          </div>

          {usersQuery.isSuccess ? (
            <section
              aria-labelledby="sem-senioridade-title"
              className="border-line mt-8 border-t pt-6"
            >
              <h3 id="sem-senioridade-title" className="serif text-fg m-0 text-[18px]">
                {withoutLevel.length
                  ? `${people(withoutLevel.length)} sem nível de senioridade`
                  : "Todas as pessoas têm um nível de senioridade"}
              </h3>
              {withoutLevel.length ? (
                <>
                  <p className="text-fg-muted mt-1.5 mb-3 max-w-[72ch] text-[13px]">
                    Defina o nível na tela{" "}
                    <Link
                      to={orgRoute(orgSlug, "pessoas")}
                      className="text-accent-text underline underline-offset-2"
                    >
                      Pessoas
                    </Link>
                    . Quem está com um nível que não existe mais (renomeado ou removido) aparece
                    aqui também.
                  </p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {withoutLevel.map((m) => (
                      <li
                        key={m.id}
                        className="border-line bg-bg-elev rounded-btn border px-2.5 py-1 font-mono text-[12px]"
                      >
                        {m.name || m.email}
                        {m.name == null ? (
                          <span className="text-fg-muted"> · convite pendente</span>
                        ) : null}
                        {m.staleLevel ? (
                          <span className="text-fg-muted"> · “{m.staleLevel}” não existe mais</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      {editingSeniority && (
        <Modal
          open
          onOpenChange={(o) => !o && closeSeniority()}
          eyebrow="Senioridade"
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
