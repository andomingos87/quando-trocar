# Quando Trocar — Telas web e funcionalidades

Data: 2026-04-25
Status: proposta de produto para definir a area web

## 1. Contexto

O projeto atual ja possui tres frentes bem definidas:

- Landing page publica, voltada a explicar a dor e vender o teste.
- Demo comercial guiada, com o fluxo `Receita -> Cadastro -> Lembrete -> WhatsApp -> Retorno`.
- Materiais de WhatsApp e playbook comercial, reforcando que o produto deve parecer simples: "e um WhatsApp que faz o cliente voltar".

A area web nao deve virar um CRM, ERP ou sistema completo de oficina. Ela deve ser o painel simples que ajuda o dono da oficina e a equipe a acompanhar a maquina de recorrencia: clientes registrados, lembretes, conversas, retornos e dinheiro gerado.

## 2. Principio do produto web

Cada tela deve responder a uma pergunta pratica:

- Quanto dinheiro voltou por causa dos lembretes?
- Quem preciso cadastrar agora?
- Quem precisa receber lembrete hoje?
- Quem respondeu e precisa de acao?
- Quais clientes voltaram?
- O sistema esta configurado com a cara da minha oficina?

Tudo que nao ajudar diretamente nessas perguntas deve ficar fora da primeira versao.

## 3. Navegacao proposta

Menu principal da area logada:

1. Inicio
2. Registrar troca
3. Lembretes
4. Conversas
5. Retornos
6. Clientes
7. Configuracoes

Atalhos fixos recomendados:

- Botao primario: `Registrar troca`
- Botao secundario: `Enviar lembretes de hoje`
- Indicador visivel de receita gerada no mes

## 4. Telas essenciais

### 4.1 Inicio / Dashboard

Objetivo: mostrar valor em poucos segundos.

Funcionalidades:

- Card grande de `Receita gerada por lembretes este mes`.
- Cards menores de `Clientes cadastrados`, `Lembretes enviados` e `Clientes que voltaram`.
- Lista curta de atividades recentes: cliente cadastrado, lembrete enviado, resposta recebida, retorno confirmado.
- Bloco `Hoje`: quantidade de lembretes pendentes, respostas aguardando acao e retornos previstos.
- CTA principal para registrar nova troca.

Estados importantes:

- Primeiro acesso: explicar em uma frase como comecar e oferecer o botao `Registrar primeira troca`.
- Sem retorno ainda: manter foco em proximas acoes, sem parecer falha.
- Com retorno confirmado: destacar receita e cliente que voltou.

Observacao: esta tela deve ser comercialmente forte. O numero de receita deve ser o elemento visual mais importante.

### 4.2 Registrar troca

Objetivo: permitir que a oficina registre uma troca em menos de 30 segundos.

Funcionalidades:

- Formulario simples com nome, WhatsApp, veiculo, servico, data da troca e, se aplicavel, quilometragem atual.
- Servico padrao: `Troca de oleo`.
- Calculo automatico do proximo lembrete por prazo, por quilometragem ou ambos.
- Previa do lembrete gerado: data estimada, canal e texto base.
- Confirmacao visual depois do cadastro.

Campos recomendados para V1:

- Nome do cliente.
- WhatsApp.
- Veiculo.
- Placa, opcional.
- Servico realizado.
- Data da troca.
- KM atual, opcional.
- Proxima troca em dias, default 90.
- Proxima troca em KM, opcional.

Estados importantes:

- Cliente novo.
- Cliente ja existente pelo telefone.
- Dados incompletos.
- Lembrete criado com sucesso.

Regra de produto: o cadastro nao pode parecer burocratico. Se houver muitos campos, eles devem ser opcionais ou escondidos em `mais detalhes`.

### 4.3 Lembretes

Objetivo: mostrar quem precisa receber mensagem agora e permitir acao rapida.

Funcionalidades:

- Filtros por status: pendente, enviado, respondido, agendado, vencido.
- Tabela/lista com cliente, veiculo, ultima troca, proximo lembrete, status e acao.
- Acao individual: enviar lembrete.
- Acao em lote: enviar todos os lembretes de hoje.
- Previa da mensagem antes do envio.
- Historico simples de tentativas.

Status recomendados:

- Pendente: lembrete chegou na data, mas ainda nao foi enviado.
- Enviado: mensagem saiu para o cliente.
- Respondido: cliente respondeu e precisa de acao.
- Agendado: cliente marcou retorno.
- Sem resposta: mensagem enviada, mas sem retorno depois de um periodo definido.
- Cancelado: oficina decidiu nao enviar ou cliente pediu para parar.

