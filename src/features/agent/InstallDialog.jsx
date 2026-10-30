/* "Conectar outro computador" (telas-ia-refeitas, D4): os passos de instalação e o campo
 * do código num Modal. "Conferir" fecha este diálogo e abre o PairingDialog. O Modal
 * devolve o foco ao link que o abriu. */

import React from "react";
import { Modal } from "../../core/ui/Modal.jsx";
import InstallSteps from "./InstallSteps.jsx";
import PairingCodeField from "./PairingCodeField.jsx";

export default function InstallDialog({ onClose, onCheckCode }) {
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      eyebrow="Conector de IA"
      title="Conectar um computador"
      size="wide"
      bodyClassName="scroll-slim"
    >
      <InstallSteps />
      <div className="border-line mt-5 border-t pt-4">
        <PairingCodeField
          onSubmit={(code) => {
            onClose();
            onCheckCode(code);
          }}
        />
      </div>
    </Modal>
  );
}
