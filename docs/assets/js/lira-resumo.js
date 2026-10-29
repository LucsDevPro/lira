/* =========================================================
   Resumo em linguagem simples (texto p/ WhatsApp) e imagem p/ Status
   Tudo é calculado a partir dos dados do levantamento — nada é inventado.
   ========================================================= */
(function (global) {
  "use strict";
  var L = global.LIRA;

  var DICAS = {
    A1: "Mantenha caixas d'água e cisternas bem tampadas e vedadas.",
    A2: "Tampe tambores, tonéis e barris ou guarde-os cobertos.",
    B: "Lave vasos, garrafas, pratinhos de planta e bebedouros de animais com bucha pelo menos 1 vez por semana, ou deixe-os virados para baixo.",
    C: "Limpe ralos, calhas e lajes e não deixe água parada nesses lugares.",
    D1: "Guarde pneus e sucatas cobertos ou em lugar protegido da chuva.",
    D2: "Não jogue lixo em terrenos e quintais: feche bem o lixo e entregue na coleta.",
    E: "Fique atento a ocos de árvore e plantas que acumulam água (como bromélias): também podem criar o mosquito."
  };
  var SITUACAO = {
    baixo: "Situação satisfatória: poucos imóveis com focos. Mesmo assim, os cuidados precisam continuar.",
    medio: "Situação de alerta: já existem focos suficientes para exigir atenção de todos.",
    alto: "Situação de risco: há muitos focos e risco de surto de dengue, zika e chikungunya."
  };

  function plural(n, um, varios) { return n === 1 ? um : varios; }
  function pct(v, d) { return L.fmtDec(v, d == null ? 1 : d) + "%"; }
  function anteriorDe(lev) {
    var i = L.comDados.indexOf(lev);
    return i > 0 ? L.comDados[i - 1] : null;
  }

  // Dados já "mastigados" do resumo
  function dados(lev, anterior) {
    if (!lev || lev.status !== "com_dados") return null;
    if (anterior === undefined) anterior = anteriorDe(lev);
    var c = L.agregar(lev), ca = anterior ? L.agregar(anterior) : null;
    var faixa = L.classificar("iip", c.iip);

    var bairros = L.areasDe(lev).map(function (a) { return { a: a, c: L.calc(a.dados) }; })
      .filter(function (x) { return x.c.pos > 0; })
      .sort(function (x, y) { return (y.c.pos - x.c.pos) || (y.c.iip - x.c.iip) || x.a.nome.localeCompare(y.a.nome, "pt-BR"); });

    var soma = 0;
    L.TIPOS.forEach(function (k) { soma += c.tipos[k]; });
    var tipos = L.TIPOS.map(function (k) { return { k: k, v: c.tipos[k], pct: soma ? (c.tipos[k] / soma) * 100 : 0 }; })
      .sort(function (x, y) { return (y.v - x.v) || (L.TIPOS.indexOf(x.k) - L.TIPOS.indexOf(y.k)); });
    var topo = soma ? tipos.filter(function (t) { return t.v === tipos[0].v; }) : [];

    return {
      lev: lev, anterior: anterior, c: c, ca: ca, faixa: faixa,
      variacao: ca ? L.variacao(c.iip, ca.iip) : null,
      bairros: bairros, totalBairrosComFoco: bairros.length,
      tipos: tipos, somaDepositos: soma, predominantes: topo
    };
  }

  function rotuloFaixa(f) { return f.id === "alto" ? f.rotulo : f.rotulo + " (" + f.nome_oficial + ")"; }
  function nomeTipo(k) { return L.DESC_TIPOS[k][0] + " (" + k + ")"; }

  function frasePredominante(d) {
    if (!d.predominantes.length) return "Nenhum depósito com larvas foi encontrado neste levantamento.";
    var p = d.predominantes;
    if (p.length === 1) {
      return "O tipo mais comum foi *" + nomeTipo(p[0].k) + "* (" + L.DESC_TIPOS[p[0].k][1] + "): " +
        p[0].v + " dos " + d.somaDepositos + " depósitos com larvas (" + pct(p[0].pct, 0) + ").";
    }
    return "Houve empate entre " + p.map(function (t) { return "*" + nomeTipo(t.k) + "*"; }).join(" e ") +
      ", cada um com " + p[0].v + " dos " + d.somaDepositos + " depósitos com larvas.";
  }

  function fraseVariacao(d) {
    if (!d.variacao) return "";
    var v = d.variacao.abs, n = d.anterior.nome, ant = pct(d.ca.iip, 2);
    if (Math.abs(v) < 0.005) return "Em relação a " + n + " (" + ant + "), o índice *ficou igual*.";
    return "Em relação a " + n + " (" + ant + "), o índice *" + (v < 0 ? "caiu" : "subiu") + "* para " + pct(d.c.iip, 2) + ".";
  }

  function fraseCada100(iip) {
    if (iip < 1) return "a cada 100 imóveis, menos de 1 tinha foco";
    var n = Math.round(iip);
    return "a cada 100 imóveis, cerca de " + n + " " + plural(n, "tinha", "tinham") + " foco";
  }

  // Texto pronto para colar/enviar no WhatsApp (negrito com *...*). Sem emojis.
  function texto(lev, anterior) {
    var d = dados(lev, anterior);
    if (!d) return "";
    var c = d.c, l = [];
    l.push("*LIRAa " + lev.nome + " | Ponta Porã*");
    l.push("Levantamento do mosquito da dengue (" + lev.semana_exibicao.rotulo + ", " + L.fmtPeriodo(lev.periodo) + ")");
    l.push("");
    l.push("*RESULTADO*");
    l.push("O Índice de Infestação Predial (IIP) foi de *" + pct(c.iip, 2) + "*, classificado como *" + rotuloFaixa(d.faixa) + "*.");
    l.push("Foram vistoriados " + L.fmtInt(c.pesq) + " imóveis e " + L.fmtInt(c.pos) + " " + plural(c.pos, "tinha", "tinham") +
      " foco do mosquito Aedes aegypti. Ou seja, " + fraseCada100(c.iip) + ".");
    l.push(SITUACAO[d.faixa.id]);
    if (d.variacao) l.push(fraseVariacao(d));
    l.push("");
    l.push("*BAIRROS COM MAIS FOCOS*");
    if (d.bairros.length) {
      d.bairros.slice(0, 5).forEach(function (x, i) {
        l.push((i + 1) + ". " + x.a.nome + ": " + x.c.pos + " " + plural(x.c.pos, "imóvel", "imóveis") + " com foco (de " + x.c.pesq + " vistoriados)");
      });
      if (d.totalBairrosComFoco > 5) l.push("Outros " + (d.totalBairrosComFoco - 5) + " bairros também tiveram focos.");
    } else {
      l.push("Nenhum bairro teve foco do mosquito neste levantamento.");
    }
    l.push("");
    l.push("*ONDE O MOSQUITO MAIS SE CRIA*");
    l.push(frasePredominante(d));
    if (d.predominantes.length) l.push("*Como evitar:* " + d.predominantes.map(function (t) { return DICAS[t.k]; }).join(" "));
    l.push("");
    l.push("*Faça a sua parte:* reserve 10 minutos por semana para esvaziar e limpar tudo o que acumula água. Onde não há água parada, o mosquito não se cria.");
    l.push("");
    l.push("Prefeitura Municipal de Ponta Porã | Setor de Endemias e Vetores");
    return l.join("\n");
  }

  // Versão HTML (pré-visualização imitando o WhatsApp): *negrito* e _itálico_
  function textoHtml(t) {
    return L.esc(t).replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>").replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;])/g, "$1<em>$2</em>").replace(/\n/g, "<br>");
  }

  /* ---------------- imagem (Status do WhatsApp, 1080×1920) ---------------- */
  var COR = {
    marinho: "#002b68", azul: "#007eca", ink: "#0e1a2b", ink2: "#475467", muted: "#8590a2", linha: "#e3e7ee", fundo: "#f4f6f9", branco: "#ffffff",
    baixo: { cor: "#0ca30c", bg: "#e5f5e5", ink: "#0a5c0a" },
    medio: { cor: "#f2a900", bg: "#fff1cf", ink: "#7a4d00" },
    alto: { cor: "#d03b3b", bg: "#fbe4e4", ink: "#9c1f1f" }
  };
  var FONTE = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, peso, tam, cor, alinha) {
    ctx.font = peso + " " + tam + "px " + FONTE; ctx.fillStyle = cor; ctx.textAlign = alinha || "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  }
  function quebra(ctx, s, maxW, peso, tam) {
    ctx.font = peso + " " + tam + "px " + FONTE;
    var palavras = s.split(" "), linhas = [], atual = "";
    palavras.forEach(function (p) {
      var t = atual ? atual + " " + p : p;
      if (ctx.measureText(t).width > maxW && atual) { linhas.push(atual); atual = p; } else atual = t;
    });
    if (atual) linhas.push(atual);
    return linhas;
  }
  function paragrafo(ctx, s, x, y, maxW, peso, tam, cor, alt, maxLinhas) {
    var ls = quebra(ctx, s, maxW, peso, tam);
    if (maxLinhas && ls.length > maxLinhas) { ls = ls.slice(0, maxLinhas); ls[maxLinhas - 1] = ls[maxLinhas - 1].replace(/\s*\S*$/, "") + "…"; }
    ls.forEach(function (ln, i) { txt(ctx, ln, x, y + i * alt, peso, tam, cor); });
    return y + ls.length * alt;
  }
  function seta(ctx, x, y, tam, sobe, cor) {
    ctx.fillStyle = cor; ctx.beginPath();
    if (sobe) { ctx.moveTo(x, y - tam); ctx.lineTo(x + tam, y + tam * .6); ctx.lineTo(x - tam, y + tam * .6); }
    else { ctx.moveTo(x, y + tam); ctx.lineTo(x + tam, y - tam * .6); ctx.lineTo(x - tam, y - tam * .6); }
    ctx.closePath(); ctx.fill();
  }

  function carregarLogo() {
    return new Promise(function (ok) {
      var src = global.LIRA_LOGO || "assets/logo_pmpp.png";
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { ok(null); };
      im.src = src;
    });
  }

  // Desenha a imagem no canvas (1080x1920). Devolve uma Promise.
  function desenharImagem(canvas, lev, anterior) {
    var d = dados(lev, anterior);
    if (!d) return Promise.resolve(false);
    var fontes = global.document.fonts ? Promise.all([
      document.fonts.load("800 80px 'Plus Jakarta Sans'"), document.fonts.load("700 30px 'Plus Jakarta Sans'"), document.fonts.load("500 30px 'Plus Jakarta Sans'")
    ]).catch(function () {}) : Promise.resolve();
    return Promise.all([fontes, carregarLogo()]).then(function (r) {
      var logo = r[1], W = 1080, H = 1920;
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext("2d");
      var k = COR[d.faixa.id], c = d.c, M = 64;

      // fundo e cabeçalho
      ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COR.marinho; ctx.fillRect(0, 0, W, 250);
      if (logo) {
        ctx.fillStyle = COR.branco; rr(ctx, M, 54, 250, 142, 24); ctx.fill();
        var lw = 210, lh = lw * (logo.height / logo.width); if (lh > 112) { lh = 112; lw = lh * (logo.width / logo.height); }
        ctx.drawImage(logo, M + (250 - lw) / 2, 54 + (142 - lh) / 2, lw, lh);
      }
      txt(ctx, "LIRAa " + lev.nome, 350, 118, 800, 54, "#ffffff");
      txt(ctx, "Mosquito da dengue em Ponta Porã", 350, 166, 500, 32, "rgba(255,255,255,.85)");
      txt(ctx, lev.semana_exibicao.rotulo + " · " + L.fmtPeriodo(lev.periodo), 350, 208, 500, 28, "rgba(255,255,255,.7)");

      // cartão do resultado
      var y = 290;
      ctx.fillStyle = COR.branco; rr(ctx, M, y, W - 2 * M, 560, 36); ctx.fill();
      txt(ctx, "Índice de Infestação Predial (IIP)", M + 44, y + 78, 700, 34, COR.ink2);
      txt(ctx, pct(c.iip, 2), M + 44, y + 250, 800, 190, COR.ink);
      // selo
      var rot = d.faixa.id === "alto" ? d.faixa.rotulo : d.faixa.rotulo + " · " + d.faixa.nome_oficial;
      ctx.font = "700 34px " + FONTE; var sw = ctx.measureText(rot).width + 70;
      ctx.fillStyle = k.bg; rr(ctx, M + 44, y + 285, sw, 64, 32); ctx.fill();
      ctx.fillStyle = k.cor; ctx.beginPath(); ctx.arc(M + 44 + 34, y + 285 + 32, 11, 0, Math.PI * 2); ctx.fill();
      txt(ctx, rot, M + 44 + 58, y + 285 + 44, 700, 34, k.ink);
      // variação
      if (d.variacao) {
        var v = d.variacao.abs, igual = Math.abs(v) < 0.005, cor = igual ? COR.muted : (v < 0 ? COR.baixo.ink : COR.alto.ink);
        var tv = igual ? "igual a " + d.anterior.nome : L.fmtDec(Math.abs(v), 2) + " pontos";
        txt(ctx, tv, W - M - 44, y + 150, 800, 38, cor, "right");
        if (!igual) { ctx.font = "800 38px " + FONTE; seta(ctx, W - M - 44 - ctx.measureText(tv).width - 28, y + 136, 13, v > 0, cor); }
        txt(ctx, igual ? "" : "vs. " + d.anterior.nome, W - M - 44, y + 192, 500, 26, COR.muted, "right");
      }
      // frase leiga
      var fr = L.fmtInt(c.pesq) + " imóveis vistoriados, " + L.fmtInt(c.pos) + " com foco do mosquito. " + (fraseCada100(c.iip).charAt(0).toUpperCase() + fraseCada100(c.iip).slice(1)) + ".";
      paragrafo(ctx, fr, M + 44, y + 405, W - 2 * M - 88, 500, 31, COR.ink2, 42, 3);
      // régua oficial com pino
      var rx = M + 44, rw = W - 2 * M - 88, ry = y + 478, seg = rw / 3;
      var nomes = ["< 1%", "1% a 3,9%", "> 3,9%"], ids = ["baixo", "medio", "alto"];
      ids.forEach(function (id, i) {
        ctx.globalAlpha = id === d.faixa.id ? 1 : .38; ctx.fillStyle = COR[id].cor;
        rr(ctx, rx + i * seg + (i ? 3 : 0), ry, seg - (i < 2 ? 3 : 0) - (i ? 3 : 0) + (i === 1 ? 0 : 0), 14, 7); ctx.fill();
        ctx.globalAlpha = 1;
        txt(ctx, nomes[i], rx + i * seg + seg / 2, ry + 48, id === d.faixa.id ? 800 : 500, 24, id === d.faixa.id ? COR[id].ink : COR.muted, "center");
      });
      var fs = L.regras.iip.faixas, idx = ids.indexOf(d.faixa.id), ini = idx ? fs[idx - 1].limite_superior : 0, fim = fs[idx].limite_superior;
      if (fim == null) fim = Math.max(ini * 2, ini + 6);
      var frac = Math.min(1, Math.max(0, (c.iip - ini) / (fim - ini))), px = rx + (idx + frac) * seg;
      ctx.fillStyle = COR.ink; ctx.beginPath(); ctx.arc(px, ry + 7, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.stroke();

      // bairros com mais focos
      y = 890;
      txt(ctx, "Bairros com mais focos", M, y + 46, 800, 44, COR.ink);
      var top = d.bairros.slice(0, 5), max = top.length ? top[0].c.pos : 1, ly = y + 82;
      if (!top.length) {
        ctx.fillStyle = COR.branco; rr(ctx, M, ly, W - 2 * M, 110, 28); ctx.fill();
        txt(ctx, "Nenhum bairro teve foco neste levantamento.", M + 36, ly + 66, 600, 32, COR.ink2);
        ly += 110;
      }
      top.forEach(function (x, i) {
        var ry2 = ly + i * 84;
        ctx.fillStyle = COR.branco; rr(ctx, M, ry2, W - 2 * M, 74, 22); ctx.fill();
        txt(ctx, String(i + 1), M + 44, ry2 + 49, 800, 32, COR.muted, "center");
        txt(ctx, x.a.nome.length > 24 ? x.a.nome.slice(0, 23) + "…" : x.a.nome, M + 84, ry2 + 49, 700, 31, COR.ink);
        var bx = 580, bw = 210;
        ctx.fillStyle = COR.linha; rr(ctx, bx, ry2 + 28, bw, 18, 9); ctx.fill();
        ctx.fillStyle = COR.marinho; rr(ctx, bx, ry2 + 28, Math.max(18, bw * (x.c.pos / max)), 18, 9); ctx.fill();
        txt(ctx, x.c.pos + (x.c.pos === 1 ? " imóvel" : " imóveis"), W - M - 30, ry2 + 49, 800, 29, COR.ink, "right");
      });
      var fimBairros = ly + Math.max(top.length, 1) * 84;

      // criadouro predominante
      y = fimBairros + 20;
      var alt2 = 350;
      ctx.fillStyle = COR.marinho; rr(ctx, M, y, W - 2 * M, alt2, 36); ctx.fill();
      txt(ctx, "Onde o mosquito mais se cria", M + 44, y + 64, 700, 32, "rgba(255,255,255,.8)");
      if (d.predominantes.length) {
        var p0 = d.predominantes[0], emp = d.predominantes.length > 1;
        ctx.fillStyle = "#ffffff"; rr(ctx, M + 44, y + 98, 120, 120, 28); ctx.fill();
        txt(ctx, emp ? d.predominantes.map(function (t) { return t.k; }).join("+") : p0.k, M + 104, y + 178, 800, emp ? 38 : 64, COR.marinho, "center");
        var nome = emp ? d.predominantes.map(function (t) { return L.DESC_TIPOS[t.k][0]; }).join(" e ") : L.DESC_TIPOS[p0.k][0];
        paragrafo(ctx, nome, M + 196, y + 134, W - 2 * M - 240, 800, 42, "#ffffff", 48, 2);
        paragrafo(ctx, emp ? "Empate entre os tipos mais comuns" : L.DESC_TIPOS[p0.k][1], M + 196, y + 196, W - 2 * M - 240, 500, 29, "rgba(255,255,255,.8)", 36, 1);
        txt(ctx, p0.v + " de " + d.somaDepositos + " depósitos com larvas (" + pct(p0.pct, 0) + ")", M + 44, y + 262, 700, 32, "#ffffff");
        var dica = emp ? "" : DICAS[p0.k];
        paragrafo(ctx, dica || "Faça a sua parte: 10 minutos por semana para esvaziar e limpar tudo que acumula água.", M + 44, y + 304, W - 2 * M - 88, 500, 24, "rgba(255,255,255,.78)", 30, 2);
      } else {
        txt(ctx, "Nenhum depósito com larvas foi encontrado.", M + 44, y + 150, 600, 34, "#ffffff");
      }

      // rodapé
      ctx.fillStyle = COR.marinho; ctx.fillRect(0, H - 120, W, 120);
      txt(ctx, "Prefeitura Municipal de Ponta Porã", W / 2, H - 70, 800, 30, "#ffffff", "center");
      txt(ctx, "Setor de Endemias e Vetores · Fonte: eVisita/PNCD", W / 2, H - 30, 500, 24, "rgba(255,255,255,.75)", "center");
      return true;
    });
  }

  function nomeArquivo(lev, sufixo) {
    return ("LIRAa-" + lev.nome + "-" + sufixo).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9\-\/]+/g, "-").replace(/\//g, "-");
  }

  global.LIRA_RESUMO = { dados: dados, texto: texto, textoHtml: textoHtml, desenharImagem: desenharImagem, nomeArquivo: nomeArquivo, anteriorDe: anteriorDe, DICAS: DICAS };
})(window);
