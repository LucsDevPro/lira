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
  function textoCurto(d, lev) {
    var c = d.c, l = [];
    l.push("*LIRAa " + lev.nome + " | Ponta Porã*");
    l.push("IIP de *" + pct(c.iip, 2) + "*: *" + rotuloFaixa(d.faixa) + "*. De " + L.fmtInt(c.pesq) + " imóveis vistoriados, " + L.fmtInt(c.pos) + " tinham foco do mosquito da dengue.");
    if (d.variacao) l.push(fraseVariacao(d));
    if (d.bairros.length) {
      l.push("*Bairros com mais focos:* " + d.bairros.slice(0, 3).map(function (x) { return x.a.nome + " (" + x.c.pos + ")"; }).join(", ") + ".");
    }
    if (d.predominantes.length) {
      l.push("*Onde o mosquito mais se cria:* " + d.predominantes.map(function (t) { return L.DESC_TIPOS[t.k][0].toLowerCase() + " (" + L.DESC_TIPOS[t.k][1] + ")"; }).join(" e ") + ".");
    }
    l.push("Reserve 10 minutos por semana para esvaziar e limpar tudo o que acumula água.");
    l.push("Prefeitura Municipal de Ponta Porã | Setor de Endemias e Vetores");
    return l.join("\n");
  }

  function texto(lev, anterior, curto) {
    var d = dados(lev, anterior);
    if (!d) return "";
    if (curto) return textoCurto(d, lev);
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

  /* ---------------- imagem vertical (Status 1080×1920): tema escuro, medidor de risco ---------------- */
  var TEMA = {
    fundoTopo: "#00133a", fundoMeio: "#002b68", fundoBase: "#00163f",
    vidro: "rgba(255,255,255,.07)", borda: "rgba(255,255,255,.15)",
    texto: "#ffffff", texto2: "rgba(255,255,255,.80)", texto3: "rgba(255,255,255,.64)",
    faixa: {
      baixo: { cor: "#3ddc84", rgb: "61,220,132" },
      medio: { cor: "#ffc233", rgb: "255,194,51" },
      alto: { cor: "#ff6b6b", rgb: "255,107,107" }
    }
  };

  function espaco(ctx, v) { if ("letterSpacing" in ctx) ctx.letterSpacing = v; }
  function vidro(ctx, x, y, w, h, r) {
    ctx.save();
    ctx.shadowColor = "rgba(0,8,30,.38)"; ctx.shadowBlur = 44; ctx.shadowOffsetY = 20;
    ctx.fillStyle = TEMA.vidro; rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = TEMA.borda; ctx.lineWidth = 2; rr(ctx, x, y, w, h, r); ctx.stroke();
  }
  // texto que encolhe (e, em último caso, abrevia) para caber na largura
  function cabe(ctx, s, maxW, peso, tam, min) {
    var t = tam;
    ctx.font = peso + " " + t + "px " + FONTE;
    while (t > min && ctx.measureText(s).width > maxW) { t -= 1; ctx.font = peso + " " + t + "px " + FONTE; }
    while (s.length > 4 && ctx.measureText(s).width > maxW) { s = s.slice(0, -2).replace(/\s+$/, "") + "…"; }
    return { s: s, t: t };
  }
  function maiuscula1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Medidor semicircular com as 3 faixas oficiais e o marcador do resultado
  function medidor(ctx, cx, cy, R, E, iip, id) {
    var ids = ["baixo", "medio", "alto"], seg = Math.PI / 3, cap = (E / 2) / R, folga = 0.035;
    ids.forEach(function (fid, n) {
      var kk = TEMA.faixa[fid], ativo = fid === id;
      ctx.save();
      if (ativo) { ctx.shadowColor = "rgba(" + kk.rgb + ",.55)"; ctx.shadowBlur = 34; }
      ctx.lineWidth = E; ctx.lineCap = "round";
      ctx.strokeStyle = ativo ? kk.cor : "rgba(" + kk.rgb + ",.30)";
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI + n * seg + cap + folga, Math.PI + (n + 1) * seg - cap - folga); ctx.stroke();
      ctx.restore();
    });
    // posição do marcador: mesma lógica da régua do site (3 faixas de mesma largura)
    var fs = L.regras.iip.faixas, idx = ids.indexOf(id), ini = idx ? fs[idx - 1].limite_superior : 0, fim = fs[idx].limite_superior;
    if (fim == null) fim = Math.max(ini * 2, ini + 6);
    var frac = Math.min(1, Math.max(0, (iip - ini) / (fim - ini)));
    var ang = Math.PI + ((idx + frac) / 3) * Math.PI, px = cx + R * Math.cos(ang), py = cy + R * Math.sin(ang), k = TEMA.faixa[id];
    ctx.save();
    ctx.shadowColor = "rgba(0,8,30,.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(px, py, E * 0.74, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = k.cor; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(px, py, E * 0.74, 0, Math.PI * 2); ctx.stroke();
    // limites das faixas
    [["1%", 1], ["3,9%", 2]].forEach(function (t) {
      var a = Math.PI + t[1] * seg, rr2 = R + E / 2 + 34;
      txt(ctx, t[0], cx + rr2 * Math.cos(a), cy + rr2 * Math.sin(a) + 8, 700, 24, TEMA.texto3, "center");
    });
  }

  // Desenha a imagem no canvas. Vertical = Status (1080x1920). Devolve uma Promise.
  function desenharImagem(canvas, lev, anterior, formato) {
    if (formato === "quadrada") return desenharQuadrada(canvas, lev, anterior);
    var d = dados(lev, anterior);
    if (!d) return Promise.resolve(false);
    var fontes = global.document.fonts ? Promise.all([
      document.fonts.load("800 80px 'Plus Jakarta Sans'"), document.fonts.load("700 30px 'Plus Jakarta Sans'"), document.fonts.load("500 30px 'Plus Jakarta Sans'")
    ]).catch(function () {}) : Promise.resolve();
    return Promise.all([fontes, carregarLogo()]).then(function (r) {
      var logo = r[1], W = 1080, H = 1920, M = 72, IW = W - 2 * M;
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext("2d"), c = d.c, k = TEMA.faixa[d.faixa.id];

      /* fundo: degradê institucional + brilho na cor da faixa + anéis discretos */
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, TEMA.fundoTopo); g.addColorStop(.45, TEMA.fundoMeio); g.addColorStop(1, TEMA.fundoBase);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var g1 = ctx.createRadialGradient(900, 260, 0, 900, 260, 640);
      g1.addColorStop(0, "rgba(" + k.rgb + ",.26)"); g1.addColorStop(1, "rgba(" + k.rgb + ",0)");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createRadialGradient(120, 1700, 0, 120, 1700, 720);
      g2.addColorStop(0, "rgba(0,126,202,.32)"); g2.addColorStop(1, "rgba(0,126,202,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 2;
      [260, 400, 540].forEach(function (rad) { ctx.beginPath(); ctx.arc(1010, 120, rad, 0, Math.PI * 2); ctx.stroke(); });

      /* cabeçalho (começa abaixo da área ocupada pela barra do Status) */
      var hy = 150, tx = M;
      if (logo) {
        ctx.save(); ctx.shadowColor = "rgba(0,8,30,.38)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#ffffff"; rr(ctx, M, hy, 250, 130, 28); ctx.fill(); ctx.restore();
        var lw = 206, lh = lw * (logo.height / logo.width); if (lh > 96) { lh = 96; lw = lh * (logo.width / logo.height); }
        ctx.drawImage(logo, M + (250 - lw) / 2, hy + (130 - lh) / 2, lw, lh);
        tx = M + 250 + 38;
      }
      espaco(ctx, "3px"); txt(ctx, "LEVANTAMENTO RÁPIDO · PONTA PORÃ", tx, hy + 30, 700, 19, TEMA.texto3); espaco(ctx, "0px");
      txt(ctx, "LIRAa " + lev.nome, tx, hy + 86, 800, 54, TEMA.texto);
      txt(ctx, lev.semana_exibicao.rotulo + " · " + L.fmtPeriodo(lev.periodo), tx, hy + 122, 500, 25, TEMA.texto2);

      /* painel principal: medidor + índice */
      var py = 316, ph = 608, cx = W / 2, cy = py + 318, R = 250, E = 40;
      vidro(ctx, M, py, IW, ph, 44);
      medidor(ctx, cx, cy, R, E, c.iip, d.faixa.id);
      var num = cabe(ctx, pct(c.iip, 2), 372, 800, 132, 84);
      txt(ctx, num.s, cx, cy - 12, 800, num.t, TEMA.texto, "center");
      txt(ctx, "dos imóveis visitados tinham foco do mosquito", cx, cy + 66, 500, 27, TEMA.texto2, "center");
      // "na prática": o mesmo número em linguagem do dia a dia (igual ao texto do WhatsApp)
      var pre = "Na prática: ", fra = fraseCada100(c.iip) + ".";
      var pf = cabe(ctx, pre + fra, IW - 90, 700, 29, 22);
      ctx.font = "700 " + pf.t + "px " + FONTE;
      var wpre = ctx.measureText(pre).width, wfra = ctx.measureText(fra).width, xp = cx - (wpre + wfra) / 2;
      txt(ctx, pre, xp, cy + 114, 700, pf.t, k.cor);
      txt(ctx, fra, xp + wpre, cy + 114, 700, pf.t, TEMA.texto);
      // selo da faixa
      var rot = d.faixa.id === "alto" ? d.faixa.rotulo : d.faixa.rotulo + " · " + d.faixa.nome_oficial;
      ctx.font = "800 32px " + FONTE; var sw = ctx.measureText(rot).width + 84, sx = cx - sw / 2, sy = cy + 142;
      ctx.fillStyle = "rgba(" + k.rgb + ",.16)"; rr(ctx, sx, sy, sw, 64, 32); ctx.fill();
      ctx.strokeStyle = "rgba(" + k.rgb + ",.55)"; ctx.lineWidth = 2; rr(ctx, sx, sy, sw, 64, 32); ctx.stroke();
      ctx.fillStyle = k.cor; ctx.beginPath(); ctx.arc(sx + 36, sy + 32, 10, 0, Math.PI * 2); ctx.fill();
      txt(ctx, rot, sx + 60, sy + 43, 800, 32, k.cor);
      // variação em linguagem simples
      if (d.variacao) {
        var v = d.variacao.abs, igual = Math.abs(v) < 0.005, cor = igual ? TEMA.texto3 : (v < 0 ? TEMA.faixa.baixo.cor : TEMA.faixa.alto.cor);
        var tv = igual ? "Igual a " + d.anterior.nome : (v < 0 ? "Caiu" : "Subiu") + " de " + pct(d.ca.iip, 2) + " para " + pct(c.iip, 2) + " desde " + d.anterior.nome;
        var fv = cabe(ctx, tv, IW - 120, 700, 27, 20);
        ctx.font = "700 " + fv.t + "px " + FONTE;
        var wv = ctx.measureText(fv.s).width, off = igual ? 0 : 20, x0 = cx - (wv + off) / 2;
        if (!igual) seta(ctx, x0 + 7, cy + 266, 9, v > 0, cor);
        txt(ctx, fv.s, x0 + off, cy + 274, 700, fv.t, cor);
      }

      /* três números-chave */
      var sy2 = 948, sh = 120, gap = 20, tw = (IW - 2 * gap) / 3;
      [[L.fmtInt(c.pesq), "imóveis vistoriados"], [L.fmtInt(c.pos), "com foco do mosquito"], [String(d.totalBairrosComFoco), plural(d.totalBairrosComFoco, "bairro com foco", "bairros com foco")]].forEach(function (it, i) {
        var x = M + i * (tw + gap);
        vidro(ctx, x, sy2, tw, sh, 28);
        txt(ctx, it[0], x + tw / 2, sy2 + 60, 800, 50, TEMA.texto, "center");
        txt(ctx, it[1], x + tw / 2, sy2 + 96, 500, 22, TEMA.texto3, "center");
      });

      /* bairros com mais focos */
      var by = 1092, bh = 302, top = d.bairros.slice(0, 4), max = top.length ? top[0].c.pos : 1;
      vidro(ctx, M, by, IW, bh, 36);
      txt(ctx, "Bairros com mais focos", M + 40, by + 62, 800, 33, TEMA.texto);
      if (!top.length) txt(ctx, "Nenhum bairro teve foco neste levantamento.", M + 40, by + 160, 500, 29, TEMA.texto2);
      top.forEach(function (x, i) {
        var ry = by + 92 + i * 52, cyr = ry + 25;
        ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.arc(M + 62, cyr, 19, 0, Math.PI * 2); ctx.fill();
        txt(ctx, String(i + 1), M + 62, cyr + 8, 800, 22, TEMA.texto, "center");
        var nm = cabe(ctx, x.a.nome, 330, 700, 29, 21);
        txt(ctx, nm.s, M + 100, cyr + 10, 700, nm.t, TEMA.texto);
        var bx = 520, bw = 280;
        ctx.fillStyle = "rgba(255,255,255,.12)"; rr(ctx, bx, cyr - 8, bw, 16, 8); ctx.fill();
        var gb = ctx.createLinearGradient(bx, 0, bx + bw, 0); gb.addColorStop(0, "#5fb4ff"); gb.addColorStop(1, "#2a8cff");
        ctx.fillStyle = gb; rr(ctx, bx, cyr - 8, Math.max(16, bw * (x.c.pos / max)), 16, 8); ctx.fill();
        txt(ctx, x.c.pos + (x.c.pos === 1 ? " imóvel" : " imóveis"), W - M - 40, cyr + 9, 800, 27, TEMA.texto, "right");
      });

      /* onde o mosquito mais se cria + como evitar */
      var cy2 = 1418, ch = 366;
      vidro(ctx, M, cy2, IW, ch, 36);
      espaco(ctx, "3px"); txt(ctx, "ONDE O MOSQUITO MAIS SE CRIA", M + 40, cy2 + 52, 700, 20, TEMA.texto3); espaco(ctx, "0px");
      if (d.predominantes.length) {
        var p0 = d.predominantes[0], emp = d.predominantes.length > 1;
        var gbd = ctx.createLinearGradient(M + 40, cy2 + 76, M + 140, cy2 + 176); gbd.addColorStop(0, "#ffffff"); gbd.addColorStop(1, "#cfe6ff");
        ctx.fillStyle = gbd; rr(ctx, M + 40, cy2 + 76, 100, 100, 26); ctx.fill();
        txt(ctx, emp ? d.predominantes.map(function (t) { return t.k; }).join("+") : p0.k, M + 90, cy2 + (emp ? 138 : 143), 800, emp ? 31 : 52, TEMA.fundoMeio, "center");
        var nome = emp ? d.predominantes.map(function (t) { return L.DESC_TIPOS[t.k][0]; }).join(" e ") : L.DESC_TIPOS[p0.k][0];
        var nn = cabe(ctx, nome, IW - 200, 800, 40, 26);
        txt(ctx, nn.s, M + 168, cy2 + 120, 800, nn.t, TEMA.texto);
        var det = emp ? "Empate entre os tipos mais comuns" : maiuscula1(L.DESC_TIPOS[p0.k][1]);
        var dd = cabe(ctx, det, IW - 200, 500, 26, 20);
        txt(ctx, dd.s, M + 168, cy2 + 160, 500, dd.t, TEMA.texto2);
        txt(ctx, p0.v + " de " + d.somaDepositos + " depósitos com larvas (" + pct(p0.pct, 0) + ")", M + 40, cy2 + 218, 700, 26, TEMA.texto);
        ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(M + 40, cy2 + 238, IW - 80, 2);
        var dica = emp ? "Faça a sua parte: 10 minutos por semana para esvaziar e limpar tudo o que acumula água." : "Como evitar: " + DICAS[p0.k];
        paragrafo(ctx, dica, M + 40, cy2 + 276, IW - 80, 500, 23, TEMA.texto2, 31, 3);
      } else {
        txt(ctx, "Nenhum depósito com larvas foi encontrado.", M + 40, cy2 + 150, 700, 32, TEMA.texto);
        paragrafo(ctx, "Faça a sua parte: 10 minutos por semana para esvaziar e limpar tudo o que acumula água.", M + 40, cy2 + 220, IW - 80, 500, 24, TEMA.texto2, 32, 2);
      }

      /* rodapé institucional */
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(M, 1806, IW, 2);
      txt(ctx, "Prefeitura Municipal de Ponta Porã", W / 2, 1846, 800, 25, TEMA.texto, "center");
      txt(ctx, "Setor de Endemias e Vetores · Fonte: eVisita/PNCD", W / 2, 1878, 500, 21, TEMA.texto3, "center");
      return true;
    });
  }


  // Imagem quadrada 1080x1080 (feed e grupos)
  function desenharQuadrada(canvas, lev, anterior) {
    var d = dados(lev, anterior);
    if (!d) return Promise.resolve(false);
    var fontes = global.document.fonts ? Promise.all([
      document.fonts.load("800 80px 'Plus Jakarta Sans'"), document.fonts.load("700 30px 'Plus Jakarta Sans'"), document.fonts.load("500 30px 'Plus Jakarta Sans'")
    ]).catch(function () {}) : Promise.resolve();
    return Promise.all([fontes, carregarLogo()]).then(function (r) {
      var logo = r[1], W = 1080, H = 1080, M = 54;
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext("2d"), k = COR[d.faixa.id], c = d.c;
      ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, H);
      // cabeçalho
      ctx.fillStyle = COR.marinho; ctx.fillRect(0, 0, W, 170);
      var tx = M;
      if (logo) {
        ctx.fillStyle = COR.branco; rr(ctx, M, 30, 190, 110, 20); ctx.fill();
        var lw = 160, lh = lw * (logo.height / logo.width); if (lh > 86) { lh = 86; lw = lh * (logo.width / logo.height); }
        ctx.drawImage(logo, M + (190 - lw) / 2, 30 + (110 - lh) / 2, lw, lh);
        tx = M + 190 + 30;
      }
      txt(ctx, "LIRAa " + lev.nome, tx, 82, 800, 48, "#ffffff");
      txt(ctx, "Mosquito da dengue em Ponta Porã", tx, 120, 500, 27, "rgba(255,255,255,.85)");
      txt(ctx, lev.semana_exibicao.rotulo + " · " + L.fmtPeriodo(lev.periodo), tx, 154, 500, 23, "rgba(255,255,255,.7)");

      // cartão do resultado (esquerda)
      var y = 200, h1 = 400;
      ctx.fillStyle = COR.branco; rr(ctx, M, y, W - 2 * M, h1, 32); ctx.fill();
      txt(ctx, "Índice de Infestação Predial (IIP)", M + 40, y + 62, 700, 28, COR.ink2);
      txt(ctx, pct(c.iip, 2), M + 40, y + 200, 800, 150, COR.ink);
      var rot = d.faixa.id === "alto" ? d.faixa.rotulo : d.faixa.rotulo + " · " + d.faixa.nome_oficial;
      ctx.font = "700 30px " + FONTE; var sw = ctx.measureText(rot).width + 62;
      ctx.fillStyle = k.bg; rr(ctx, M + 40, y + 226, sw, 56, 28); ctx.fill();
      ctx.fillStyle = k.cor; ctx.beginPath(); ctx.arc(M + 40 + 30, y + 226 + 28, 10, 0, Math.PI * 2); ctx.fill();
      txt(ctx, rot, M + 40 + 52, y + 226 + 38, 700, 30, k.ink);
      if (d.variacao) {
        var v = d.variacao.abs, igual = Math.abs(v) < 0.005, cor = igual ? COR.muted : (v < 0 ? COR.baixo.ink : COR.alto.ink);
        var tv = igual ? "igual a " + d.anterior.nome : L.fmtDec(Math.abs(v), 2) + " pontos";
        txt(ctx, tv, W - M - 40, y + 118, 800, 34, cor, "right");
        if (!igual) { ctx.font = "800 34px " + FONTE; seta(ctx, W - M - 40 - ctx.measureText(tv).width - 26, y + 106, 12, v > 0, cor); }
        if (!igual) txt(ctx, "vs. " + d.anterior.nome, W - M - 40, y + 154, 500, 24, COR.muted, "right");
      }
      paragrafo(ctx, L.fmtInt(c.pesq) + " imóveis vistoriados, " + L.fmtInt(c.pos) + " com foco do mosquito.", M + 40, y + 332, W - 2 * M - 80, 500, 28, COR.ink2, 38, 2);

      // bairros (esquerda) e criadouro (direita)
      y = 632; var h2 = 330, colW = (W - 2 * M - 24) / 2;
      ctx.fillStyle = COR.branco; rr(ctx, M, y, colW, h2, 28); ctx.fill();
      txt(ctx, "Bairros com mais focos", M + 32, y + 56, 800, 29, COR.ink);
      var top = d.bairros.slice(0, 3);
      if (!top.length) txt(ctx, "Nenhum bairro com foco.", M + 32, y + 120, 500, 26, COR.ink2);
      top.forEach(function (x, i) {
        var ry = y + 86 + i * 78;
        txt(ctx, String(i + 1), M + 32, ry + 44, 800, 28, COR.muted);
        var tam = 27, nm = x.a.nome, disp = colW - 66 - 28 - 150;
        ctx.font = "700 " + tam + "px " + FONTE;
        while (tam > 20 && ctx.measureText(nm).width > disp) { tam -= 1; ctx.font = "700 " + tam + "px " + FONTE; }
        while (nm.length > 4 && ctx.measureText(nm).width > disp) { nm = nm.slice(0, -2) + "…"; }
        txt(ctx, nm, M + 66, ry + 44, 700, tam, COR.ink);
        txt(ctx, x.c.pos + (x.c.pos === 1 ? " imóvel" : " imóveis"), M + colW - 28, ry + 44, 800, 25, COR.marinho, "right");
        ctx.fillStyle = COR.linha; ctx.fillRect(M + 32, ry + 62, colW - 60, 2);
      });
      var x2 = M + colW + 24;
      ctx.fillStyle = COR.marinho; rr(ctx, x2, y, colW, h2, 28); ctx.fill();
      txt(ctx, "Onde o mosquito mais se cria", x2 + 32, y + 56, 700, 26, "rgba(255,255,255,.8)");
      if (d.predominantes.length) {
        var p0 = d.predominantes[0], emp = d.predominantes.length > 1;
        ctx.fillStyle = "#ffffff"; rr(ctx, x2 + 32, y + 86, 96, 96, 22); ctx.fill();
        txt(ctx, emp ? d.predominantes.map(function (t) { return t.k; }).join("+") : p0.k, x2 + 80, y + 150, 800, emp ? 30 : 52, COR.marinho, "center");
        var nome = emp ? d.predominantes.map(function (t) { return L.DESC_TIPOS[t.k][0]; }).join(" e ") : L.DESC_TIPOS[p0.k][0];
        paragrafo(ctx, nome, x2 + 148, y + 118, colW - 176, 800, 31, "#ffffff", 36, 2);
        txt(ctx, p0.v + " de " + d.somaDepositos + " depósitos (" + pct(p0.pct, 0) + ")", x2 + 32, y + 232, 700, 26, "#ffffff");
        paragrafo(ctx, emp ? "Empate entre os tipos mais comuns." : L.DESC_TIPOS[p0.k][1], x2 + 32, y + 272, colW - 64, 500, 23, "rgba(255,255,255,.8)", 30, 2);
      } else {
        txt(ctx, "Nenhum depósito com larvas.", x2 + 32, y + 130, 500, 26, "#ffffff");
      }
      // rodapé
      ctx.fillStyle = COR.marinho; ctx.fillRect(0, H - 90, W, 90);
      txt(ctx, "Prefeitura Municipal de Ponta Porã", W / 2, H - 50, 800, 26, "#ffffff", "center");
      txt(ctx, "Setor de Endemias e Vetores · Fonte: eVisita/PNCD", W / 2, H - 20, 500, 21, "rgba(255,255,255,.75)", "center");
      return true;
    });
  }

  function nomeArquivo(lev, sufixo) {
    return ("LIRAa-" + lev.nome + "-" + sufixo).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9\-\/]+/g, "-").replace(/\//g, "-");
  }

  global.LIRA_RESUMO = { dados: dados, texto: texto, textoHtml: textoHtml, desenharImagem: desenharImagem, nomeArquivo: nomeArquivo, anteriorDe: anteriorDe, DICAS: DICAS };
})(window);
