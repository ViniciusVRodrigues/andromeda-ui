/* SubTabs — small presentational row of sub-tab buttons for a page that has
 * URL-addressable sub-sections (first use: Organização → Geral/Cargos/Senioridade).
 * Purely presentational: the caller owns the active id (sourced from the route)
 * and is responsible for navigating (updating the URL) on selection. */

import React from "react";

/**
 * @param {{ id: string, label: string }[]} tabs
 * @param {string} activeId
 * @param {(id: string) => void} onSelect
 */
function SubTabs({ tabs, activeId, onSelect }) {
  return (
    <div className="sub-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeId === t.id}
          className={"sub-tabs-item" + (activeId === t.id ? " is-active" : "")}
          onClick={() => onSelect(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export { SubTabs };
