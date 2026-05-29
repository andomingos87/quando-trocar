import { afterEach, describe, expect, test, vi } from "vitest";

import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

function mockFetchOk() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: "wamid.tmpl-1" }] }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function bodyParametersFromCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const payload = JSON.parse(init.body as string);
  const body = payload.template.components.find(
    (c: { type: string }) => c.type === "body",
  );
  return body.parameters as Array<Record<string, unknown>>;
}

describe("WhatsAppCloudApiClient.sendTemplateMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uses named parameters when names are provided", async () => {
    const fetchMock = mockFetchOk();
    const client = new WhatsAppCloudApiClient({
      accessToken: "token",
      phoneNumberId: "123",
    });

    await client.sendTemplateMessage({
      to: "+5541999990000",
      templateName: "confirmacao_servico",
      languageCode: "pt_BR",
      bodyParameters: ["Joao", "óleo", "Civic 2018", "Auto Center Silva"],
      bodyParameterNames: ["nome", "produto", "carro", "oficina"],
    });

    expect(bodyParametersFromCall(fetchMock)).toEqual([
      { type: "text", parameter_name: "nome", text: "Joao" },
      { type: "text", parameter_name: "produto", text: "óleo" },
      { type: "text", parameter_name: "carro", text: "Civic 2018" },
      { type: "text", parameter_name: "oficina", text: "Auto Center Silva" },
    ]);
  });

  test("falls back to positional parameters without names", async () => {
    const fetchMock = mockFetchOk();
    const client = new WhatsAppCloudApiClient({
      accessToken: "token",
      phoneNumberId: "123",
    });

    await client.sendTemplateMessage({
      to: "+5541999990000",
      templateName: "lembrete_troca_oleo",
      languageCode: "pt_BR",
      bodyParameters: ["Joao", "Auto Center Silva", "Civic 2018"],
    });

    expect(bodyParametersFromCall(fetchMock)).toEqual([
      { type: "text", text: "Joao" },
      { type: "text", text: "Auto Center Silva" },
      { type: "text", text: "Civic 2018" },
    ]);
  });

  test("ignores names when the length does not match", async () => {
    const fetchMock = mockFetchOk();
    const client = new WhatsAppCloudApiClient({
      accessToken: "token",
      phoneNumberId: "123",
    });

    await client.sendTemplateMessage({
      to: "+5541999990000",
      templateName: "confirmacao_servico",
      languageCode: "pt_BR",
      bodyParameters: ["Joao", "óleo"],
      bodyParameterNames: ["nome"],
    });

    expect(bodyParametersFromCall(fetchMock)).toEqual([
      { type: "text", text: "Joao" },
      { type: "text", text: "óleo" },
    ]);
  });
});