Estados importantes:

- Nenhum lembrete hoje.
- Muitos lembretes pendentes.
- Falha de envio.
- Cliente sem consentimento para receber mensagem.

### 4.4 Conversas

Objetivo: centralizar o que chegou do WhatsApp sem transformar a tela em um CRM pesado.

Funcionalidades:

- Lista de conversas por prioridade: respondido, agendamento pendente, sem resposta, resolvido.
- Visual de conversa estilo WhatsApp.
- Acoes rapidas: marcar como agendado, sugerir horario, confirmar retorno, encerrar conversa.
- Exibicao do contexto do cliente: veiculo, ultima troca, proximo lembrete e historico curto.
- Campo para resposta manual da oficina, quando necessario.

Automacoes visiveis:

- Mensagem enviada automaticamente.
- Resposta do cliente.
- Sugestao de proximos passos.

Estados importantes:

- Cliente aceitou horario.
- Cliente pediu outro horario.
- Cliente nao quer receber mensagem.
- Cliente respondeu algo fora do esperado.

Regra de produto: a conversa deve reforcar que o Quando Trocar trabalha pela oficina. Evitar termos tecnicos como webhook, integracao, automacao ou API.

### 4.5 Retornos

Objetivo: fechar o ciclo e transformar lembrete em dinheiro visivel.

Funcionalidades:

- Lista de clientes agendados e retornos concluidos.
- Acao `Confirmar retorno`.
- Campo de valor do servico, com ticket medio preenchido por padrao.
- Indicador de receita gerada por lembretes no mes.
- Historico de retornos por cliente.
- Marcacao de nao compareceu.

Status recomendados:

- Agendado.
- Retornou.
- Nao compareceu.
- Reagendar.

Estados importantes:

- Primeiro retorno confirmado.
- Retorno sem valor informado.
- Cliente agendado para data futura.
- Cliente nao compareceu.

Regra de produto: todo retorno confirmado deve atualizar imediatamente o dashboard.

### 4.6 Clientes

Objetivo: dar acesso a base ativa sem competir com CRM.

Funcionalidades:

- Busca por nome, telefone, veiculo ou placa.
- Lista de clientes com status do proximo lembrete.
- Perfil simples do cliente com historico de trocas, conversas e retornos.
- Edicao de dados basicos.
- Acao para criar novo lembrete manual.
- Marcacao de opt-out, caso o cliente nao queira receber mensagens.

Campos por cliente:

- Nome.
- WhatsApp.
- Veiculos.
- Ultima troca.
- Proximo lembrete.
- Status atual.
- Valor total gerado em retornos, opcional.

Fora de escopo nesta tela:

- Pipeline comercial.
- Tags complexas.
- Segmentacao avancada.
- Funil de vendas.

### 4.7 Configuracoes

Objetivo: deixar a oficina operando com mensagens corretas e identidade propria.

Funcionalidades:

- Dados da oficina: nome, cidade, WhatsApp, endereco e horario de atendimento.
- Assinatura usada nas mensagens.
- Ticket medio padrao.
- Prazo padrao de lembrete, inicialmente 90 dias.
- Texto base do lembrete.
- Mensagem de consentimento.
- Preferencias de envio: manual, semi-automatico ou automatico, conforme maturidade da versao.

Estados importantes:

- Oficina sem dados basicos.
- Mensagem sem assinatura.
- Prazo padrao nao configurado.

Regra de produto: configuracoes devem ser poucas. O dono da oficina nao deve precisar configurar muita coisa para ver valor.

## 5. Telas de suporte

### 5.1 Login simples

Objetivo: permitir acesso da oficina sem criar friccao.

Funcionalidades:

- Entrada por WhatsApp ou e-mail.
- Codigo de acesso temporario.
- Recuperacao simples.

Para o prototipo comercial, login pode continuar fora de escopo. Para uma primeira versao privada, precisa existir o minimo necessario.

### 5.2 Onboarding da oficina

Objetivo: colocar a oficina em funcionamento em poucos minutos.

Fluxo sugerido:

1. Nome da oficina.
2. WhatsApp da oficina.
3. Ticket medio aproximado.
4. Prazo padrao de retorno.
5. Confirmacao da mensagem que o cliente vai receber.
6. Primeiro cadastro de troca.

Importante: os materiais de WhatsApp indicam que o onboarding ideal pode acontecer pelo proprio WhatsApp. A tela web deve existir como alternativa, nao como unica porta de entrada.

