export type ChatCard = {
  title: string;
  rows: [string, string][];
  actions: { label: string; ok?: boolean }[];
};

type BaseStep = {
  who: "me" | "them";
  t: string;
  /** override: ms to show the typing indicator before this message (them only). default ~2200 */
  typing?: number;
  /** override: extra pause before starting this step's sequence (ms). default depends on sender */
  pauseBefore?: number;
};

export type ChatStep = BaseStep &
  (
    | { text: string; audio?: never; card?: never }
    | { audio: string; text?: never; card?: never }
    | { card: ChatCard; text?: never; audio?: never }
  );

export type ChatPerspective = "dono" | "cliente";

export type ChatContact = {
  avatar: string;
  name: string;
  status: string;
};

export const contacts: Record<ChatPerspective, ChatContact> = {
  dono: { avatar: "QT", name: "Quando Trocar", status: "online" },
  cliente: {
    avatar: "AC",
    name: "Auto Center do Tião",
    status: "via Quando Trocar",
  },
};

export const scripts: Record<ChatPerspective, ChatStep[]> = {
  dono: [
    {
      who: "them",
      text: "Opa chefe! Manda a troca aí — texto, áudio ou foto da nota. Do jeito que for mais rápido.",
      t: "14:02",
      pauseBefore: 800,
      typing: 2400,
    },
    {
      who: "me",
      audio: "0:14",
      t: "14:03",
      pauseBefore: 2200,
    },
    {
      who: "them",
      card: {
        title: "Confere pra mim?",
        rows: [
          ["Cliente", "Roberto"],
          ["Carro", "Gol 2014 · PJT-5F29"],
          ["KM hoje", "47.000"],
          ["Óleo", "20W50 Ipiranga"],
          ["Próxima", "~52.000 km · set/2026"],
        ],
        actions: [
          { label: "Tá certo", ok: true },
          { label: "Corrigir" },
        ],
      },
      t: "14:03",
      pauseBefore: 600,
      typing: 3200,
    },
    {
      who: "me",
      text: "tá certo 👍",
      t: "14:04",
      pauseBefore: 2600,
    },
    {
      who: "them",
      text: "Beleza ✓ Vou monitorando a km do Roberto e te aviso quando chegar perto. Pode seguir.",
      t: "14:04",
      pauseBefore: 600,
      typing: 2100,
    },
  ],
  cliente: [
    {
      who: "them",
      text: "Oi Roberto 👋 Aqui é do Auto Center do Tião.",
      t: "09:15",
      pauseBefore: 800,
      typing: 1900,
    },
    {
      who: "them",
      text: "Pelo ritmo que você anda, o Gol tá chegando na hora da próxima troca.",
      t: "09:15",
      pauseBefore: 700,
      typing: 2600,
    },
    {
      who: "them",
      card: {
        title: "Agendar sua troca?",
        rows: [
          ["Onde", "Auto Center do Tião"],
          ["Opção 1", "Qui 25, 14h"],
          ["Opção 2", "Sex 26, 9h"],
        ],
        actions: [
          { label: "Qui 14h", ok: true },
          { label: "Sex 9h" },
          { label: "Outro dia" },
        ],
      },
      t: "09:15",
      pauseBefore: 700,
      typing: 2400,
    },
    {
      who: "me",
      text: "qui 14h fica bom 🤝",
      t: "09:20",
      pauseBefore: 2800,
    },
    {
      who: "them",
      text: "Fechou! Te espero lá quinta às 14h. Qualquer coisa, é só chamar.",
      t: "09:20",
      pauseBefore: 700,
      typing: 2000,
    },
  ],
};
