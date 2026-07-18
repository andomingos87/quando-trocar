// Playbook de vendas do representante (ADR-0025, Fase R4.4). Conteudo ESTATICO,
// curado no repositorio: publicar/editar = alterar esta constante + deploy.
//
// Base factual reaproveitada de PRODUCT_FACTS/SALES_FACTS
// (lib/whatsapp/product-knowledge.ts), reescrita para um VENDEDOR HUMANO.
//
// REGRA (ADR-0012): NUNCA incluir preco/mensalidade/condicao comercial aqui —
// quem fecha valor e o atendimento humano. Se precisar citar prazos de lembrete,
// manter em sincronia com os defaults do seed `tipos_servico_default`.

export type PlaybookBloco =
  | { tipo: "paragrafos"; itens: string[] }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "passos"; itens: string[] }
  | { tipo: "qa"; itens: Array<{ pergunta: string; resposta: string }> };

export type PlaybookSecao = {
  id: string;
  titulo: string;
  resumo?: string;
  blocos: PlaybookBloco[];
};

export const PLAYBOOK: PlaybookSecao[] = [
  {
    id: "pitch",
    titulo: "O pitch em uma frase",
    resumo: "O que dizer nos primeiros 10 segundos.",
    blocos: [
      {
        tipo: "paragrafos",
        itens: [
          "O Quando Trocar registra os serviços que a oficina faz e lembra o cliente, sozinho, pelo WhatsApp, na hora certa de voltar. A oficina para de perder retorno por esquecimento — o cliente some, troca de oficina, e ninguém avisou que estava na hora.",
          "É recorrência sem esforço: a oficina cadastra a troca em uma mensagem e o sistema cuida do resto. Nada de app, planilha ou agenda manual.",
        ],
      },
    ],
  },
  {
    id: "como-funciona",
    titulo: "Como o produto funciona",
    resumo: "Para explicar sem complicar.",
    blocos: [
      {
        tipo: "passos",
        itens: [
          "A oficina ativa direto pelo WhatsApp — não precisa instalar aplicativo nem acessar site.",
          "Para registrar uma troca, manda uma mensagem com nome do cliente, carro, serviço, data e WhatsApp do cliente. Ex.: “João Silva, Civic 2018, troca de óleo, hoje, 41999990000”.",
          "O bot mostra um resumo e pede confirmação (“sim”) antes de gravar — dá para corrigir qualquer campo antes.",
          "Confirmado, o serviço fica registrado, o lembrete é agendado pela cadência do serviço e o cliente recebe um aviso do registro (quando autorizou receber mensagens).",
          "Quando chega a hora, o cliente recebe o lembrete e a conversa volta para o WhatsApp da própria oficina.",
        ],
      },
      {
        tipo: "paragrafos",
        itens: [
          "A cadência do lembrete depende do tipo de serviço. De fábrica: troca de óleo cerca de 90 dias, revisão e outros serviços cerca de 180 dias, amortecedor cerca de 2 anos — e a oficina pode ajustar esses prazos no painel.",
          "O bot não agenda nem confirma horário: o agendamento é direto entre oficina e cliente. O papel dele é lembrar e fazer a ponte.",
        ],
      },
    ],
  },
  {
    id: "roi",
    titulo: "ROI e argumentos que convencem",
    resumo: "Por que vale a pena — em linguagem de dono de oficina.",
    blocos: [
      {
        tipo: "lista",
        itens: [
          "Retorno que já era da oficina: o cliente que fez a troca há 3 meses é o mais barato de trazer de volta — ele só precisa ser lembrado.",
          "Zero trabalho a mais: a oficina já sabe o que fez e para quem; o sistema transforma isso em lembrete automático.",
          "Recorrência previsível: cada serviço registrado hoje é um retorno agendado no futuro.",
          "Relação mais próxima: o cliente sente que a oficina se importa e lembra dele — sem parecer spam.",
          "Sem curva de aprendizado: se a oficina usa WhatsApp, ela já sabe usar o Quando Trocar.",
        ],
      },
    ],
  },
  {
    id: "objecoes",
    titulo: "Objeções comuns e como responder",
    resumo: "As dúvidas que aparecem e a melhor resposta.",
    blocos: [
      {
        tipo: "qa",
        itens: [
          {
            pergunta: "“Não tenho tempo de aprender outro sistema.”",
            resposta:
              "Não é um sistema novo para aprender — é o WhatsApp que você já usa. Você manda uma mensagem com os dados da troca e o resto é automático. A ativação e o primeiro cadastro o próprio bot te guia.",
          },
          {
            pergunta: "“Meu cliente vai achar que é spam.”",
            resposta:
              "O lembrete só vai quando o cliente autorizou receber mensagens, e chega na hora útil (perto da próxima troca), com a cara da sua oficina. É serviço, não propaganda.",
          },
          {
            pergunta: "“Eu já anoto na agenda / no caderno.”",
            resposta:
              "Ótimo, você já tem o hábito. A diferença é que aqui o lembrete dispara sozinho no dia certo — você não precisa lembrar de olhar o caderno nem mandar mensagem um por um.",
          },
          {
            pergunta: "“E se eu errar o cadastro?”",
            resposta:
              "Antes de gravar, o bot mostra um resumo e você confirma. Para corrigir um cadastro já confirmado, é só usar o /suporte.",
          },
          {
            pergunta: "“Preciso instalar alguma coisa?”",
            resposta:
              "Nada. É tudo pelo WhatsApp: sem app, sem site, sem login complicado.",
          },
        ],
      },
    ],
  },
  {
    id: "link",
    titulo: "Sua frase-gatilho e seu link",
    resumo: "Como fazer a oficina cair já atribuída a você.",
    blocos: [
      {
        tipo: "paragrafos",
        itens: [
          "Cada representante tem um código único. Quando você divulga o seu link, a primeira mensagem que a oficina envia já carrega o seu código no formato #REP-SEUCODIGO — e o lead entra atribuído a você automaticamente.",
          "Na sua Visão geral tem o botão “Copiar link”: ele monta o link do WhatsApp com a frase-gatilho e o seu código já embutidos. É só copiar e mandar para a oficina, colar no status, no cartão, onde você divulgar.",
        ],
      },
      {
        tipo: "passos",
        itens: [
          "Abra a Visão geral do portal.",
          "Toque em “Copiar link” — ele já vem com a frase-gatilho e o seu #REP-código.",
          "Cole no WhatsApp, story, bio ou material impresso.",
          "Quando a oficina clicar e mandar a mensagem, ela chega atribuída a você — e a comissão daquela oficina é sua enquanto ela pagar.",
        ],
      },
      {
        tipo: "paragrafos",
        itens: [
          "Importante: não altere o trecho #REP-código da mensagem. É ele que garante a atribuição. Se o código sumir da mensagem, o lead entra sem representante.",
        ],
      },
    ],
  },
  {
    id: "faq",
    titulo: "FAQ rápida",
    resumo: "Respostas curtas para as perguntas mais frequentes.",
    blocos: [
      {
        tipo: "qa",
        itens: [
          {
            pergunta: "Dá para testar antes de fechar?",
            resposta: "Dá para testar grátis por 14 dias, sem compromisso.",
          },
          {
            pergunta: "Como a oficina ativa?",
            resposta:
              "Direto pela conversa de WhatsApp — não precisa instalar app nem acessar site. Depois de ativar, o próprio bot guia o primeiro cadastro de serviço.",
          },
          {
            pergunta: "Quem fecha o valor?",
            resposta:
              "O valor e as condições comerciais são tratados pelo atendimento humano. Seu papel é apresentar o produto e trazer a oficina interessada.",
          },
          {
            pergunta: "O bot marca horário para o cliente?",
            resposta:
              "Não. Ele lembra o cliente e faz a ponte com a oficina; o agendamento é combinado direto entre os dois.",
          },
          {
            pergunta: "Como eu recebo minha comissão?",
            resposta:
              "Cada mensalidade paga pela oficina que você trouxe gera uma comissão. Você acompanha o extrato aqui no portal, na aba Comissões; o pagamento é feito pelo time.",
          },
        ],
      },
    ],
  },
];