### 5.3 Ajuda / Como funciona

Objetivo: reduzir duvidas operacionais sem parecer central de suporte complexa.

Conteudos:

- Como registrar uma troca.
- Como enviar lembrete.
- Como confirmar retorno.
- Como o cliente recebe a mensagem.
- O que fazer quando o cliente pede para parar.

## 6. Fluxos principais

### 6.1 Registro ate retorno

1. Oficina registra troca.
2. Sistema calcula proximo lembrete.
3. Lembrete entra na fila.
4. Mensagem e enviada ao cliente.
5. Cliente responde.
6. Oficina marca como agendado.
7. Cliente volta.
8. Oficina confirma retorno e valor.
9. Dashboard atualiza receita.

### 6.2 Cliente ja existente

1. Oficina informa WhatsApp ou nome.
2. Sistema encontra cliente existente.
3. Oficina seleciona veiculo ou cria novo veiculo.
4. Nova troca e registrada no historico.
5. Novo lembrete substitui ou atualiza o lembrete anterior.

Regra: evitar duplicidade por telefone. Quando houver duvida, mostrar aviso antes de criar novo cliente.

### 6.3 Sem resposta do cliente

1. Lembrete e enviado.
2. Cliente nao responde.
3. Conversa fica como `sem resposta`.
4. Sistema pode sugerir uma segunda mensagem depois de alguns dias.
5. Depois do limite, o ciclo fica encerrado sem retorno.

Para V1, uma segunda mensagem manual ja e suficiente.

## 7. Priorizacao por versao

### V1 privada

Construir primeiro:

- Inicio / Dashboard.
- Registrar troca.
- Lembretes.
- Conversas basicas.
- Retornos.
- Configuracoes minimas.

Nao precisa construir ainda:

- Relatorios avancados.
- Multi-unidade.
- Permissoes por usuario.
- Financeiro.
- Importacao de planilha.
- Templates complexos.

### V1.1

Adicionar depois que a V1 estiver rodando:

- Clientes com historico mais completo.
- Onboarding web.
- Login simples.
- Segunda mensagem para sem resposta.
- Ajustes por tipo de servico.
- Indicador de taxa de retorno.

### V2

Avaliar somente apos validacao com oficinas:

- Integracao real com WhatsApp Business.
- Agenda mais estruturada.
- Multi-oficina.
- Permissoes por equipe.
- Importacao de clientes.
- Relatorios por periodo.
- Campanhas alem da troca de oleo.

## 8. Modelo de dados minimo

Entidades necessarias:

- Oficina.
- Cliente.
- Veiculo.
- Troca ou servico realizado.
- Lembrete.
- Conversa ou mensagem.
- Retorno.

Campos principais:

- Oficina: nome, cidade, WhatsApp, ticket medio, assinatura, prazo padrao.
- Cliente: nome, WhatsApp, consentimento, status.
- Veiculo: modelo, placa opcional, cliente vinculado.
- Troca: data, servico, km, valor opcional.
- Lembrete: data prevista, status, texto enviado, tentativas.
- Mensagem: remetente, texto, data, status.
- Retorno: data, valor, status, lembrete vinculado.

## 9. Metricas exibidas

Manter poucas metricas, alinhadas ao PRD:

- Clientes cadastrados.
- Lembretes enviados.
- Clientes que voltaram.
- Receita gerada.

Metricas secundarias podem aparecer dentro das telas, mas nao devem competir com receita:

- Lembretes pendentes hoje.
- Conversas aguardando acao.
- Agendamentos futuros.

## 10. Fora de escopo

Nao incluir na primeira definicao de telas:

- CRM completo.
- ERP de oficina.
- Controle financeiro.
- Estoque.
- Emissao de nota.
- Ordem de servico.
- Campanhas de marketing genericas.
- Relatorios customizaveis.
- App mobile nativo.
- Integracoes tecnicas expostas ao usuario.

## 11. Recomendacao de caminho

O melhor caminho e transformar a demo atual em uma area web real, mantendo a mesma narrativa:

1. Dashboard mostra dinheiro.
2. Cadastro registra a troca rapidamente.
3. Lembretes mostram a maquina rodando.
4. Conversas mostram o WhatsApp acontecendo.
5. Retornos fecham o ciclo em receita.

Essa sequencia conversa com o que ja existe no projeto e evita o erro de construir um sistema grande antes de validar o comportamento principal: fazer a oficina cadastrar trocas e confirmar retornos.
