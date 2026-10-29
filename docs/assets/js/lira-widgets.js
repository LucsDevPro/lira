/* Componentes reutilizados na Home, no Dashboard e nos Detalhes */
(function (global) {
  "use strict";
  var L = global.LIRA, esc = L.esc;


  /* ---- bloco de destaque (Home e Detalhes) ----
     opts: {chip, tag, acoes: bool}. Mostra IIP (com classificação), IB (só o valor)
     e a legenda oficial do IIP com a faixa atual destacada. */
  function destaque(lev, anterior, opts) {
    opts = opts || {};
    var tag = opts.tag || "h2";
    var c = L.agregar(lev), ca = anterior ? L.agregar(anterior) : null;
    var dIip = ca ? L.variacao(c.iip, ca.iip) : null, dIb = ca ? L.variacao(c.ib, ca.ib) : null;
    return '<div class="card destaque"><div class="destaque-corpo">' +
      '<div class="destaque-info">' +
      '<span class="eyebrow">' + esc(opts.chip || "Levantamento") + "</span>" +
      "<" + tag + ">LIRAa " + esc(lev.nome) + "</" + tag + ">" +
      '<p class="sub">' + esc(lev.semana_exibicao.rotulo) +
      " · coletado em " + esc(L.fmtDataHora(lev.coletado_em)) + "</p>" +
      '<div class="destaque-indices">' +
      '<div class="indice-grande"><div class="rot">IIP · Índice de Infestação Predial</div><div class="val">' + esc(L.fmtPct(c.iip)) + "</div>" + L.selo("iip", c.iip) + "</div>" +
      '<div class="indice-grande sec"><div class="rot">IB · Índice de Breteau</div><div class="val">' + esc(L.fmtDec(c.ib)) + "</div></div>" +
      "</div></div>" +
      '<div class="destaque-lado"><dl class="mini-lista">' +
      "<dt>Imóveis pesquisados</dt><dd>" + L.fmtInt(c.pesq) + "</dd>" +
      "<dt>Imóveis positivos</dt><dd>" + L.fmtInt(c.pos) + "</dd>" +
      "<dt>Depósitos positivos</dt><dd>" + L.fmtInt(c.dep) + "</dd>" +
      "<dt>Tubitos (focos)</dt><dd>" + L.fmtInt(c.tub) + "</dd>" +
      (anterior ? '<dd class="sep"></dd><dt>IIP vs ' + esc(anterior.nome) + "</dt><dd>" + L.delta(dIip, "p.p.") + "</dd>" +
        "<dt>IB vs " + esc(anterior.nome) + "</dt><dd>" + L.delta(dIb, "") + "</dd>" : "") + "</dl>" +
      (opts.acoes ? '<div class="acoes" style="margin-top:20px"><a class="btn primario" href="levantamento.html?id=' + esc(lev.chave) + '">Ver detalhes</a>' +
        '<a class="btn" href="dashboard.html">Dashboard</a></div>' : "") + "</div></div>" +
      '<div class="destaque-regua">' + L.regua("iip", c.iip) + "</div></div>";
  }

  /* ---- cards por estrato (neutros: só os números) ---- */
  function cardsEstratos(el, lev) {
    if (!lev || !lev.estratos) { el.innerHTML = ""; return; }
    el.innerHTML = Object.keys(lev.estratos).map(function (nome) {
      var c = L.calc(lev.estratos[nome].total);
      return '<article class="card estrato-card"><h3>' + esc(nome) + '</h3><div class="v">' + esc(L.fmtPct(c.iip)) + '</div>' +
        '<div class="l">IIP · IB ' + esc(L.fmtDec(c.ib)) + "</div>" +
        '<div class="l" style="margin-top:10px">' + L.fmtInt(c.pos) + " positivos em " + L.fmtInt(c.pesq) + " pesquisados</div></article>";
    }).join("");
  }

  /* ---- ranking de bairros ---- */
  // opts: {filtro:{estrato,codigo}, comparado: lev|null, limite: n|0}
  function ranking(el, lev, opts) {
    opts = opts || {};
    var f = opts.filtro || {};
    var itens = L.areasDe(lev).filter(function (a) {
      return (!f.estrato || a.estrato === f.estrato) && (!f.codigo || a.codigo === f.codigo);
    }).map(function (a) {
      var c = L.calc(a.dados), ant = null;
      if (opts.comparado) {
        var m = L.areasDe(opts.comparado).filter(function (b) { return b.codigo === a.codigo; })[0];
        if (m) ant = L.calc(m.dados);
      }
      return { a: a, c: c, ant: ant };
    });
    itens.sort(function (x, y) {
      var xi = x.c.iip == null ? -1 : x.c.iip, yi = y.c.iip == null ? -1 : y.c.iip;
      return (yi - xi) || (y.c.pos - x.c.pos) || x.a.nome.localeCompare(y.a.nome, "pt-BR");
    });
    var total = itens.length;
    if (opts.limite) itens = itens.slice(0, opts.limite);
    if (!itens.length) { el.innerHTML = '<div class="vazio"><strong>Nenhum bairro neste filtro</strong>Ajuste os filtros para ver o ranking.</div>'; return total; }
    var max = Math.max.apply(null, itens.map(function (i) { return i.c.iip || 0; })) || 1;
    el.innerHTML = '<ol class="ranking">' + itens.map(function (it, i) {
      var cl = L.classificar("iip", it.c.iip);
      var d = it.ant && it.ant.iip != null && it.c.iip != null ? L.variacao(it.c.iip, it.ant.iip) : null;
      return '<li class="rank-item' + (opts.destaque && opts.destaque === it.a.codigo ? " destaque" : "") + '"><span class="rank-pos">' + (i + 1) + "</span>" +
        '<div class="rank-nome">' + esc(it.a.nome) + "<small>" + esc(it.a.estrato) + " · cód. " + esc(it.a.codigo) + "</small></div>" +
        '<div class="rank-barra" role="img" aria-label="IIP ' + esc(L.fmtPct(it.c.iip)) + '"><i class="' + (opts.limpo ? "" : (cl ? cl.id : "")) + '" style="width:' + Math.max(0, ((it.c.iip || 0) / max) * 100).toFixed(1) + '%"></i></div>' +
        '<div class="rank-valor"><span class="l1"><b>' + esc(L.fmtPct(it.c.iip)) + "</b>" + (opts.limpo ? "" : L.selo("iip", it.c.iip)) + "</span>" +
        "<small>" + L.fmtInt(it.c.pos) + " positivos em " + L.fmtInt(it.c.pesq) + " pesquisados" + (d ? " · " + L.delta(d, "p.p.") : "") + "</small></div></li>";
    }).join("") + "</ol>";
    return total;
  }

  /* ---- principais criadouros ---- */
  function criadouros(el, c) {
    if (!c) { el.innerHTML = '<div class="vazio"><strong>Sem dados</strong></div>'; return; }
    var soma = 0, max = 0;
    L.TIPOS.forEach(function (k) { soma += c.tipos[k]; max = Math.max(max, c.tipos[k]); });
    if (!soma) { el.innerHTML = '<div class="vazio"><strong>Nenhum depósito positivo</strong>Não houve depósito com Aedes aegypti neste recorte.</div>'; return; }
    var ordem = L.TIPOS.slice().sort(function (a, b) { return c.tipos[b] - c.tipos[a] || L.TIPOS.indexOf(a) - L.TIPOS.indexOf(b); });
    el.innerHTML = ordem.map(function (k, i) {
      var v = c.tipos[k], d = L.DESC_TIPOS[k];
      return '<div class="criadouro' + (i === 0 && v > 0 ? " lider" : "") + '"><span class="cod">' + k + "</span>" +
        '<div class="desc">' + esc(d[0]) + "<small>" + esc(d[1]) + "</small></div>" +
        '<div class="barra" role="img" aria-label="' + v + ' depósitos"><i style="width:' + (max ? (v / max) * 100 : 0).toFixed(1) + '%"></i></div>' +
        '<div class="num"><b>' + L.fmtInt(v) + "</b> <small>" + L.fmtDec((v / soma) * 100, 1) + "%</small></div></div>";
    }).join("");
  }

  /* ---- aviso de dados ausentes ---- */
  function avisoAusentes(el, lev) {
    if (!lev || !lev.ausentes || !lev.ausentes.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="aviso">' + L.ICO.info + "<div><strong>Informações ausentes ou estimadas neste levantamento</strong><ul>" +
      lev.ausentes.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") +
      (lev.periodo_origem && lev.periodo_origem !== "data da coleta" ? "<li>Período (" + esc(L.fmtPeriodo(lev.periodo)) + ") estimado a partir do ID da semana do eVisita.</li>" : "") +
      "</ul></div></div>";
  }

  /* ---- gráfico de evolução IIP + IB (linhas, um único eixo "por 100 imóveis") ---- */
  function graficoEvolucao(canvasId, levs, filtro, opts) {
    opts = opts || {};
    var pts = levs.map(function (l) { return { l: l, c: L.agregar(l, filtro) }; });
    var labels = pts.map(function (p) { return p.l.nome; });
    function r2(v) { return v == null ? null : Math.round((v + 1e-12) * 100) / 100; }
    var iip = pts.map(function (p) { return p.c ? r2(p.c.iip) : null; });
    var ib = pts.map(function (p) { return p.c ? r2(p.c.ib) : null; });
    var base = L.opcoesBase();
    var s1 = L.css("--serie-1"), s2 = L.css("--serie-2"), surf = L.css("--surface");
    // IB desenhado atrás, mais grosso: continua visível quando coincide com o IIP
    function ds(nome, data, cor, ib) {
      return { label: nome, data: data, borderColor: cor, backgroundColor: cor, borderWidth: ib ? 7 : 3, tension: 0.25, spanGaps: true, order: ib ? 1 : 0,
        pointRadius: ib ? 9 : 5, pointHoverRadius: ib ? 11 : 8, pointBackgroundColor: ib ? surf : cor, pointBorderColor: ib ? cor : surf,
        pointBorderWidth: ib ? 3 : 2, borderDash: [] };
    }
    base.plugins.faixasRisco = { indice: "iip" };
    base.plugins.rotuloFinal = { ativo: opts.rotulos !== false };
    base.plugins.tooltip.callbacks = {
      title: function (it) { var p = pts[it[0].dataIndex]; return p.l.nome + " · " + p.l.semana_exibicao.rotulo; },
      label: function (ctx) {
        var c = L.classificar(ctx.datasetIndex === 0 ? "iip" : "ib", ctx.parsed.y);
        return " " + ctx.dataset.label + ": " + L.fmtDec(ctx.parsed.y) + (ctx.datasetIndex === 0 ? "%" : "") + (c ? " — " + c.rotulo : "");
      }
    };
    base.interaction = { mode: "index", intersect: false };
    base.scales.y.title = { display: true, text: opts.soIip ? "% de imóveis positivos" : "por 100 imóveis pesquisados", color: L.css("--muted") };
    base.scales.y.suggestedMax = 4.5;
    base.layout = { padding: { top: 16, right: 18 } };
    var conjuntos = opts.soIip ? [ds("IIP (%)", iip, s1)] : [ds("IIP (%)", iip, s1), ds("IB", ib, s2, true)];
    return L.criarGrafico(canvasId, { type: "line", data: { labels: labels, datasets: conjuntos }, options: base });
  }

  global.LIRA_W = { destaque: destaque, cardsEstratos: cardsEstratos, ranking: ranking, criadouros: criadouros, avisoAusentes: avisoAusentes, graficoEvolucao: graficoEvolucao };
})(window);
