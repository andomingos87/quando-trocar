const pptxgen = require('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs');
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

const out = path.resolve('output/quando-trocar-fluxos-whatsapp-ia.pptx');
const previewDir = path.resolve('scratch/previews');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

const W = 13.333, H = 7.5;
const pxW = 1920, pxH = 1080;
const C = {
  bg: '0B1117', ink: 'F8FAFC', muted: 'AEB8C2', graphite: '151D26', line: '2A3542',
  orange: 'FF7A1A', orange2: 'FFB15C', green: '25D366', greenDark: '0B8F45', blue: '67E8F9', red: 'EF4444', white: 'FFFFFF'
};
const img = {
  engine: path.resolve('scratch/assets/workshop-engine.jpg'),
  car: path.resolve('scratch/assets/workshop-car.jpg'),
  lift: path.resolve('scratch/assets/autocenter-lift.jpg'),
};

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Quando Trocar';
pptx.company = 'Quando Trocar';
pptx.subject = 'Fluxos WhatsApp + Agente IA + Banco de Dados';
pptx.title = 'Quando Trocar - Fluxos';
pptx.lang = 'pt-BR';
pptx.theme = {
  headFontFace: 'Bahnschrift',
  bodyFontFace: 'Aptos',
  lang: 'pt-BR'
};
pptx.defineLayout({ name: 'CUSTOM_WIDE', width: W, height: H });
pptx.layout = 'CUSTOM_WIDE';
pptx.margin = 0;
pptx.defineSlideMaster({
  title: 'QT_MASTER',
  background: { color: C.bg },
  objects: [
    { line: { x: 0.55, y: 7.08, w: 12.2, h: 0, line: { color: C.line, transparency: 20, width: 0.7 } } },
    { text: { text: 'QUANDO TROCAR', options: { x: 0.56, y: 7.16, w: 2.2, h: 0.16, fontFace: 'Bahnschrift', fontSize: 6.5, bold: true, color: C.muted, charSpace: 1.4 } } }
  ],
  slideNumber: { x: 12.42, y: 7.12, color: C.muted, fontFace: 'Aptos', fontSize: 7 }
});

