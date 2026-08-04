#!/usr/bin/env python3
"""Gera os PDFs diagramados dos guias de Instagram a partir dos markdowns.

Fonte da verdade é `docs/marketing/instagram/*.md`; este script só diagrama.
Editou o markdown, rode de novo.

    python3 -m venv .venv && .venv/bin/pip install markdown-it-py
    .venv/bin/python scripts/marketing/instagram-pdf/build.py

Precisa do Google Chrome instalado (motor de impressão) e, na primeira
execução, de internet — baixa DM Sans/DM Mono e embute como base64 em
`fonts.css`, para o PDF renderizar igual em qualquer máquina.
"""

import base64
import html
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

from markdown_it import MarkdownIt

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = ROOT / "docs/marketing/instagram"
OUT = SRC / "pdf"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GOOGLE_FONTS = (
    "https://fonts.googleapis.com/css2"
    "?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"

MD = MarkdownIt("commonmark").enable(["table", "strikethrough"])

SECTION_NOTES = {
    "Objetivo do perfil": "O que o Instagram faz e o que ele não faz",
    "Público": "Quem é o dono de oficina e o que isso muda na comunicação",
    "Tom de voz": "O que é, o que não é e o jargão a traduzir",
    "Guardrails — o que nunca pode ir ao ar": "Oito proibições rastreadas à regra de negócio",
    "Pilares de conteúdo": "Cinco pilares e o peso de cada um",
    "Cronograma — mês 1": "Cadência, horários e o arco das 4 semanas",
    "Como produzir a arte (GPT Image 2)":
        "Prompt curto, referências anexadas, bloco MARCA e as três direções de cena",
    "Estrutura da legenda": "Anatomia do texto e política de hashtag",
    "Medição e o que fazer depois de 4 semanas": "O que olhar no Insights e a ordem da fase 2",
}


# ---------------------------------------------------------------- fontes

def ensure_fonts():
    """Baixa DM Sans/DM Mono e embute como data: URI. Cacheado em fonts.css."""
    dest = HERE / "fonts.css"
    if dest.exists():
        return dest.read_text()
    req = urllib.request.Request(GOOGLE_FONTS, headers={"User-Agent": UA})
    css = urllib.request.urlopen(req, timeout=60).read().decode()
    for url in sorted(set(re.findall(r"https://fonts\.gstatic\.com[^)]+\.woff2", css))):
        blob = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60
        ).read()
        css = css.replace(url, "data:font/woff2;base64," + base64.b64encode(blob).decode())
    dest.write_text(css)
    return css


# ---------------------------------------------------------------- inline

def inline(tokens):
    """Renderiza tokens inline (negrito, código, link, ênfase)."""
    out = []
    for t in tokens or []:
        if t.type == "text":
            out.append(html.escape(t.content))
        elif t.type == "code_inline":
            out.append(f"<code>{html.escape(t.content)}</code>")
        elif t.type == "strong_open":
            out.append("<strong>")
        elif t.type == "strong_close":
            out.append("</strong>")
        elif t.type == "em_open":
            out.append("<em>")
        elif t.type == "em_close":
            out.append("</em>")
        elif t.type == "s_open":
            out.append("<s>")
        elif t.type == "s_close":
            out.append("</s>")
        elif t.type == "link_open":
            out.append(f'<a href="{html.escape(t.attrGet("href") or "")}">')
        elif t.type == "link_close":
            out.append("</a>")
        elif t.type in ("softbreak", "hardbreak"):
            out.append("<br>")
        elif t.type == "html_inline":
            out.append(t.content)
    return "".join(out)


def plain(tokens):
    return re.sub(r"\s+", " ", "".join(
        t.content for t in (tokens or []) if t.type in ("text", "code_inline")
    )).strip()


def strong_head(children):
    """Separa o negrito de abertura do resto: ('Imagem — capa:', 'MARCA + Direção: CENA +').

    ('', '') quando o parágrafo não começa em negrito. O markdown-it emite um
    token de texto vazio antes do negrito, então o primeiro token relevante é o
    primeiro que não é texto em branco.
    """
    first = next((n for n, t in enumerate(children or [])
                  if not (t.type == "text" and not t.content.strip())), None)
    if first is None or children[first].type != "strong_open":
        return "", ""
    close = next((n for n in range(first + 1, len(children))
                  if children[n].type == "strong_close"), None)
    if close is None:
        return "", ""
    return plain(children[first + 1:close]), plain(children[close + 1:])


