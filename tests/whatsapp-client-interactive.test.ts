import { afterEach, describe, expect, test, vi } from "vitest";

import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

function mockFetchOk() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: "wamid.btn-1" }] }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function payloadFromCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("WhatsAppCloudApiClient.sendInteractiveButtons", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("monta a mensagem interativa com reply buttons", async () => {
    const fetchMock = mockFetchOk();
    const client = new WhatsAppCloudApiClient({ accessToken: "token", phoneNumberId: "123" });

    const result = await client.sendInteractiveButtons({
      to: "+5541999990000",
      body: "Escolhe uma opcao:",
      buttons: [
        { id: "sales_fb_funcionamento", title: "Como funciona" },
        { id: "sales_fb_preco", title: "Quanto custa" },
        { id: "sales_fb_testar", title: "Quero testar" },
      ],
    });

    expect(result.whatsappMessageId).toBe("wamid.btn-1");
    const payload = payloadFromCall(fetchMock);
    expect(payload).toMatchObject({
      messaging_product: "whatsapp",
      to: "5541999990000",
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Escolhe uma opcao:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "sales_fb_funcionamento", title: "Como funciona" } },
            { type: "reply", reply: { id: "sales_fb_preco", title: "Quanto custa" } },
            { type: "reply", reply: { id: "sales_fb_testar", title: "Quero testar" } },
          ],
        },
      },
    });
  });

  test("corta em 3 botoes (limite da Cloud API)", async () => {
    const fetchMock = mockFetchOk();
    const client = new WhatsAppCloudApiClient({ accessToken: "token", phoneNumberId: "123" });

    await client.sendInteractiveButtons({
      to: "+5541999990000",
      body: "b",
      buttons: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" },
        { id: "d", title: "D" },
      ],
    });

    const payload = payloadFromCall(fetchMock);
    expect(payload.interactive.action.buttons).toHaveLength(3);
  });

  test("sem botoes -> erro (nao chama a API)", async () => {
    const fetchMock = mockFetchOk();
    const client = new WhatsAppCloudApiClient({ accessToken: "token", phoneNumberId: "123" });

    await expect(
      client.sendInteractiveButtons({ to: "+5541999990000", body: "b", buttons: [] }),
    ).rejects.toThrow(/at least one button/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("erro da API propaga com metadados", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "bad", code: 100 } }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const client = new WhatsAppCloudApiClient({ accessToken: "token", phoneNumberId: "123" });

    await expect(
      client.sendInteractiveButtons({
        to: "+5541999990000",
        body: "b",
        buttons: [{ id: "a", title: "A" }],
      }),
    ).rejects.toThrow("bad");
  });
});