function slide() { const s = pptx.addSlide('QT_MASTER'); s.background = { color: C.bg }; return s; }
function tx(s, text, x, y, w, h, opts = {}) { s.addText(text, { x, y, w, h, margin: 0, breakLine: false, fit: 'shrink', fontFace: opts.fontFace || 'Aptos', fontSize: opts.fontSize || 18, color: opts.color || C.ink, bold: !!opts.bold, italic: !!opts.italic, valign: opts.valign || 'mid', align: opts.align || 'left', breakLine: opts.breakLine, charSpace: opts.charSpace, transparency: opts.transparency || 0, paraSpaceAfterPt: 0, ...opts }); }
function title(s, t, sub) { tx(s, t, 0.62, 0.48, 8.9, 0.68, { fontFace: 'Bahnschrift', fontSize: 30, bold: true }); if (sub) tx(s, sub, 0.65, 1.18, 7.9, 0.36, { fontSize: 12.5, color: C.muted }); }
function rect(s, x, y, w, h, fill, opts={}) { s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: fill, transparency: opts.transparency || 0 }, line: { color: opts.line || fill, transparency: opts.lineTrans ?? 100, width: opts.width || 1 }, radius: opts.radius || 0 }); }
function pill(s, text, x, y, w, fill, color=C.white) { rect(s, x, y, w, 0.34, fill, { lineTrans: 100 }); tx(s, text, x+0.12, y+0.055, w-0.24, 0.2, { fontSize: 8.6, bold: true, color, align: 'center', charSpace: 0.5 }); }
function line(s, x1, y1, x2, y2, color=C.orange, width=2.3) { s.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2-x1, h: y2-y1, line: { color, width, beginArrowType: 'none', endArrowType: 'triangle' } }); }
function dot(s, x, y, color=C.orange, size=0.18) { s.addShape(pptx.ShapeType.ellipse, { x: x-size/2, y: y-size/2, w: size, h: size, fill: { color }, line: { color } }); }
function photo(s, path, x, y, w, h, trans=0) { s.addImage({ path, x, y, w, h, sizingCrop: true, transparency: trans }); }
function overlay(s, trans=18) { rect(s, 0, 0, W, H, C.bg, { transparency: trans, lineTrans: 100 }); }
function chip(s, text, x, y, color=C.orange) { tx(s, text, x, y, 1.55, 0.22, { fontFace:'Bahnschrift', fontSize: 7.5, bold: true, color, charSpace: 1.2 }); }
function phone(s, x, y, w, h, messages) {
  rect(s, x, y, w, h, '0A0F14', { line:'334155', lineTrans:0 });
  rect(s, x+0.18, y+0.18, w-0.36, 0.45, '10251B', { lineTrans:100 });
  tx(s, 'WhatsApp • Agente Quando Trocar', x+0.35, y+0.32, w-0.7, 0.14, { fontSize: 7.4, bold: true, color: C.green });
  let cy = y + 0.88;
  for (const m of messages) {
    const bw = m.w || w*0.68;
    const bx = m.side === 'right' ? x + w - bw - 0.28 : x + 0.28;
    const fill = m.side === 'right' ? '0C7A43' : '222C38';
    rect(s, bx, cy, bw, m.h || 0.45, fill, { lineTrans:100 });
    tx(s, m.text, bx+0.13, cy+0.08, bw-0.25, (m.h || 0.45)-0.12, { fontSize: m.fs || 8.2, color: C.white, breakLine: true });
    cy += (m.h || 0.45) + 0.18;
  }
}
function stage(s, big, label) { tx(s, big, 0.72, 5.75, 7.8, 0.64, { fontFace:'Bahnschrift', fontSize: 28, bold: true, color: C.orange }); tx(s, label, 0.76, 6.36, 7.4, 0.3, { fontSize: 12.5, color: C.muted }); }
function card(s, x, y, w, h, head, body, color=C.orange) { rect(s,x,y,w,h,'101923',{line:'263342',lineTrans:0}); dot(s,x+0.22,y+0.24,color,0.12); tx(s,head,x+0.42,y+0.16,w-0.56,0.22,{fontFace:'Bahnschrift',fontSize:10.2,bold:true,color}); tx(s,body,x+0.22,y+0.48,w-0.4,h-0.62,{fontSize:8.8,color:C.ink,breakLine:true}); }

const previews = [];
function svgPreview(idx, label, subtitle, bgPath=null) {
  const svg = `<svg width="${pxW}" height="${pxH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#${C.bg}"/><circle cx="1570" cy="160" r="330" fill="#${C.orange}" opacity="0.18"/><circle cx="260" cy="900" r="380" fill="#${C.green}" opacity="0.08"/><text x="90" y="126" fill="#${C.orange}" font-family="Arial" font-size="22" font-weight="700" letter-spacing="4">QUANDO TROCAR</text><text x="90" y="520" fill="#${C.ink}" font-family="Arial" font-size="72" font-weight="800">${label.replace(/&/g,'&amp;')}</text><text x="96" y="590" fill="#${C.muted}" font-family="Arial" font-size="30">${subtitle.replace(/&/g,'&amp;')}</text><text x="1780" y="1015" fill="#${C.muted}" font-family="Arial" font-size="20">${String(idx).padStart(2,'0')}</text></svg>`;
  const p = path.join(previewDir, `slide-${String(idx).padStart(2,'0')}.png`);
  previews.push(sharp(Buffer.from(svg)).png().toFile(p));
}

