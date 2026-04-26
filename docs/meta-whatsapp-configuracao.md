# Configuracao do WhatsApp na Meta

Este guia explica o que precisa ser configurado na Meta para o webhook real do Quando Trocar funcionar com a WhatsApp Cloud API.

## O que ja aparece configurado nos prints

Nos prints, ja existe:

- Portfolio empresarial: `BM - Anderson Domingos`
- Conta do WhatsApp Business: `Quando Trocar`
- ID da conta do WhatsApp: `152300002408804`
- Status da conta: `Aprovada`
- Fuso horario: `America/Sao_Paulo`
- Telefone de teste: `+1 555-666-9965`
- Phone Number ID do telefone de teste: `711033778757532`

Para testar com o telefone de teste da Meta, use:

```env
WHATSAPP_PHONE_NUMBER_ID=711033778757532
```

Para producao, o ideal e adicionar um numero real do Quando Trocar e trocar essa variavel pelo Phone Number ID do numero real.

## Variaveis que precisamos preencher no projeto

No ambiente onde o site estiver rodando, configure:

```env
WHATSAPP_VERIFY_TOKEN=um_token_secreto_que_voce_escolhe
WHATSAPP_APP_SECRET=app_secret_do_app_meta
WHATSAPP_ACCESS_TOKEN=token_de_acesso_da_meta
WHATSAPP_PHONE_NUMBER_ID=711033778757532
```

Tambem precisam existir as variaveis de backend ja usadas pelo bot:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Importante:

- `WHATSAPP_VERIFY_TOKEN` voce inventa. Ele so precisa ser igual no projeto e na tela de Webhooks da Meta.
- `WHATSAPP_APP_SECRET` vem do App da Meta, em `Configuracoes do app > Basico`.
- `WHATSAPP_ACCESS_TOKEN` pode ser temporario para teste, mas em producao deve ser token permanente de usuario do sistema.
- Nunca colocar `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY` em variavel `NEXT_PUBLIC_`.

## 1. Confirmar a conta do WhatsApp

Na tela do print 1:

1. Acesse o Meta Business Suite / Business Settings.
2. Va em `Contas > Contas do WhatsApp`.
3. Selecione `Quando Trocar`.
4. Confirme que:
   - Status da conta esta `Aprovada`.
   - A conta pertence ao portfolio correto.
   - Seu usuario tem permissao sobre essa conta.
5. Se for usar outra pessoa para configurar, clique em `Atribuir pessoas` e de permissao administrativa.

## 2. Confirmar o telefone

Na tela do print 2:

1. Entre no Gerenciador do WhatsApp.
2. Va em `Ferramentas da conta > Numeros de telefone`.
3. Selecione o telefone.
4. Copie o `Identificacao do numero de telefone`.

No print, o valor e:

```txt
711033778757532
```

Esse valor vai em:

```env
WHATSAPP_PHONE_NUMBER_ID=711033778757532
```

Observacao: o numero `+1 555-666-9965` e um numero de teste da Meta. Ele serve para validar integracao, mas para receber leads reais da landing sera necessario adicionar um telefone real ao WhatsApp Business.

## 3. Criar ou abrir o App da Meta

Agora va para o painel de apps:

```txt
https://developers.facebook.com/apps
```

No App que sera usado pelo Quando Trocar:

1. Adicione o produto `WhatsApp`, se ainda nao existir.
2. Entre em `WhatsApp > API Setup` ou `WhatsApp > Configuracao`.
3. Confirme que a conta `Quando Trocar` esta vinculada.
4. Confirme que o telefone selecionado e o mesmo Phone Number ID configurado no projeto.

## 4. Pegar o App Secret

O `WHATSAPP_APP_SECRET` vem do App da Meta, nao da conta do WhatsApp. Ele e usado para validar se o webhook realmente foi enviado pela Meta.

Passo a passo:

1. Acesse:

```txt
https://developers.facebook.com/apps
```

2. Clique no App usado pelo Quando Trocar.
3. No menu lateral, va em:

```txt
Configuracoes do app > Basico
```

4. Procure o campo:

```txt
Chave secreta do app
```

ou:

```txt
App Secret
```

5. Clique em `Mostrar`.
6. A Meta pode pedir sua senha novamente. Confirme.
7. Copie o valor exibido.
8. Configure no servidor:

```env
WHATSAPP_APP_SECRET=valor_do_app_secret
```

O nosso webhook usa esse valor para validar a assinatura `X-Hub-Signature-256` enviada pela Meta.

Como conferir se pegou o valor certo:

- Ele pertence ao App em `developers.facebook.com/apps`.
- Ele nao e o ID do app.
- Ele nao e o ID da conta do WhatsApp.
- Ele nao e o Phone Number ID.
- Ele deve ficar somente no backend.

No Vercel, cadastre em:

```txt
Project > Settings > Environment Variables
```

