/* Seção "Excluir organização" da aba Geral (excluir-organizacao).
 *
 * Só renderiza para quem tem ORGANIZATION_DELETE (gating de UX; quem barra de
 * verdade é o @PreAuthorize do DELETE /v1/organizations/me). O diálogo exige o
 * slug digitado. Sucesso encerra a sessão e leva ao login com um aviso. */

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import SectionHeader from "../../core/ui/SectionHeader.jsx";
import { useDeleteOrganization } from "./hooks.js";

const MSG_GENERICO = "Não foi possível excluir a organização. Nada foi alterado. Tente de novo.";
const MSG_SEM_PERMISSAO = "Você não tem permissão para excluir esta organização.";

/* Contraste local do botão de perigo (sem mexer no .btn-danger global): texto
 * var(--bg) sobre --bad nas paletas default e mono, branco na light. */
const DANGER_TEXT = "!text-[var(--bg)] [:root[data-palette='light']_&]:!text-white";
const BTN_CLASS = `btn btn-danger min-h-[44px] w-full shrink-0 sm:w-auto ${DANGER_TEXT}`;

/**
 * @param {object} props
 * @param {string} props.name  nome da organização
 * @param {string} props.slug  identificador digitado para confirmar
 */
export function DeleteOrganizationSection({ name, slug }) {
  const { hasOrg, onLogout } = useIdentity();
  const queryClient = useQueryClient();
  const del = useDeleteOrganization();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState(null);
  // Guard síncrono: dois cliques no mesmo tick leem o mesmo `isPending` de render.
  const inflight = React.useRef(false);

  if (!hasOrg("ORGANIZATION_DELETE") || !slug) return null;

  const fechar = (v) => {
    if (v || del.isPending) return;
    setOpen(false);
    setError(null);
  };

  const excluir = () => {
    if (inflight.current) return;
    inflight.current = true;
    setError(null);
    del.mutate(slug, {
      onSuccess: () => {
        queryClient.clear();
        onLogout({ to: "/login", notice: `A organização ${name} foi excluída.` });
      },
      onError: (err) => {
        inflight.current = false;
        setError(err?.status === 403 ? MSG_SEM_PERMISSAO : MSG_GENERICO);
      },
    });
  };

  return (
    <section
      aria-labelledby="org-delete-title"
      className="rounded-card bg-bg-elev border border-[var(--bad)] p-6 min-[1100px]:col-span-2"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[65ch] [&>div]:mb-0">
          <SectionHeader
            id="org-delete-title"
            title="Excluir organização"
            description={
              <>
                Encerra a organização <strong>{name}</strong> para todas as pessoas, inclusive você.
                Ninguém mais consegue entrar e todos os dados da organização são apagados: pessoas,
                projetos, integrações, painéis, uso de IA e histórico. Não dá para desfazer.
              </>
            }
          />
        </div>
        <button type="button" className={BTN_CLASS} onClick={() => setOpen(true)}>
          Excluir organização…
        </button>
      </div>

      {open && (
        <ConfirmDialog
          open
          onOpenChange={fechar}
          eyebrow="Ação irreversível"
          title={
            <>
              Excluir a organização <span className="ital accent">{name}</span>?
            </>
          }
          message={
            <ul className="m-0 list-disc space-y-1 pl-5">
              <li>Todas as pessoas perdem o acesso na hora, inclusive você.</li>
              <li>
                Todos os dados da organização são apagados: pessoas, projetos, integrações, painéis,
                uso de IA e histórico.
              </li>
              <li>As integrações com Azure DevOps e GitHub param de sincronizar.</li>
              <li>Não é possível desfazer.</li>
            </ul>
          }
          confirmLabel="Excluir organização"
          busyLabel="Excluindo…"
          danger
          busy={del.isPending}
          confirmPhrase={slug}
          confirmPhraseLabel={
            <>
              Digite <strong className="font-mono">{slug}</strong> para confirmar
            </>
          }
          error={error}
          confirmClassName={DANGER_TEXT}
          onConfirm={excluir}
        />
      )}
    </section>
  );
}
