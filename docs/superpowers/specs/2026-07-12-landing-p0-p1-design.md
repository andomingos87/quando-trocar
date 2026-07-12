# Landing P0 + P1 — Especificação de Design e Conversão

## Objetivo

Transformar a landing atual do Quando Trocar em uma jornada comercial clara e honesta, reduzindo o caminho até o WhatsApp e explicitando a oferta aprovada: 14 dias grátis e, depois, R$ 59 por mês.

O ciclo preserva a identidade visual e os componentes existentes. O foco é corrigir credibilidade, oferta, copy, hierarquia comercial, CTAs e experiência mobile antes de investir em um reposicionamento visual completo.

## Contexto e decisões aprovadas

- O produto ainda não possui clientes, depoimentos, logos ou resultados publicáveis.
- A landing não pode usar estatísticas, valores recuperados, prova social ou escassez sem evidência.
- O teste gratuito dura 14 dias.
- Após o teste, a assinatura custa R$ 59 por mês.
- A assinatura é mensal, sem fidelidade, e pode ser cancelada a qualquer momento.
- Não existe cobrança automática ao fim do teste.
- Sem pagamento, o serviço é pausado e o agente retorna ao modo `vendas`.
- O CTA principal abre diretamente o WhatsApp com uma mensagem pré-preenchida.

## Abordagem selecionada

Foi escolhida a abordagem de conversão enxuta e honesta: reorganizar e reescrever a landing existente sem reconstrução total. A demonstração do WhatsApp recebe apenas os ajustes necessários para começar rapidamente e mostrar um resultado explícito.

Não fazem parte deste ciclo fotografia editorial, calculadora de retorno, prova social, reposicionamento visual completo ou uma nova plataforma de Analytics.

## Jornada comercial

A landing deve conduzir o visitante por seis decisões:

1. Reconhecer que clientes podem não voltar por falta de lembrete.
2. Entender que a oficina registra o serviço pelo WhatsApp e o Quando Trocar cuida do lembrete.
3. Perceber que o teste tem baixo risco: 14 dias grátis, sem cartão e sem cobrança automática.
4. Conhecer antecipadamente o preço de R$ 59 por mês.
5. Entender que o serviço é pausado se a oficina não confirmar o pagamento.
6. Iniciar o teste diretamente pelo WhatsApp.

## Arquitetura de conteúdo

1. **Header enxuto:** navegação curta e CTA direto para o WhatsApp.
2. **Hero:** promessa principal, demonstração visual, oferta resumida e CTA direto.
3. **Faixa de transparência:** substitui a falsa prova social por condições honestas do lançamento.
4. **Dor:** explica a perda do retorno sem estatísticas ou estimativas financeiras.
5. **Como funciona:** mantém a explicação em três passos.
6. **Demonstração do WhatsApp:** mostra a conversa chegando rapidamente a um resultado.
7. **Benefícios:** traduz o produto em ganhos operacionais para a oficina.
8. **Oferta:** detalha teste, preço, pausa, cancelamento e ausência de cobrança automática.
9. **Objeções:** responde somente às dúvidas comerciais essenciais.
10. **FAQ reduzido:** concentra dúvidas operacionais e contratuais sem repetir objeções.
11. **CTA final:** repete a promessa e abre diretamente o WhatsApp.
12. **Footer:** preserva identidade, contato e páginas legais.

## Copy aprovada

### Hero

**Selo:** `14 dias grátis para oficinas`

**Headline:**

> Seu cliente não esquece da troca.  
> Ele esquece de voltar pra você.

**Subheadline:**

> Registre o serviço pelo WhatsApp. O Quando Trocar calcula a próxima data e lembra o cliente na hora certa — com o nome da sua oficina.

**CTA principal:** `Começar meus 14 dias grátis`

**CTA secundário:** `Ver como funciona`

**Microcopy:** `Sem cartão · depois, R$ 59/mês · cancele quando quiser`

### Faixa de transparência

> Estamos começando agora. Por isso, você testa por 14 dias sem pagar e acompanha o funcionamento na prática antes de decidir.

Pontos de apoio:

- Sem cobrança automática.
- Você conhece o preço desde o início.
- Se não continuar, o serviço é pausado.
- Atendimento próximo pelo WhatsApp.

### Dor

Mensagem central:

> Você não perde o cliente porque ele deixou de confiar.  
> Você perde porque ninguém lembrou na hora certa.

A seção deve remover `62%`, `R$ 220`, `estimativa do setor` e qualquer alegação equivalente sem fonte verificável.

### Benefícios

- Registre pelo WhatsApp em poucos segundos.
- Não dependa da memória da equipe.
- Lembre o cliente no momento adequado.
- Mantenha o nome da oficina presente.
- Pare sem custo se não quiser continuar.

### Oferta

**Título:** `Teste por 14 dias. Depois, R$ 59 por mês.`

**Explicação:**

