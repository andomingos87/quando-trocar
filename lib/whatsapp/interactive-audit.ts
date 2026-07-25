import type { SalesButton } from "./types";

/**
 * Corpo persistido no outbox para mensagens interativas.
 *
 * A Cloud API envia corpo e botões em campos separados, mas o painel/auditoria
 * consulta `outbound_messages.body`. Repetir o catálogo aqui mantém o registro
 * suficiente para reconstruir exatamente a decisão apresentada ao usuário.
 */
export function renderInteractiveAuditBody(
  body: string,
  buttons: ReadonlyArray<SalesButton>,
): string {
  if (buttons.length === 0) return body;
  return [
    body,
    "",
    "Opções oferecidas:",
    ...buttons.map((button) => `- [${button.id}] ${button.title}`),
  ].join("\n");
}