Depois de alterar essa variavel, faca um novo deploy ou redeploy.

## 5. Configurar o Webhook

O endpoint do projeto ja existe:

```txt
https://SEU_DOMINIO/api/webhooks/whatsapp
```

Exemplos:

```txt
https://quando-trocar.vercel.app/api/webhooks/whatsapp
https://preview-da-vercel.vercel.app/api/webhooks/whatsapp
```

Na Meta:

1. Va em `WhatsApp > Configuracao`.
2. Encontre a area de `Webhooks`.
3. Clique para configurar ou editar o webhook.
4. Preencha:

```txt
Callback URL:
https://SEU_DOMINIO/api/webhooks/whatsapp

Verify token:
o_mesmo_valor_de_WHATSAPP_VERIFY_TOKEN
```

5. Salve e valide.

Se a validacao funcionar, a Meta vai chamar:

```txt
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

O nosso endpoint responde com o `hub.challenge`.

## 6. Assinar eventos de mensagens

Depois de validar o callback:

1. Ainda em `WhatsApp > Configuracao > Webhooks`, encontre os campos/eventos disponiveis.
2. Assine o campo:

```txt
messages
```

Esse campo e obrigatorio para:

- Receber mensagens enviadas por usuarios para o numero.
- Receber status de mensagens enviadas pela Cloud API.

Nesta Fase 1, o sistema processa mensagens inbound de texto e apenas persiste/ignora status events.

## 7. Configurar token de acesso

O `WHATSAPP_ACCESS_TOKEN` e o token que autoriza nosso backend a chamar a Cloud API para enviar mensagens.

Existem dois jeitos:

- Token temporario: bom para teste rapido.
- Token permanente: recomendado para producao.

### 7.1 Token temporario para teste rapido

Use este caminho para testar agora com o numero de teste da Meta.

Passo a passo:

1. Acesse:

```txt
https://developers.facebook.com/apps
```

2. Abra o App usado pelo Quando Trocar.
3. No menu lateral, va em:

```txt
WhatsApp > API Setup
```

ou, dependendo da interface:

```txt
WhatsApp > Introducao
```

4. Na area `Send and receive messages`, confira:

- A conta do WhatsApp Business selecionada e `Quando Trocar`.
- O numero selecionado e o telefone de teste `+1 555-666-9965`, ou o numero real se voce ja adicionou um.
- O `Phone number ID` bate com `WHATSAPP_PHONE_NUMBER_ID`.

5. Procure o campo de token temporario. Normalmente aparece como:

```txt
Temporary access token
```

ou:

```txt
Token de acesso temporario
```

6. Copie o token.
7. Configure no servidor:

```env
WHATSAPP_ACCESS_TOKEN=token_temporario
```

8. Faca redeploy.

Observacoes:

- Esse token expira.
- Se o bot parar de enviar mensagens depois de algumas horas, gere outro token temporario ou crie o token permanente.
- Esse token serve para validar o fluxo, nao para operacao continua.

### 7.2 Token permanente para producao

Use este caminho antes de colocar o numero real da landing para operar de forma continua.

Passo a passo:

1. Acesse o Business Settings:

```txt
https://business.facebook.com/settings
```

2. Selecione o portfolio empresarial correto:

```txt
BM - Anderson Domingos
```

3. No menu lateral, va em:

```txt
Usuarios > Usuarios do sistema
```

4. Clique em `Adicionar` se ainda nao existir um usuario do sistema.
5. Use um nome claro, por exemplo:

```txt
quando-trocar-backend
```

6. Escolha o tipo com maior controle administrativo, se a Meta perguntar. Em geral, use `Administrador`.
7. Depois de criar o usuario do sistema, selecione ele.
8. Clique em `Atribuir ativos`.
9. Atribua acesso ao App usado pelo Quando Trocar.
10. Atribua acesso a conta do WhatsApp Business:

```txt
Quando Trocar
```

11. Volte para o usuario do sistema e clique em:

```txt
Gerar novo token
```

12. Selecione o App do Quando Trocar.
13. Marque as permissoes:

```txt
whatsapp_business_messaging
whatsapp_business_management
```

14. Gere o token.
15. Copie o token imediatamente. A Meta pode nao mostrar esse valor novamente.
16. Configure no servidor:

```env
WHATSAPP_ACCESS_TOKEN=token_permanente
```

17. Faca redeploy.

Como conferir se o token permanente esta correto:

- Ele foi gerado por um usuario do sistema do Business Manager.
- O usuario do sistema tem acesso ao App.
- O usuario do sistema tem acesso a conta WhatsApp `Quando Trocar`.
- O token tem `whatsapp_business_messaging`.
- O token tem `whatsapp_business_management`.

### 7.3 Teste simples do token

Depois de configurar `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`, uma chamada de envio pela Cloud API deve funcionar quando houver uma conversa aberta ou quando voce estiver usando o numero de teste conforme o fluxo da Meta.

Se quiser testar por terminal, use este formato, substituindo os valores:

```bash
curl -X POST "https://graph.facebook.com/v20.0/WHATSAPP_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer WHATSAPP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "NUMERO_DESTINO_COM_DDI_SEM_PLUS",
    "type": "text",
    "text": {
      "body": "Teste do Quando Trocar"
    }
  }'