def slug(text):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower().strip())).strip("-")


# ---------------------------------------------------------------- cartões

HASHTAG_RE = re.compile(r"^#\w[\w#\s]*$")


def card(kind, label, body, note=""):
    lines = body.rstrip("\n").split("\n")
    if kind == "caption" and lines and HASHTAG_RE.match(lines[-1].strip()):
        tags = html.escape(lines[-1].strip())
        text = html.escape("\n".join(lines[:-1]).rstrip("\n"))
        inner = f'{text}<span class="hashtags">{tags}</span>'
    else:
        inner = html.escape("\n".join(lines))
    note_html = f'<span class="card-note">{html.escape(note)}</span>' if note else ""
    return (
        f'<div class="card {kind}">'
        f'<div class="card-head"><span class="card-kind">{html.escape(label)}</span>{note_html}</div>'
        f'<div class="card-body">{inner}</div>'
        f"</div>"
    )


def fence_kind(label):
    low = label.lower()
    if "legenda" in low and "estrutura" not in low:
        return "caption", "Legenda", "colar no Instagram"
    if any(k in low for k in ("imagem", "base", "cena", "delta", "prompt")):
        return "prompt", "Prompt · GPT Image 2", "MARCA + CENA + TEXTO · anexar logo e referências"
    return "plain", label or "Bloco", ""


# ---------------------------------------------------------------- renderer

