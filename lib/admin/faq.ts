import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withAdminAudit } from "./audit";

export type FaqVendas = {
  id: string;
  pergunta: string;
  resposta: string;
  palavras_chave: string[];
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type FaqVendasInput = {
  pergunta: string;
  resposta: string;
  palavras_chave: string[];
  ativo?: boolean;
  ordem?: number;
};

export type FaqVendasUpdate = Partial<FaqVendasInput>;

export type FaqValidationError =
  | { field: "pergunta"; message: string }
  | { field: "resposta"; message: string }
  | { field: "palavras_chave"; message: string }
  | { field: "ordem"; message: string };

export function validateFaqInput(
  input: Partial<FaqVendasInput>,
  { isPartial = false }: { isPartial?: boolean } = {},
): FaqValidationError | null {
  if (!isPartial || input.pergunta !== undefined) {
    if (typeof input.pergunta !== "string" || input.pergunta.trim().length === 0) {
      return { field: "pergunta", message: "Pergunta obrigatoria." };
    }
    if (input.pergunta.length > 200) {
      return { field: "pergunta", message: "Pergunta muito longa (max 200)." };
    }
  }
  if (!isPartial || input.resposta !== undefined) {
    if (typeof input.resposta !== "string" || input.resposta.trim().length === 0) {
      return { field: "resposta", message: "Resposta obrigatoria." };
    }
    if (input.resposta.length > 1000) {
      return { field: "resposta", message: "Resposta muito longa (max 1000)." };
    }
  }
  if (!isPartial || input.palavras_chave !== undefined) {
    if (!Array.isArray(input.palavras_chave)) {
      return { field: "palavras_chave", message: "Palavras-chave devem ser uma lista." };
    }
    if (input.palavras_chave.length === 0) {
      return { field: "palavras_chave", message: "Pelo menos uma palavra-chave." };
    }
    if (input.palavras_chave.some((kw) => typeof kw !== "string" || kw.trim().length === 0)) {
      return { field: "palavras_chave", message: "Palavras-chave nao podem ser vazias." };
    }
  }
  if (input.ordem !== undefined) {
    if (typeof input.ordem !== "number" || !Number.isFinite(input.ordem) || input.ordem < 0) {
      return { field: "ordem", message: "Ordem deve ser numero >= 0." };
    }
  }
  return null;
}

function normalizeKeywords(keywords: string[]): string[] {
  return keywords
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw, idx, arr) => kw.length > 0 && arr.indexOf(kw) === idx);
}

export async function listFaqs(supabase: SupabaseClient): Promise<FaqVendas[]> {
  const { data, error } = await supabase
    .from("faq_vendas")
    .select("id, pergunta, resposta, palavras_chave, ativo, ordem, created_at, updated_at")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`list_faqs_failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    palavras_chave: row.palavras_chave ?? [],
  }));
}

export async function getFaqById(
  supabase: SupabaseClient,
  id: string,
): Promise<FaqVendas | null> {
  const { data, error } = await supabase
    .from("faq_vendas")
    .select("id, pergunta, resposta, palavras_chave, ativo, ordem, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get_faq_failed: ${error.message}`);
  if (!data) return null;
  return { ...data, palavras_chave: data.palavras_chave ?? [] };
}

export async function createFaq(
  supabase: SupabaseClient,
  input: FaqVendasInput,
  ctx: { adminId: string; ip: string | null },
): Promise<FaqVendas> {
  const validation = validateFaqInput(input);
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  return withAdminAudit(
    supabase,
    (result: FaqVendas) => ({
      adminId: ctx.adminId,
      acao: "faq.create",
      entidade: "faq_vendas",
      entidadeId: result.id,
      ip: ctx.ip,
      payload: { ...result },
    }),
    async () => {
      const { data, error } = await supabase
        .from("faq_vendas")
        .insert({
          pergunta: input.pergunta.trim(),
          resposta: input.resposta.trim(),
          palavras_chave: normalizeKeywords(input.palavras_chave),
          ativo: input.ativo ?? true,
          ordem: input.ordem ?? 0,
        })
        .select("id, pergunta, resposta, palavras_chave, ativo, ordem, created_at, updated_at")
        .single();
      if (error) throw new Error(`create_faq_failed: ${error.message}`);
      return { ...data, palavras_chave: data.palavras_chave ?? [] };
    },
  );
}

export async function updateFaq(
  supabase: SupabaseClient,
  id: string,
  input: FaqVendasUpdate,
  ctx: { adminId: string; ip: string | null },
): Promise<FaqVendas> {
  const validation = validateFaqInput(input, { isPartial: true });
  if (validation) {
    const err = new Error(validation.message);
    Object.assign(err, { status: 400, validation });
    throw err;
  }

  const before = await getFaqById(supabase, id);
  if (!before) {
    const err = new Error("faq_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.pergunta !== undefined) patch.pergunta = input.pergunta.trim();
  if (input.resposta !== undefined) patch.resposta = input.resposta.trim();
  if (input.palavras_chave !== undefined) {
    patch.palavras_chave = normalizeKeywords(input.palavras_chave);
  }
  if (input.ativo !== undefined) patch.ativo = input.ativo;
  if (input.ordem !== undefined) patch.ordem = input.ordem;

  return withAdminAudit(
    supabase,
    (after: FaqVendas) => ({
      adminId: ctx.adminId,
      acao: "faq.update",
      entidade: "faq_vendas",
      entidadeId: id,
      ip: ctx.ip,
      payload: { before, after },
    }),
    async () => {
      const { data, error } = await supabase
        .from("faq_vendas")
        .update(patch)
        .eq("id", id)
        .select("id, pergunta, resposta, palavras_chave, ativo, ordem, created_at, updated_at")
        .single();
      if (error) throw new Error(`update_faq_failed: ${error.message}`);
      return { ...data, palavras_chave: data.palavras_chave ?? [] };
    },
  );
}

export async function deactivateFaq(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; ip: string | null },
): Promise<{ id: string; ativo: false }> {
  const before = await getFaqById(supabase, id);
  if (!before) {
    const err = new Error("faq_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }

  await withAdminAudit(
    supabase,
    {
      adminId: ctx.adminId,
      acao: "faq.deactivate",
      entidade: "faq_vendas",
      entidadeId: id,
      ip: ctx.ip,
      payload: { before },
    },
    async () => {
      const { error } = await supabase
        .from("faq_vendas")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`deactivate_faq_failed: ${error.message}`);
    },
  );

  return { id, ativo: false };
}