```

Exemplo de `to`:

```txt
5541999999999
```

Se der certo, a resposta da Meta deve trazer um objeto com `messages[0].id`.

Se der erro:

- `Unsupported post request`: confira o `WHATSAPP_PHONE_NUMBER_ID`.
- `Invalid OAuth access token`: gere/configure outro token.
- `Permission denied`: confira as permissoes e os ativos atribuidos ao usuario do sistema.
- `Recipient phone number not in allowed list`: no numero de teste, adicione o destinatario permitido no `API Setup`.

### 7.4 Onde colocar no Vercel

No Vercel:

1. Abra o projeto.
2. Va em:

```txt
Settings > Environment Variables
```

3. Adicione:

```env
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_VERIFY_TOKEN=...
```

4. Marque os ambientes desejados:

- `Production`
- `Preview`
- `Development`, se for usar `vercel env pull`

5. Salve.
6. Faca redeploy para as variaveis entrarem no runtime.

## 8. Teste real

Depois do deploy e das variaveis configuradas:

1. Confirme que o webhook esta validado na Meta.
2. Confirme que o campo `messages` esta assinado.
3. Envie uma mensagem para o numero configurado:

```txt
Oi, quero testar o Quando Trocar
```

Resultado esperado:

- `whatsapp_events` recebe o payload bruto.
- `leads_oficina` cria ou atualiza o lead com `origem = landing_page`.
- `conversas` cria ou atualiza a conversa.
- `mensagens` salva a mensagem inbound.
- `outbound_messages` salva a resposta planejada.
- A Cloud API envia a resposta no WhatsApp.
- `mensagens` salva a mensagem outbound com o `whatsapp_message_id`.

Consultas uteis no Supabase:

```sql
select * from whatsapp_events order by created_at desc limit 5;
select * from leads_oficina order by created_at desc limit 5;
select * from conversas order by created_at desc limit 5;
select * from mensagens order by created_at desc limit 10;
select * from outbound_messages order by created_at desc limit 5;
```

## 9. Como testar com o numero de teste da Meta

Com o numero de teste `+1 555-666-9965`:

1. Va em `WhatsApp > API Setup`.
2. Adicione seu WhatsApp pessoal como numero destinatario de teste, se a Meta pedir.
3. Envie uma mensagem de teste pelo painel da Meta para seu WhatsApp.
4. Responda essa conversa pelo seu WhatsApp com:

```txt
Oi, quero testar o Quando Trocar
```

Se o webhook estiver certo, essa resposta deve chegar no nosso endpoint.

Limitacao importante: numero de teste nao substitui numero real da empresa. Para leads reais vindo da landing, adicione um telefone real na conta do WhatsApp e use o Phone Number ID dele.

## 10. Problemas comuns

### A Meta nao valida o callback

Verifique:

- A URL e HTTPS publica, nao `localhost`.
- O deploy esta ativo.
- `WHATSAPP_VERIFY_TOKEN` no servidor e igual ao token digitado na Meta.
- O endpoint retorna exatamente o `hub.challenge`.
- Nao ha espaco extra no token.

### Mensagem chega no WhatsApp, mas nao aparece no Supabase

Verifique:

- Campo `messages` esta assinado no webhook.
- `WHATSAPP_APP_SECRET` esta correto.
- A variavel `SUPABASE_SERVICE_ROLE_KEY` esta configurada no servidor.
- O webhook configurado na Meta aponta para o deploy certo.

### Lead aparece, mas o bot nao responde

Verifique:

- `WHATSAPP_ACCESS_TOKEN` esta valido.
- `WHATSAPP_PHONE_NUMBER_ID` e o ID do telefone selecionado.
- O numero destinatario pode receber mensagens do numero de teste.
- A conversa esta dentro da janela de atendimento de 24 horas.

### Erro depois de trocar para numero real

Ao trocar do numero de teste para numero real, atualize:

```env
WHATSAPP_PHONE_NUMBER_ID=novo_phone_number_id
NEXT_PUBLIC_WHATSAPP_NUMBER=numero_real_em_formato_internacional_sem_+
```

Exemplo:

```env
NEXT_PUBLIC_WHATSAPP_NUMBER=5541999999999
```

## Links oficiais

- Meta Webhooks: https://developers.facebook.com/docs/graph-api/webhooks
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- WhatsApp Business Platform Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- Tokens e usuarios do sistema: https://developers.facebook.com/docs/whatsapp/business-management-api/get-started