class Renderer:
    """Percorre o stream de tokens e monta o corpo do documento."""

    def __init__(self, kind):
        self.kind = kind            # "estrategia" | "posts"
        self.out = []
        self.toc = []
        self.lead = []              # conteúdo antes da 1ª seção (vai pro sumário)
        self.pending_label = ""
        self.open_section = False
        self.started = False

    def close_section(self):
        if self.open_section:
            self.out.append("</section>")
            self.open_section = False

    def open_post(self, text):
        self.close_section()
        m = re.match(r"Post\s+(\d+)\s*[—-]\s*(.+)", text)
        num, title = (m.group(1), m.group(2)) if m else ("", text)
        anchor = slug(f"post-{num}-{title}")
        self.toc.append((f"Post {num} — {title}", anchor, ""))
        self.out.append(
            f'<section class="post" id="{anchor}">'
            f'<div class="post-head no-break">'
            f'<div class="post-num">{int(num):02d}<small>DE 12</small></div>'
            f'<div><h2 class="post-title">{html.escape(title)}</h2></div>'
            f"</div>"
        )
        self.open_section = True

    def open_plain_section(self, text):
        self.close_section()
        m = re.match(r"(\d+)\.\s*(.+)", text)
        num, title = (m.group(1), m.group(2)) if m else ("", text)
        anchor = slug(title)
        self.toc.append((title, anchor, SECTION_NOTES.get(title, "")))
        danger = " danger" if "Guardrails" in title else ""
        eyebrow = f"Seção {int(num):02d}" if num else "Seção"
        self.out.append(
            f'<section class="section{danger}" id="{anchor}">'
            f'<p class="eyebrow">{html.escape(eyebrow)}</p>'
            f"<h2>{html.escape(title)}</h2>"
        )
        self.open_section = True

    def run(self, tokens):
        i = 0
        while i < len(tokens):
            t = tokens[i]

            if t.type == "heading_open":
                text = plain(tokens[i + 1].children)
                if t.tag == "h2":
                    self.started = True
                    if self.kind == "posts" and text.startswith("Post "):
                        self.open_post(text)
                    else:
                        self.open_plain_section(text)
                elif t.tag != "h1":      # h1 vira título da capa, definido fora
                    self.out.append(f"<{t.tag}>{inline(tokens[i + 1].children)}</{t.tag}>")
                    self.pending_label = text
                i += 3
                continue

            if t.type == "paragraph_open":
                content = tokens[i + 1]
                text = plain(content.children)
                target = self.out if self.started else self.lead

                # metadados do post: `Semana 1 · Terça 19h · Pilar 1 (dor) · ...`
                if (self.kind == "posts" and self.started
                        and len(content.children or []) == 1
                        and content.children[0].type == "code_inline"
                        and "·" in text):
                    chips = []
                    for n, part in enumerate(p.strip() for p in text.split("·")):
                        cls = "chip accent" if n == 2 else "chip"
                        chips.append(f'<span class="{cls}">{html.escape(part)}</span>')
                    target.append(f'<div class="chips no-break">{"".join(chips)}</div>')

                # rótulo de slot: o parágrafo abre com negrito (**Imagem — capa:**).
                # O rótulo é só o negrito; o que vem depois é frase normal.
                elif re.match(r"^(Imagem|Legenda|Texto|Slides)\b",
                              strong_head(content.children)[0]):
                    label_raw, rest = strong_head(content.children)
                    self.pending_label = label_raw
                    label = label_raw.rstrip(":").strip()
                    bm = re.search(r"Direção:\s*([A-ZÁ-Ú]+)", rest)
                    base = f' <span class="base">· {bm.group(1)}</span>' if bm else ""
                    # "Legenda" já vem no cabeçalho do cartão — não repetir
                    if label.lower() != "legenda":
                        target.append(f'<p class="slot-label">{html.escape(label)}{base}</p>')
                    prose = rest.replace(bm.group(0), "") if bm else rest
                    prose = re.sub(r"\s*\+\s*\+", " +", prose)
                    prose = re.sub(r"\s{2,}", " ", prose).strip(" +·:")
                    if prose[:1].islower():   # sobrou meio de frase ao tirar o rótulo
                        prose = prose[0].upper() + prose[1:]
                    if len(prose) > 12:
                        target.append(f"<p>{html.escape(prose)}</p>")
                else:
                    target.append(f"<p>{inline(content.children)}</p>")
                i += 3
                continue

            if t.type == "fence":
                kind, label, note = fence_kind(self.pending_label)
                (self.out if self.started else self.lead).append(
                    card(kind, label, t.content, note))
                self.pending_label = ""
                i += 1
                continue

            if t.type == "blockquote_open":
                depth, j = 1, i + 1
                while j < len(tokens) and depth:
                    depth += (tokens[j].type == "blockquote_open")
                    depth -= (tokens[j].type == "blockquote_close")
                    j += 1
                body = [f"<p>{inline(tokens[k].children)}</p>"
                        for k in range(i + 1, j - 1) if tokens[k].type == "inline"]
                (self.out if self.started else self.lead).append(
                    f"<blockquote>{''.join(body)}</blockquote>")
                i = j
                continue

            if t.type in ("bullet_list_open", "ordered_list_open"):
                tag = "ul" if t.type.startswith("bullet") else "ol"
                opens = ("bullet_list_open", "ordered_list_open")
                closes = ("bullet_list_close", "ordered_list_close")
                depth, j = 1, i + 1
                while j < len(tokens) and depth:
                    depth += (tokens[j].type in opens)
                    depth -= (tokens[j].type in closes)
                    j += 1
                items = [f"<li>{inline(tokens[k].children)}</li>"
                         for k in range(i + 1, j - 1) if tokens[k].type == "inline"]
                (self.out if self.started else self.lead).append(
                    f"<{tag}>{''.join(items)}</{tag}>")
                i = j
                continue

            if t.type == "table_open":
                j = i
                while tokens[j].type != "table_close":
                    j += 1
                rows, cells, in_head, wide = [], [], False, False
                for k in range(i, j):
                    tk = tokens[k]
                    if tk.type == "thead_open":
                        in_head = True
                    elif tk.type == "thead_close":
                        in_head = False
                    elif tk.type == "tr_open":
                        cells = []
                    elif tk.type == "inline":
                        cells.append(inline(tk.children))
                    elif tk.type == "tr_close":
                        tag = "th" if in_head else "td"
                        rows.append((in_head, "".join(f"<{tag}>{c}</{tag}>" for c in cells)))
                        if not in_head and cells and len(re.sub(r"<[^>]+>", "", cells[0])) > 22:
                            wide = True
                head = "".join(f"<tr>{r}</tr>" for h, r in rows if h)
                body = "".join(f"<tr>{r}</tr>" for h, r in rows if not h)
                (self.out if self.started else self.lead).append(
                    f'<table{" class=\"wide\"" if wide else ""}>'
                    f"<thead>{head}</thead><tbody>{body}</tbody></table>")
                i = j + 1
                continue

            i += 1

        self.close_section()
        return self


