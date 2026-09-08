import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useIdentity } from "../auth/IdentityContext.jsx";
import Modal from "../ui/Modal.jsx";

const display = (value) => (value == null || value === "" ? "Não informado" : value);
const date = (value) => (value ? new Date(value).toLocaleDateString("pt-BR") : "Não informado");
const hours = (value) =>
  value == null ? "Sem medição" : `${Number(value).toLocaleString("pt-BR")} h`;

function FieldEditor({ itemId, field, detail, editable, onUpdated }) {
  const client = useQueryClient();
  const [draft, setDraft] = React.useState(detail?.value ?? "");
  const [editing, setEditing] = React.useState(false);
  const label = field === "effort" ? "Esforço" : "Complexidade";
  const mapped = detail?.mappedField
    ?.split(".")
    .pop()
    ?.replace(/([a-z])([A-Z])/g, "$1 $2");
  const integer = /integer|int$/i.test(detail?.fieldType || "");
  const mutation = useMutation({
    mutationFn: (body) =>
      api.patch(`/v1/work-items/${encodeURIComponent(itemId)}/manual-fields`, body),
    onSuccess: async (updated) => {
      onUpdated?.(updated);
      await Promise.all(
        ["work-items", "dashboard", "projects", "backlog", "ai-usage"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      setEditing(false);
    },
  });
  const valid =
    draft !== "" &&
    Number.isFinite(Number(draft)) &&
    Number(draft) >= 0 &&
    (!integer || Number.isInteger(Number(draft)));
  return (
    <section className="rounded-card border-line bg-bg-elev border p-4">
      <h4 className="text-fg mb-2">
        {label}
        {mapped ? ` · ${mapped}` : ""}
      </h4>
      <p className="text-fg-muted mb-3">
        {display(detail?.value)} ·{" "}
        {detail?.source === "MANUAL_OVERRIDE" ? "Manual" : detail?.source ? "Azure" : "Sem origem"}
      </p>
      {editable &&
        (editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) mutation.mutate({ [field]: Number(draft) });
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              aria-label={mapped || label}
              className="ui-field-input"
              type="number"
              min="0"
              step={integer ? "1" : "any"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={mutation.isPending}
              autoFocus
            />
            <button className="btn" disabled={!valid || mutation.isPending}>
              Salvar
            </button>
            <button
              type="button"
              className="btn-ghost btn"
              disabled={mutation.isPending}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            className="btn-ghost btn"
            onClick={() => {
              setDraft(detail?.value ?? "");
              setEditing(true);
            }}
          >
            Editar {label.toLowerCase()}
          </button>
        ))}
      {mutation.isError && (
        <p role="alert" className="text-bad mt-2">
          {mutation.error.message || "Não foi possível salvar."}
        </p>
      )}
    </section>
  );
}

export function WorkItemModal({ id, onClose, onChanged }) {
  const { identity } = useIdentity();
  const query = useQuery({
    queryKey: ["work-items", id],
    queryFn: () => api.get(`/v1/work-items/${encodeURIComponent(id)}`),
    staleTime: 30000,
  });
  const item = query.data;
  const editable = item?.editableType && identity?.permissions?.includes("WORK_ITEM_MANAGE");
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={item?.title || "Work item"}
      eyebrow={item ? `${item.type || "Item"} · ${item.externalId || item.id}` : "Detalhes"}
      subtitle="Contexto, métricas e estimativas do work item."
      size="wide"
      stacked
      showClose
      closeOnBackdrop={false}
    >
      {query.isPending && <p role="status">Carregando work item…</p>}
      {query.isError && (
        <div role="alert">
          <p>Não foi possível carregar este work item.</p>
          <button className="btn" onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {item && (
        <div className="space-y-5">
          {/* Só entra na grade o que tem valor: repetir "Não informado" dez vezes
           * afogava status, esforço e custo, que são o que se vem ver aqui. */}
          {(() => {
            const rows = [
              ["Status", item.status],
              ["Sprint", item.sprintName],
              ["Responsável", item.assignee],
              ["Prioridade", item.priority],
              ["Item pai", item.parentExternalId],
              ["Criado", item.createdAt && date(item.createdAt)],
              ["Iniciado", item.startedAt && date(item.startedAt)],
              ["Concluído", item.completedAt && date(item.completedAt)],
              ["Cycle time", item.cycleTimeHours != null && hours(item.cycleTimeHours)],
              ["Lead time", item.leadTimeHours != null && hours(item.leadTimeHours)],
            ].filter(([, value]) => value);
            const missing = 10 - rows.length;
            return (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  {rows.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="mono text-fg-dim text-[10px] tracking-wider uppercase">
                        {label}
                      </dt>
                      <dd className="text-fg m-0 truncate">{value}</dd>
                    </div>
                  ))}
                </dl>
                {missing > 0 && (
                  <p className="text-fg-dim m-0 text-sm">
                    {missing}{" "}
                    {missing === 1 ? "campo ainda não medido" : "campos ainda não medidos"}.
                  </p>
                )}
              </>
            );
          })()}
          {item.labels?.length > 0 && (
            <p className="text-fg-muted">Tags: {item.labels.join(" · ")}</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {["complexity", "effort"].map((field) => (
              <FieldEditor
                key={field}
                itemId={id}
                field={field}
                detail={item[field]}
                editable={editable}
                onUpdated={onChanged}
              />
            ))}
          </div>
          <p className="text-fg-muted text-sm">
            Os campos seguem o mapeamento global do projeto. Alterações manuais são locais ao
            Andrômeda.
            {!item.editableType
              ? " Épicos e features não recebem estimativas manuais."
              : !editable
                ? " Seu acesso permite somente consulta."
                : ""}
          </p>
        </div>
      )}
    </Modal>
  );
}

export function WorkItemLink({ id, children, className = "", onChanged }) {
  const [open, setOpen] = React.useState(false);
  if (!id) return <span className={className}>{children}</span>;
  return (
    <>
      <button
        type="button"
        className={`ui-work-item-link hover:text-accent focus-visible:outline-accent cursor-pointer text-left text-inherit focus-visible:outline ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && <WorkItemModal id={id} onChanged={onChanged} onClose={() => setOpen(false)} />}
    </>
  );
}