// 1
{ const s=slide(); photo(s,img.lift,0,0,W,H); overlay(s,34); rect(s,0,0,5.2,H,C.bg,{transparency:8,lineTrans:100}); chip(s,'WHATSAPP • IA • RECORRÊNCIA',0.72,0.74,C.green); tx(s,'Quando\nTrocar',0.68,1.52,4.8,1.82,{fontFace:'Bahnschrift',fontSize:48,bold:true,breakLine:true}); tx(s,'A máquina de recorrência da oficina via WhatsApp',0.74,3.72,4.2,0.76,{fontSize:17,color:C.ink,breakLine:true}); rect(s,0.74,4.85,2.95,0.58,C.orange,{lineTrans:100}); tx(s,'Fluxo comercial + operacional',0.96,5.05,2.5,0.16,{fontSize:9.8,bold:true,color:'111827',align:'center'}); svgPreview(1,'Quando Trocar','A máquina de recorrência da oficina via WhatsApp'); }
// 2
{ const s=slide(); photo(s,img.car,7.3,0,6.03,H); rect(s,6.9,0,6.5,H,C.bg,{transparency:22,lineTrans:100}); title(s,'O vazamento de receita','Depois da troca, o cliente some se ninguém lembrar.'); const steps=[['Troca hoje','Cliente sai satisfeito'],['90 dias','Ninguém chama'],['Concorrente','Cliente troca em outro lugar'],['Receita perdida','A oficina nem percebe quanto perdeu']]; let x=0.9; steps.forEach((st,i)=>{dot(s,x,3.45,i===3?C.red:C.orange,0.28); tx(s,st[0],x-0.35,3.83,1.1,0.22,{fontFace:'Bahnschrift',fontSize:11,bold:true,color:i===3?C.red:C.orange,align:'center'}); tx(s,st[1],x-0.55,4.18,1.5,0.42,{fontSize:8.6,color:C.muted,align:'center',breakLine:true}); if(i<3) line(s,x+0.22,3.45,x+1.95,3.45,'6B7280',1.6); x+=2.25; }); stage(s,'Sem gatilho, sem retorno.','O problema é operacional, não técnico.'); svgPreview(2,'O vazamento de receita','Cliente troca hoje, esquece e volta no concorrente.'); }
// 3
{ const s=slide(); photo(s,img.engine,0,0,W,H); overlay(s,46); chip(s,'PROMESSA',0.78,0.83); tx(s,'A gente lembra\no cliente na\nhora certa\npra ele voltar.',0.74,1.55,6.2,2.9,{fontFace:'Bahnschrift',fontSize:38,bold:true,breakLine:true}); card(s,7.55,1.38,4.35,1.1,'Para a oficina','Cadastra a troca hoje. O sistema chama depois.',C.orange); card(s,7.55,2.78,4.35,1.1,'Para o representante','Explica em 3 minutos e vende recorrência.',C.green); card(s,7.55,4.18,4.35,1.1,'Para o cliente final','Recebe WhatsApp no momento de trocar óleo.',C.blue); svgPreview(3,'A promessa','Lembrar no momento certo para gerar retorno.'); }
// 4
{ const s=slide(); title(s,'Fluxo completo do negócio','Do clique na landing até a receita contabilizada no dashboard.'); const nodes=['Landing','Agente vendedor','Oficina cliente','Agente operacional','Lembretes','Retorno']; const xs=[0.88,2.85,5.05,7.25,9.28,11.12]; nodes.forEach((n,i)=>{rect(s,xs[i],3.05,1.36,0.82,i<2?'172033':i<4?'1A2B1F':'241A12',{line:i<2?'334155':i<4?C.green:C.orange,lineTrans:0}); tx(s,n,xs[i]+0.08,3.32,1.2,0.18,{fontFace:'Bahnschrift',fontSize:9.2,bold:true,color:i<2?C.blue:i<4?C.green:C.orange,align:'center'}); if(i<5) line(s,xs[i]+1.42,3.46,xs[i+1]-0.08,3.46,C.orange,2); }); tx(s,'O mesmo agente primeiro vende. Depois opera a recorrência.',1.25,5.05,10.8,0.48,{fontFace:'Bahnschrift',fontSize:24,bold:true,align:'center'}); svgPreview(4,'Fluxo completo','Landing → venda → operação → lembrete → retorno.'); }
// 5
{ const s=slide(); title(s,'Etapa 1: Landing page','A oficina entende a promessa e entra no WhatsApp.'); photo(s,img.lift,7.8,1.1,4.65,4.9); rect(s,0.86,1.42,5.55,4.65,'F8FAFC',{line:'CBD5E1',lineTrans:0}); tx(s,'QUANDO TROCAR',1.18,1.82,2.2,0.18,{fontFace:'Bahnschrift',fontSize:8.5,bold:true,color:'111827',charSpace:1.1}); tx(s,'Clientes voltando\nsem você lembrar\nna mão.',1.18,2.35,4.4,1.05,{fontFace:'Bahnschrift',fontSize:24,bold:true,color:'111827',breakLine:true}); tx(s,'Cadastre a troca hoje. A gente chama o cliente daqui 90 dias pelo WhatsApp.',1.2,3.78,3.7,0.48,{fontSize:11,color:'334155',breakLine:true}); rect(s,1.18,4.58,2.28,0.46,C.orange,{lineTrans:100}); tx(s,'Quero testar',1.48,4.74,1.65,0.13,{fontSize:8.8,bold:true,color:'111827',align:'center'}); line(s,6.62,3.75,7.52,3.75,C.green,2.8); pill(s,'CTA abre WhatsApp',5.16,3.18,1.74,C.green,'062414'); svgPreview(5,'Landing page','A oficina clica e conversa com o agente.'); }
// 6
{ const s=slide(); title(s,'Etapa 2: Agente vendedor','Atende, explica, tira dúvidas, calcula ROI e conduz para fechar.'); phone(s,0.9,1.48,4.65,4.82,[{side:'left',text:'Vi o site. Como funciona?',h:0.45},{side:'right',text:'Você cadastra a troca de óleo. Depois de 90 dias eu chamo o cliente para voltar.',h:0.7,w:3.35},{side:'left',text:'Tenho que mandar manual?',h:0.45},{side:'right',text:'Não. A máquina roda sozinha e te mostra retorno e receita.',h:0.6,w:3.2}]); card(s,6.45,1.7,2.75,1.2,'Explica','Produto em linguagem simples, sem jargão técnico.',C.blue); card(s,9.45,1.7,2.75,1.2,'Qualifica','Coleta volume, ticket médio, cidade e responsável.',C.green); card(s,6.45,3.35,2.75,1.2,'Calcula ROI','Mostra quanto retorno paga a mensalidade.',C.orange); card(s,9.45,3.35,2.75,1.2,'Fecha','Conduz para teste, plano ou cadastro.',C.orange); stage(s,'Modo: vendas','Objetivo: transformar interesse em contratação.'); svgPreview(6,'Agente vendedor','Explica, qualifica e fecha pelo WhatsApp.'); }
// 7
{ const s=slide(); title(s,'Etapa 3: Oficina vira cliente','Quando aceita testar ou contratar, o status muda no banco.'); tx(s,'lead_oficina',1.28,2.25,2.05,0.34,{fontFace:'Bahnschrift',fontSize:18,bold:true,color:C.blue,align:'center'}); rect(s,1.05,2.1,2.5,0.85,'121B28',{line:C.blue,lineTrans:0}); line(s,3.85,2.52,5.32,2.52,C.orange,3); tx(s,'cliente_oficina',5.72,2.25,2.35,0.34,{fontFace:'Bahnschrift',fontSize:18,bold:true,color:C.green,align:'center'}); rect(s,5.42,2.1,2.9,0.85,'10251B',{line:C.green,lineTrans:0}); rect(s,9.0,1.28,3.15,4.18,'101923',{line:'334155',lineTrans:0}); tx(s,'Banco grava',9.32,1.62,2.4,0.28,{fontFace:'Bahnschrift',fontSize:16,bold:true,color:C.orange}); ['oficina_id','nome_oficina','responsável','whatsapp_oficina','ticket_médio','status = ativa'].forEach((a,i)=>{tx(s,a,9.37,2.18+i*0.43,2.2,0.2,{fontSize:10.5,color:C.ink});}); stage(s,'Conversão reconhecida','O agente sabe que a oficina já não é lead.'); svgPreview(7,'Lead vira cliente','O banco muda o status da oficina.'); }
// 8
{ const s=slide(); title(s,'Etapa 4: O agente muda de modo','A mesma conversa muda de objetivo conforme o status da oficina.'); rect(s,0.92,1.62,5.35,3.45,'111827',{line:'334155',lineTrans:0}); rect(s,7.05,1.62,5.35,3.45,'10251B',{line:C.green,lineTrans:0}); tx(s,'ANTES DA CONTRATAÇÃO',1.28,2.02,3.4,0.22,{fontFace:'Bahnschrift',fontSize:11,bold:true,color:C.blue,charSpace:1}); tx(s,'Vender para\na oficina',1.28,2.52,4.2,0.92,{fontFace:'Bahnschrift',fontSize:30,bold:true,breakLine:true}); tx(s,'Explicar • qualificar • responder objeções • fechar',1.3,4.22,4.25,0.28,{fontSize:11,color:C.muted}); tx(s,'DEPOIS DA CONTRATAÇÃO',7.42,2.02,3.8,0.22,{fontFace:'Bahnschrift',fontSize:11,bold:true,color:C.green,charSpace:1}); tx(s,'Trabalhar pela\noficina',7.42,2.52,4.2,0.92,{fontFace:'Bahnschrift',fontSize:30,bold:true,breakLine:true}); tx(s,'Registrar • agendar lembretes • acompanhar retorno',7.45,4.22,4.25,0.28,{fontSize:11,color:C.muted}); line(s,6.35,3.33,6.95,3.33,C.orange,3); svgPreview(8,'Mudança de modo','Antes vende. Depois opera.'); }
// 9
{ const s=slide(); title(s,'Etapa 5: Registro de trocas','A oficina pode cadastrar pelo painel ou falando com o agente.'); phone(s,0.82,1.45,4.4,4.75,[{side:'left',text:'Registrar João, Civic 2018, troca de óleo hoje, 41999990000',h:0.72,w:3.45},{side:'right',text:'Cliente cadastrado. Próximo lembrete em 90 dias.',h:0.52,w:3.15}]); rect(s,6.2,1.65,5.7,3.7,'101923',{line:'334155',lineTrans:0}); tx(s,'Registro no banco',6.56,1.98,2.8,0.28,{fontFace:'Bahnschrift',fontSize:17,bold:true,color:C.orange}); const rows=[['cliente','João Silva'],['veículo','Civic 2018'],['serviço','Troca de óleo'],['data_troca','25/04/2026'],['próximo_lembrete','24/07/2026']]; rows.forEach((r,i)=>{tx(s,r[0],6.6,2.55+i*0.45,1.7,0.18,{fontSize:9.5,color:C.muted}); tx(s,r[1],8.35,2.55+i*0.45,2.4,0.18,{fontSize:9.8,bold:true,color:C.ink});}); stage(s,'Registro → Lembrete','Cada troca vira um gatilho futuro.'); svgPreview(9,'Registro de trocas','Oficina fala, agente estrutura, banco agenda.'); }
// 10
{ const s=slide(); title(s,'Etapa 6: Lembrete automático','O scheduler encontra quem venceu e o WhatsApp chama no prazo certo.'); rect(s,0.85,1.62,2.55,1.2,'111827',{line:'334155',lineTrans:0}); tx(s,'Banco',1.55,1.96,1.2,0.25,{fontFace:'Bahnschrift',fontSize:16,bold:true,color:C.blue,align:'center'}); rect(s,4.12,1.62,2.55,1.2,'241A12',{line:C.orange,lineTrans:0}); tx(s,'Scheduler',4.7,1.96,1.4,0.25,{fontFace:'Bahnschrift',fontSize:16,bold:true,color:C.orange,align:'center'}); rect(s,7.4,1.62,2.55,1.2,'10251B',{line:C.green,lineTrans:0}); tx(s,'WhatsApp',7.96,1.96,1.45,0.25,{fontFace:'Bahnschrift',fontSize:16,bold:true,color:C.green,align:'center'}); rect(s,10.67,1.62,1.9,1.2,'101923',{line:'334155',lineTrans:0}); tx(s,'Cliente',11.05,1.96,1.1,0.25,{fontFace:'Bahnschrift',fontSize:16,bold:true,color:C.ink,align:'center'}); line(s,3.48,2.22,4.02,2.22); line(s,6.75,2.22,7.29,2.22); line(s,10.03,2.22,10.57,2.22); phone(s,3.55,3.58,6.22,1.78,[{side:'right',text:'Oi João, aqui é da Auto Center Silva. Já está na hora da próxima troca de óleo do Civic. Quer agendar?',h:0.68,w:4.65,fs:8.1}]); stage(s,'Pendente → Enviado','O valor está no gatilho automático, não no painel.'); svgPreview(10,'Lembrete automático','Scheduler encontra vencidos e WhatsApp dispara.'); }
// 11
{ const s=slide(); photo(s,img.lift,0,0,W,H); overlay(s,52); title(s,'Etapa 7: Retorno e receita','Quando o cliente volta, a oficina informa o valor e o dashboard mostra dinheiro.'); rect(s,0.9,1.7,3.05,1.28,'241A12',{line:C.orange,lineTrans:0}); tx(s,'R$ 8.250',1.16,2.0,2.45,0.32,{fontFace:'Bahnschrift',fontSize:30,bold:true,color:C.orange,align:'center'}); tx(s,'Receita gerada por lembretes',1.12,2.56,2.55,0.18,{fontSize:9.2,color:C.muted,align:'center'}); [['128','Clientes'],['42','Lembretes'],['11','Retornos']].forEach((m,i)=>{rect(s,4.35+i*2.05,1.86,1.58,0.9,'101923',{line:'334155',lineTrans:0});tx(s,m[0],4.68+i*2.05,2.05,0.9,0.24,{fontFace:'Bahnschrift',fontSize:20,bold:true,color:C.ink,align:'center'});tx(s,m[1],4.58+i*2.05,2.47,1.1,0.14,{fontSize:7.8,color:C.muted,align:'center'});}); phone(s,7.6,3.45,4.25,2.0,[{side:'left',text:'Opa, pode ser quinta 14h?',h:0.42,w:2.6},{side:'right',text:'Combinado. Te esperamos quinta às 14h.',h:0.48,w:2.95}]); stage(s,'Retorno → Receita','O dashboard vende o resultado para a oficina.'); svgPreview(11,'Retorno e receita','Cliente agenda, volta e vira dinheiro visível.'); }
// 12
{ const s=slide(); title(s,'Arquitetura simples','Cinco peças, cada uma com uma responsabilidade clara.'); const blocks=[['WhatsApp','Canal de conversa'],['Agente IA','Interpreta e conduz'],['Banco','Guarda estados e dados'],['Scheduler','Dispara gatilhos'],['Dashboard','Mostra resultado']]; blocks.forEach((b,i)=>{const x=1.0+i*2.35; rect(s,x,2.18,1.72,1.32,i===0?'10251B':i===1?'241A12':'111827',{line:i===0?C.green:i===1?C.orange:'334155',lineTrans:0}); tx(s,b[0],x+0.12,2.55,1.48,0.22,{fontFace:'Bahnschrift',fontSize:13,bold:true,color:i===0?C.green:i===1?C.orange:C.blue,align:'center'}); tx(s,b[1],x+0.14,3.0,1.44,0.24,{fontSize:7.8,color:C.muted,align:'center',breakLine:true}); if(i<4) line(s,x+1.78,2.84,x+2.27,2.84,C.orange,2); }); tx(s,'A arquitetura existe para sustentar um ciclo de negócio simples: cadastrar, lembrar, converter e medir.',1.45,5.25,10.4,0.45,{fontSize:16,color:C.ink,align:'center'}); svgPreview(12,'Arquitetura simples','WhatsApp + IA + Banco + Scheduler + Dashboard.'); }
// 13
{ const s=slide(); photo(s,img.engine,0,0,W,H); overlay(s,45); chip(s,'RESUMO FINAL',0.82,0.82,C.orange); tx(s,'O mesmo agente\nvende, cadastra\ne opera a\nrecorrência.',0.78,1.5,6.4,2.7,{fontFace:'Bahnschrift',fontSize:42,bold:true,breakLine:true}); const cycle=[['1','Atrair'],['2','Fechar'],['3','Registrar'],['4','Lembrar'],['5','Retornar']]; cycle.forEach((c,i)=>{rect(s,7.6,1.25+i*0.82,3.35,0.46,i<2?'241A12':'10251B',{lineTrans:100}); tx(s,c[0],7.82,1.38+i*0.82,0.28,0.12,{fontSize:8,bold:true,color:i<2?C.orange:C.green,align:'center'}); tx(s,c[1],8.25,1.34+i*0.82,1.8,0.16,{fontFace:'Bahnschrift',fontSize:12,bold:true,color:C.ink}); }); rect(s,7.6,5.88,3.35,0.56,C.orange,{lineTrans:100}); tx(s,'Resultado: cliente volta e a oficina vê receita.',7.86,6.07,2.82,0.14,{fontSize:8.8,bold:true,color:'111827',align:'center'}); svgPreview(13,'O agente completo','Vende, cadastra e opera a recorrência.'); }

Promise.all(previews).then(async()=>{
  await pptx.writeFile({ fileName: out });
  console.log(out);
  console.log(previewDir);
}).catch(err=>{ console.error(err); process.exit(1); });
