/**
 * Drawer "Uso de IA para alocar" do modo só-dashboard (sem a casca, sem a tela Uso de IA):
 * todos os dias pendentes da pessoa, do `pending-batches` global, com as mesmas ações da
 * faixa do dashboard individual.
 */

import React from "react";
import { useIdentity } from "../../../../core/auth/IdentityContext.jsx";
import Drawer from "../../../../core/ui/Drawer.jsx";
import { PendingDaysList, rowsFromBatches, useDayActions } from "./PendingDaysList.jsx";

/** @param {{ open: boolean, onClose: () => void, batches: object[] | undefined }} props */
export function AllocationDrawer({ open, onClose, batches }) {
  const ident = useIdentity();
  const readOnly = !ident.hasOrg?.("AI_READ_OWN");
  const sourceRows = React.useMemo(() => rowsFromBatches(batches), [batches]);
  const actions = useDayActions(sourceRows);
  return (
    <Drawer open={open} onClose={onClose} title="Uso de IA para alocar">
      <PendingDaysList actions={actions} readOnly={readOnly} bounded={false} />
    </Drawer>
  );
}