> Durante o teste, você usa o Quando Trocar sem cartão e sem cobrança. Ao final dos 14 dias, o serviço é pausado. Para continuar, basta confirmar a assinatura de R$ 59/mês pelo WhatsApp.

Itens obrigatórios:

- 14 dias grátis.
- Sem cartão no teste.
- Sem cobrança automática.
- R$ 59 por mês depois do teste.
- Sem fidelidade.
- Cancelamento a qualquer momento.
- Serviço pausado quando não houver pagamento.

### CTA e mensagem do WhatsApp

Todos os CTAs primários usam `Começar meus 14 dias grátis` e abrem diretamente o WhatsApp em nova aba.

Mensagem-base:

```text
Olá! Quero começar meus 14 dias grátis no Quando Trocar para minha oficina.
Origem: <cta_source>
```

Origens permitidas:

- `landing_nav`
- `landing_hero`
- `landing_como_funciona`
- `landing_oferta`
- `landing_floating_mobile`
- `landing_cta_final`

As origens servem como telemetria inicial nas conversas recebidas. Não será instalada uma nova plataforma de Analytics neste ciclo.

## Componentes e responsabilidades

### Configuração comercial

Prazo, preço, mensagem-base, origens válidas e benefícios da oferta devem ficar centralizados em um módulo público, sem duplicação em componentes.

Esse módulo deve expor dados de apresentação e a função responsável por montar o link do WhatsApp. Ele não controla expiração, cobrança ou mudança de modo do agente.

### CTA reutilizável

Um componente cliente reutilizável recebe a origem do CTA, produz o link correto e mantém o padrão visual laranja da marca. Variações permitidas: primário, branco e flutuante mobile.

### Faixa de transparência

Nova seção de baixa altura, posicionada após o hero. Ela comunica fase inicial, teste e condições sem tentar imitar logos, números ou depoimentos.

### Benefícios

Nova seção curta, com no máximo cinco itens e sem criar uma segunda explicação de “como funciona”.

### Demonstração do WhatsApp

A estrutura atual é preservada. Os ajustes devem:

- exibir conteúdo útil desde o primeiro estado;
- reduzir o tempo até a primeira mensagem;
- terminar em resultado explícito;
- permitir reiniciar a conversa;
- substituir emojis de navegação por ícones consistentes;
- manter o comportamento completo com `prefers-reduced-motion`.

### CTA flutuante mobile

Deve funcionar como barra inferior compacta, respeitar `safe-area-inset-bottom`, não cobrir conteúdo e desaparecer quando CTAs principais estiverem visíveis.

## Responsividade e acessibilidade

- Manter blocos de texto alinhados à esquerda.
- Usar laranja `brand` para ações primárias; vermelho somente para urgência.
- Reutilizar tokens e utilitários de `app/globals.css`.
- Preservar foco visível, navegação por teclado e áreas de toque adequadas.
- Não depender apenas de cor para comunicar estado.
- Garantir que a demonstração continue compreensível com movimento reduzido.
- Validar que a barra mobile não cobre conteúdo em 390 × 844 e larguras menores suportadas.

## Documentação sincronizada

A implementação deve atualizar na mesma mudança:

- `docs/product/copy.md` com a copy aprovada;
- `.context/modules/site-publico/AGENTS.md` com a nova composição e invariantes;
- `docs/regras-de-negocio.md` com prazo, preço, pausa e retorno ao modo `vendas`;
- `app/termos/page.tsx` se houver condições divergentes;
- qualquer referência ativa a 30 dias, preço indefinido ou continuidade sem regra clara.

## Validação e critérios de aceite

1. Nenhuma área pública da landing afirma possuir clientes, resultados, vagas limitadas ou estatísticas não comprovadas.
2. Toda referência ao teste informa 14 dias.
3. Preço de R$ 59 por mês aparece no hero e na oferta.
4. A ausência de cobrança automática e a pausa ao final do teste são explícitas.
5. Todo CTA primário abre diretamente o WhatsApp com uma origem válida.
6. A mensagem enviada ao WhatsApp informa intenção, prazo e origem.
7. O CTA flutuante não cobre conteúdo e desaparece próximo aos CTAs principais.
8. A demonstração apresenta resultado sem depender da animação.
9. Não há alteração no fluxo real de expiração, billing ou modo do agente neste ciclo.
10. Testes unitários, lint, suíte completa e build de produção passam.
11. A landing é validada visualmente em desktop e mobile.
12. Documentação e páginas legais não contradizem a oferta aprovada.

## Fora do escopo

- Implementar ou alterar a expiração real do teste.
- Implementar ou alterar a cobrança mensal.
- Implementar ou alterar a transição real para `agent_mode = vendas`.
- Criar migrations, Edge Functions ou tabelas de telemetria.
- Adicionar depoimentos, logos, números ou cases sem evidência.
- Criar calculadora de retorno.
- Instalar uma plataforma de Analytics.
- Refazer a direção visual completa ou introduzir fotografia editorial.
