/* 404 — endereço que não corresponde a nenhuma rota.
 *
 * O destino do botão depende da sessão: autenticado volta para a primeira área
 * permitida (já com o prefixo da organização), visitante volta para a home. Sem isso
 * um usuário logado seria jogado na landing pública, que parece um logout. */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";

export function NotFoundScreen({ onBack, backLabel = "Voltar ao início" }) {
  return (
    <div className="notfound">
      <div className="notfound-inner">
        <div className="notfound-logo">
          <Wordmark size="lg" />
        </div>

        <div className="notfound-code mono" aria-hidden="true">
          404
        </div>

        <h1 className="serif notfound-title">
          Esta órbita está <span className="ital accent">vazia</span>
          <span className="accent">.</span>
        </h1>

        <p className="notfound-lede">
          O endereço que você tentou acessar não existe — ou deixou de existir. Confira o link, ou
          volte para um ponto conhecido do mapa.
        </p>

        <button type="button" className="btn btn-lg" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}

export default NotFoundScreen;