# ---------------------------------------------------------------- documento

def cover_html(logo, label, title_html, sub, meta):
    rows = "".join(f"<div><dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd></div>"
                   for k, v in meta)
    return f"""<div class="cover">
  <div class="cover-grid"></div>
  <div class="cover-top">
    <img class="cover-logo" src="data:image/png;base64,{logo}" alt="Quando Trocar">
    <p class="cover-label">{html.escape(label)}</p>
    <div class="cover-rule"></div>
    <h1 class="cover-title">{title_html}</h1>
    <p class="cover-sub">{html.escape(sub)}</p>
  </div>
  <div class="cover-foot">
    <div class="cover-foot-grid"></div>
    <dl class="cover-meta">{rows}</dl>
  </div>
</div>"""


def build(fonts, logo, brand, src, kind, doc_title,
          cover_label, cover_title, cover_sub, meta, toc_title):
    r = Renderer(kind).run(MD.parse((SRC / src).read_text()))
    items = "".join(
        f'<li><a href="#{a}">{html.escape(t)}</a>'
        f'<span class="toc-note">{html.escape(n)}</span></li>'
        for t, a, n in r.toc
    )
    doc = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>{html.escape(doc_title)}</title>
<style>{fonts}</style>
<style>{brand}</style>
</head><body>
{cover_html(logo, cover_label, cover_title, cover_sub, meta)}
<section class="toc">
  <p class="eyebrow">{html.escape(toc_title)}</p>
  <h1>Sumário</h1>
  {"".join(r.lead)}
  <ol>{items}</ol>
</section>
{"".join(r.out)}
</body></html>"""

    stem = pathlib.Path(src).stem
    page = HERE / f"{stem}.html"
    page.write_text(doc)
    OUT.mkdir(parents=True, exist_ok=True)
    pdf = OUT / f"{stem}.pdf"
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
         "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
         "--virtual-time-budget=10000", f"--print-to-pdf={pdf}", page.as_uri()],
        check=True, capture_output=True,
    )
    print(f"{pdf.relative_to(ROOT)} — {len(r.toc)} entradas, {round(pdf.stat().st_size/1024)} KB")


def main():
    if not os.path.exists(CHROME):
        sys.exit(f"Google Chrome não encontrado em {CHROME} (é o motor de impressão).")
    fonts = ensure_fonts()
    brand = (HERE / "brand.css").read_text()
    logo = base64.b64encode((ROOT / "public/logo.png").read_bytes()).decode()

    build(fonts, logo, brand, "estrategia.md", "estrategia",
          "Quando Trocar — Instagram: estratégia e cronograma",
          "Guia de conteúdo · Instagram",
          "Estratégia<br>e <em>cronograma</em>",
          "Objetivo, público, tom de voz, guardrails, pilares e cadência do perfil. "
          "Base para todo post publicado.",
          [("Documento", "01 de 02"), ("Período", "Mês 1 · julho 2026"),
           ("Fonte", "docs/marketing/instagram/estrategia.md")],
          "Guia de conteúdo · Instagram")

    build(fonts, logo, brand, "mes-1-posts.md", "posts",
          "Quando Trocar — Instagram: mês 1, 12 posts",
          "Guia de execução · Instagram",
          "Mês 1<br><em>12 posts</em> prontos",
          "Prompt completo (MARCA + CENA + TEXTO), anexos e legenda de cada post, na ordem de publicação.",
          [("Documento", "02 de 02"), ("Período", "Mês 1 · julho 2026"),
           ("Fonte", "docs/marketing/instagram/mes-1-posts.md")],
          "Guia de execução · Instagram")


if __name__ == "__main__":
    main()
