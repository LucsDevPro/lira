(function () {
  "use strict";
  var L = window.LIRA, W = window.LIRA_W, esc = L.esc;
  L.montarChrome("dashboard");
  L.configurarChartJS();

  function $(id) { return document.getElementById(id); }
  function r2(v) { return v == null ? null : Math.round((v + 1e-12) * 100) / 100; }

  /* rótulos de valor nas barras (poucas barras: ok rotular) */
  Chart.register({
    id: "rotuloBarras",
    afterDatasetsDraw: function (chart, _a, opt) {
      if (!opt || !opt.fmt) return;
      var ctx = chart.ctx;
      chart.data.datasets.forEach(function (ds, i) {
        chart.getDatasetMeta(i).data.forEach(function (bar, k) {
          var v = ds.data[k];
          if (v == null) return;
          ctx.save();
          ctx.font = "700 11.5px 'Plus Jakarta Sans', sans-serif"; ctx.fillStyle = L.css("--ink"); ctx.textAlign = "center";
          var neg = v < 0;
          ctx.fillText(opt.fmt(v), bar.x, neg ? bar.y + 14 : bar.y - 5);
          ctx.restore();
        });
      });
    }
  });

  var S = { foco: "", comp: "auto", estrato: "", bairro: "", de: "", ate: "", todos: false, tabela: false, aba: "lev", sort: {} };
  var ALL = L.levantamentos, COM = L.comDados;

  /* ---------- listas para os filtros ---------- */
  var ESTRATOS = COM.length ? Object.keys(COM[COM.length - 1].estratos) : [];
  var BAIRROS = {}; // codigo -> {nome, estrato}
  COM.forEach(function (l) { L.areasDe(l).forEach(function (a) { if (!BAIRROS[a.codigo]) BAIRROS[a.codigo] = { nome: a.nome, estrato: a.estrato }; }); });

  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(t) + "</option>"; }

  function montarFiltrosFixos() {
    $("fEstrato").innerHTML = opt("", "Todos os estratos", true) + ESTRATOS.map(function (e) { return opt(e, e); }).join("");
  }
  function montarBairros() {
    var atual = S.bairro;
    var h = opt("", "Todos os bairros", !atual);
    Object.keys(BAIRROS).sort(function (a, b) { return a - b; }).forEach(function (c) {
      if (S.estrato && BAIRROS[c].estrato !== S.estrato) return;
      h += opt(c, c + " · " + BAIRROS[c].nome, c === atual);
    });
    $("fBairro").innerHTML = h;
  }

  function montarComp(vis, focoChave) {
    if (S.comp === focoChave) S.comp = "auto";
    $("fComp").innerHTML = opt("auto", "Automático (levantamento anterior)", S.comp === "auto") + opt("none", "Nenhum", S.comp === "none") +
      vis.filter(function (l) { return l.chave !== focoChave; }).reverse().map(function (l) { return opt(l.chave, l.nome, S.comp === l.chave); }).join("");
  }

  /* ---------- filtro ---------- */
  function noFiltro() { return true; }   // sem filtro de período: o mês escolhido já define o levantamento
  function F() { return { estrato: S.estrato || null, codigo: S.bairro || null }; }
  function escopoTexto() {
    var p = [];
    if (S.bairro) p.push("bairro " + BAIRROS[S.bairro].nome);
    if (S.estrato) p.push(S.estrato);
    return p.length ? p.join(" · ") : "município (total geral)";
  }

  /* ---------- tabela ordenável genérica ---------- */
  function tabela(el, cols, linhas, chaveSort, fixas) {
    var st = S.sort[chaveSort] || {};
    var rows = linhas.slice();
    if (st.k != null) {
      var col = cols[st.k];
      rows.sort(function (a, b) {
        var x = col.v(a), y = col.v(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        var c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
        return st.dir === "desc" ? -c : c;
      });
    }
    var h = '<table class="dados"><thead><tr>' + cols.map(function (c, i) {
      var sort = st.k === i ? (st.dir === "desc" ? "descending" : "ascending") : "none";
      return '<th scope="col" tabindex="0" data-i="' + i + '" aria-sort="' + sort + '"' + (c.esq ? ' class="esq"' : "") + ">" + c.t + "</th>";
    }).join("") + "</tr></thead><tbody>";
    (fixas || []).concat(rows).forEach(function (r) {
      h += "<tr" + (r.__cls ? ' class="' + r.__cls + '"' : "") + ">" + cols.map(function (c) { return '<td' + (c.esq ? ' class="esq"' : "") + ">" + c.h(r) + "</td>"; }).join("") + "</tr>";
    });
    h += "</tbody></table>";
    el.innerHTML = h;
    function ordenar(i) {
      var cur = S.sort[chaveSort] || {};
      S.sort[chaveSort] = { k: i, dir: cur.k === i && cur.dir !== "desc" ? "desc" : "asc" };
      tabela(el, cols, linhas, chaveSort, fixas);
    }
    el.querySelectorAll("th").forEach(function (th) {
      th.addEventListener("click", function () { ordenar(+th.getAttribute("data-i")); });
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ordenar(+th.getAttribute("data-i")); } });
    });
  }

  var CSV_ATUAL = null;

  /* ---------- atualização geral ---------- */
  function atualizar() {
    S.estrato = $("fEstrato").value; S.bairro = $("fBairro").value;
    if (S.bairro && S.estrato && BAIRROS[S.bairro].estrato !== S.estrato) { S.bairro = ""; }
    montarBairros();

    var visTodos = ALL.filter(noFiltro);
    var vis = visTodos.filter(function (l) { return l.status === "com_dados"; });
    var f = F();

    $("contagem").textContent = vis.length + " de " + COM.length + " levantamento(s) com dados" +
      (visTodos.length - vis.length ? " · " + (visTodos.length - vis.length) + " sem dados" : "");
    chips();

    $("semResultado").hidden = vis.length > 0;
    $("painel").hidden = vis.length === 0;

    var foco = null, comp = null;
    if (vis.length) {
      var padrao = L.principal().lev;
      foco = vis.filter(function (l) { return l.chave === S.foco; })[0] || (vis.indexOf(padrao) >= 0 ? padrao : vis[vis.length - 1]);
      S.foco = foco.chave;
      var idx = vis.indexOf(foco);
      if (S.comp === "none") comp = null;
      else {
        comp = vis.filter(function (l) { return l.chave === S.comp && l !== foco; })[0] || null;
        if (!comp && S.comp === "auto") comp = vis[idx - 1] || null;
        if (!comp && S.comp !== "auto" && S.comp !== "none") { S.comp = "auto"; comp = vis[idx - 1] || null; }
      }
      $("fFoco").innerHTML = vis.slice().reverse().map(function (l) { return opt(l.chave, l.nome + " · " + l.semana_exibicao.rotulo, l === foco); }).join("");
      montarComp(vis, foco.chave);
      try {
        renderPainel(vis, foco, comp, f, visTodos);
        $("erroPainel").hidden = true;
      } catch (e) {
        if (window.console) console.error("Erro ao montar o painel:", e);
        $("erroPainel").hidden = false;
        $("erroPainel").querySelector("code").textContent = (e && e.message) || String(e);
      }
    } else {
      $("fFoco").innerHTML = opt("", "—"); $("fComp").innerHTML = opt("", "—");
    }
    renderHistorico(visTodos, vis, foco, comp, f);
  }

  function chips() {
    var c = [];
    function add(txt, limpar) { c.push('<span class="chip-filtro">' + esc(txt) + '<button type="button" aria-label="Remover filtro ' + esc(txt) + '" data-limpar="' + limpar + '">×</button></span>'); }
    if (S.estrato) add(S.estrato, "estrato");
    if (S.bairro) add("Bairro: " + BAIRROS[S.bairro].nome, "bairro");
    $("chips").innerHTML = c.join("") || '<span class="contagem">Nenhum filtro ativo</span>';
    $("chips").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = { estrato: "fEstrato", bairro: "fBairro" }[b.getAttribute("data-limpar")];
        $(m).value = ""; atualizar();
      });
    });
  }

  /* ---------- painel ---------- */
  function deltaNum(v, rot) {
    if (!v) return '<span class="delta igual">' + L.ICO.igual + "sem comparação</span>";
    var ic = v.abs === 0 ? L.ICO.igual : v.abs > 0 ? L.ICO.mais : L.ICO.menos;
    return '<span class="delta igual">' + ic + esc(L.fmtSinal(v.abs, 0)) + (rot ? " " + esc(rot) : "") + "</span>";
  }

  function renderPainel(vis, foco, comp, f, visTodos) {
    var c = L.agregar(foco, f), cp = comp ? L.agregar(comp, f) : null;
    var escopo = escopoTexto();
    $("subResumo").textContent = foco.nome + " · " + foco.semana_exibicao.rotulo + " · " + escopo + (comp ? " · comparado a " + comp.nome : "");
    if (!c) {
      $("kpis").innerHTML = '<div class="card span-2"><div class="vazio"><strong>Bairro sem registro neste levantamento</strong>O bairro selecionado não consta em ' + esc(foco.nome) + ".</div></div>";
    } else {
      var dI = cp ? L.variacao(c.iip, cp.iip) : null, dB = cp ? L.variacao(c.ib, cp.ib) : null;
      var rot = comp ? "vs " + comp.nome : "";
      function kpi(t, v, extra, sub) { return '<article class="card kpi"><div class="rot">' + t + '</div><div class="val">' + v + "</div>" + (extra || "") + (sub ? '<div class="sub">' + sub + "</div>" : "") + "</article>"; }
      $("kpis").innerHTML =
        kpi("IIP · Infestação Predial", esc(L.fmtPct(c.iip)), '<div style="margin-top:6px">' + L.selo("iip", c.iip) + "</div>", cp ? L.delta(dI, "p.p. " + rot, 2) : "") +
        kpi("IB · Índice de Breteau", esc(L.fmtDec(c.ib)), "", cp ? L.delta(dB, rot, 2) : "") +
        kpi("Imóveis pesquisados", L.fmtInt(c.pesq), "", cp ? deltaNum(L.variacao(c.pesq, cp.pesq), rot) : "") +
        kpi("Imóveis positivos", L.fmtInt(c.pos), "", cp ? L.delta(L.variacao(c.pos, cp.pos), rot, 0) : "") +
        kpi("Depósitos positivos", L.fmtInt(c.dep), "", cp ? L.delta(L.variacao(c.dep, cp.dep), rot, 0) : "") +
        kpi("Tubitos (focos)", L.fmtInt(c.tub), "", cp ? deltaNum(L.variacao(c.tub, cp.tub), rot) : "");
    }

    $("subClass").textContent = c ? foco.nome + " · " + escopo : "";
    $("legendas").innerHTML = '<div class="card span-2">' + L.regua("iip", c ? c.iip : null) + "</div>" +
      (S.estrato || S.bairro ? '<div class="aviso span-2">' + L.ICO.info + "<div>A classificação mostrada vale para o recorte filtrado (" + esc(escopo) + "). As faixas oficiais do Ministério da Saúde são definidas para o município; use este recorte como apoio à análise.</div></div>" : "");

    /* evolução */
    function evol() {
      $("boxEvol").hidden = S.tabela; $("tabEvol").hidden = !S.tabela;
      $("vGrafico").setAttribute("aria-pressed", String(!S.tabela)); $("vTabela").setAttribute("aria-pressed", String(S.tabela));
      if (S.tabela) {
        L.destruirGrafico("gEvolucao");
        $("tabEvol").innerHTML = '<table class="dados"><thead><tr><th class="esq">Levantamento</th><th>Pesquisados</th><th>Positivos</th><th>IIP</th><th>Classificação IIP</th><th>IB</th></tr></thead><tbody>' +
          vis.map(function (l) {
            var x = L.agregar(l, f);
            return x ? "<tr><td>" + esc(l.nome) + "</td><td>" + L.fmtInt(x.pesq) + "</td><td>" + L.fmtInt(x.pos) + "</td><td>" + L.fmtPct(x.iip) + "</td><td>" + L.selo("iip", x.iip) + "</td><td>" + L.fmtDec(x.ib) + "</td></tr>"
              : "<tr><td>" + esc(l.nome) + '</td><td colspan="5">Bairro sem registro</td></tr>';
          }).join("") + "</tbody></table>";
      } else {
        W.graficoEvolucao("gEvolucao", visTodos, f);
      }
    }
    evol(); S.evol = evol;

    /* variação consecutiva */
    var base = L.opcoesBase();
    if (vis.length < 2) {
      L.destruirGrafico("gVariacao");
      $("gVariacao").parentNode.hidden = true;
      $("vazioVar").innerHTML = '<div class="vazio"><strong>Só há um levantamento neste filtro</strong>A variação aparece quando houver dois ou mais.</div>';
    } else {
      $("gVariacao").parentNode.hidden = false; $("vazioVar").innerHTML = "";
      var labels = [], vals = [], cores = [];
      for (var i = 1; i < vis.length; i++) {
        var a = L.agregar(vis[i - 1], f), b = L.agregar(vis[i], f);
        labels.push(vis[i - 1].nome.split("/")[0] + " → " + vis[i].nome.split("/")[0] + "/" + vis[i].nome.split("/")[1].slice(2));
        var d = a && b ? r2(b.iip - a.iip) : null; vals.push(d);
        cores.push(d == null ? L.css("--line-strong") : d > 0 ? L.css("--risk-alto") : d < 0 ? L.css("--risk-baixo") : L.css("--muted"));
      }
      base.plugins.rotuloBarras = { fmt: function (v) { return L.fmtSinal(v, 2); } };
      base.plugins.tooltip.callbacks = { label: function (ctx) { return " " + L.fmtSinal(ctx.parsed.y, 2) + " p.p. no IIP" + (ctx.parsed.y > 0 ? " (piora)" : ctx.parsed.y < 0 ? " (melhora)" : ""); } };
      base.scales.y.beginAtZero = true; base.scales.y.grace = "20%";
      base.scales.y.ticks.callback = function (v) { return L.fmtSinal(v, 1); };
      base.layout = { padding: { top: 18 } };
      L.criarGrafico("gVariacao", { type: "bar", data: { labels: labels, datasets: [{ label: "Δ IIP (p.p.)", data: vals, backgroundColor: cores, borderRadius: 4, maxBarThickness: 56 }] }, options: base });
    }

    /* comparação por estrato */
    var nomes = ["Geral"].concat(Object.keys(foco.estratos));
    function seriesDe(l) { return nomes.map(function (n) { var t = n === "Geral" ? l.total_geral : (l.estratos[n] ? l.estratos[n].total : null); return t ? r2(L.calc(t).iip) : null; }); }
    var g = L.opcoesBase();
    var ds = [{ label: foco.nome, data: seriesDe(foco), backgroundColor: L.css("--serie-1"), borderRadius: 4, maxBarThickness: 36 }];
    if (comp) ds.push({ label: comp.nome, data: seriesDe(comp), backgroundColor: L.css("--serie-2"), borderRadius: 4, maxBarThickness: 36 });
    g.plugins.rotuloBarras = { fmt: function (v) { return L.fmtDec(v, 2); } };
    g.plugins.tooltip.callbacks = { label: function (ctx) { var cl = L.classificar("iip", ctx.parsed.y); return " " + ctx.dataset.label + ": " + L.fmtPct(ctx.parsed.y) + (cl ? " — " + cl.rotulo : ""); } };
    g.layout = { padding: { top: 18 } };
    g.scales.y.suggestedMax = 4.5;
    g.scales.y.ticks.callback = function (v) { return v + "%"; };
    L.criarGrafico("gComp", { type: "bar", data: { labels: nomes, datasets: ds }, options: g });
    $("legGrupo").innerHTML = '<span><i style="background:var(--serie-1)"></i>' + esc(foco.nome) + "</span>" + (comp ? '<span><i style="background:var(--serie-2)"></i>' + esc(comp.nome) + "</span>" : "");
    $("subGrupo").textContent = comp ? foco.nome + " × " + comp.nome + ". O filtro de estrato/bairro não se aplica a este gráfico." : "Escolha um levantamento em “Comparar com” para ver os dois lado a lado.";
    $("subComp").textContent = comp ? foco.nome + " comparado a " + comp.nome + " (" + escopo + ")" : "Sem levantamento de comparação";

    /* tabela comparativa (agrupada, com variação em uma coluna só) */
    if (c) {
      function linha(nome, fmt, key, extra, dec, un) {
        return { nome: nome, a: fmt(c[key]) + (extra ? " " + extra(c) : ""), b: cp ? fmt(cp[key]) + (extra ? " " + extra(cp) : "") : null, v: cp ? L.variacao(c[key], cp[key]) : null, un: un || "", dec: dec };
      }
      var iipSelo = function (x) { return '<div class="sel-linha">' + L.selo("iip", x.iip) + "</div>"; };
      var grupos = [
        { t: "Índices", l: [linha("IIP · Índice de Infestação Predial", L.fmtPct, "iip", iipSelo, 2, "p.p."), linha("IB · Índice de Breteau", L.fmtDec, "ib", null, 2)] },
        { t: "Imóveis", l: [linha("Imóveis pesquisados", L.fmtInt, "pesq", null, 0), linha("Imóveis positivos", L.fmtInt, "pos", null, 0)] },
        { t: "Depósitos e focos", l: [linha("Depósitos positivos", L.fmtInt, "dep", null, 0), linha("Tubitos (focos)", L.fmtInt, "tub", null, 0), linha("Imóveis com Ae. albopictus", L.fmtInt, "alb", null, 0)] }
      ];
      var cab = "<thead><tr><th>Indicador</th><th class=\"num\">" + esc(foco.nome) + "</th>" + (comp ? "<th class=\"num\">" + esc(comp.nome) + "</th><th class=\"num\">Variação</th>" : "") + "</tr></thead>";
      $("tabComp").innerHTML = '<table class="dados comp">' + cab + grupos.map(function (g) {
        return '<tbody><tr class="grupo"><th colspan="' + (comp ? 4 : 2) + '">' + esc(g.t) + "</th></tr>" + g.l.map(function (r) {
          var pct = r.v && r.v.pct != null ? ' <small class="pct">(' + esc(L.fmtSinal(r.v.pct, 1)) + "%)</small>" : "";
          return "<tr><td>" + esc(r.nome) + '</td><td class="num">' + r.a + "</td>" + (comp ? '<td class="num">' + (r.b == null ? "—" : r.b) + '</td><td class="num">' + (r.v ? L.delta(r.v, r.un, r.dec) + pct : "—") + "</td>" : "") + "</tr>";
        }).join("") + "</tbody>";
      }).join("") + "</table>";
    } else $("tabComp").innerHTML = "";

    /* imóveis pesquisados e positivos */
    function colunas(id, campo, cor) {
      var o = L.opcoesBase();
      o.plugins.rotuloBarras = { fmt: function (v) { return L.fmtInt(v); } };
      o.plugins.tooltip.callbacks = { title: function (it) { return vis[it[0].dataIndex].nome + " · " + vis[it[0].dataIndex].semana_exibicao.rotulo; } };
      o.layout = { padding: { top: 18 } };
      o.scales.y.ticks.precision = 0;
      L.criarGrafico(id, { type: "bar", data: { labels: vis.map(function (l) { return l.nome; }), datasets: [{ label: campo.rot, data: vis.map(function (l) { var x = L.agregar(l, f); return x ? x[campo.k] : null; }), backgroundColor: L.css(cor), borderRadius: 4, maxBarThickness: 56 }] }, options: o });
    }
    colunas("gPesq", { k: "pesq", rot: "Imóveis pesquisados" }, "--seq-3");
    colunas("gPos", { k: "pos", rot: "Imóveis positivos" }, "--serie-3");

    /* ranking */
    $("subRank").textContent = foco.nome + (S.estrato ? " · " + S.estrato : "") + (comp ? " · variação vs " + comp.nome : "");
    var total = W.ranking($("listaRanking"), foco, { filtro: { estrato: S.estrato || null }, comparado: comp, limite: S.todos ? 0 : 10, destaque: S.bairro });
    $("rTop").setAttribute("aria-pressed", String(!S.todos)); $("rTodos").setAttribute("aria-pressed", String(S.todos));
    $("rTop").textContent = "Top 10"; $("rTodos").textContent = "Todos (" + total + ")";

    /* criadouros */
    $("tCriFoco").textContent = foco.nome + " · " + escopo;
    W.criadouros($("listaCriadouros"), c);
    var cs = vis.map(function (l) { return L.agregar(l, f); });
    var max = 1; cs.forEach(function (x) { if (x) L.TIPOS.forEach(function (k) { max = Math.max(max, x.tipos[k]); }); });
    $("tabCriadouros").innerHTML = '<table class="dados heat"><thead><tr><th>Tipo</th>' + vis.map(function (l) { return "<th>" + esc(l.nome) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      L.TIPOS.map(function (k) {
        return "<tr><td title=\"" + esc(L.DESC_TIPOS[k][0] + " (" + L.DESC_TIPOS[k][1] + ")") + "\"><b>" + k + "</b> " + esc(L.DESC_TIPOS[k][0]) + "</td>" + cs.map(function (x) {
          if (!x) return '<td class="heat-cel">—</td>';
          var v = x.tipos[k], pct = Math.round((v / max) * 70);
          return '<td class="heat-cel' + (v ? "" : " zero") + '" style="background:' + (v ? "color-mix(in srgb, var(--serie-1) " + pct + "%, transparent)" : "transparent") + '">' + v + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      '<tr class="total"><td>Total de depósitos</td>' + cs.map(function (x) { return '<td class="heat-cel">' + (x ? x.dep : "—") + "</td>"; }).join("") + "</tr></tbody></table>";
  }

  /* ---------- tabela histórica ---------- */
  function renderHistorico(visTodos, vis, foco, comp, f) {
    $("subHist").textContent = "Todos os levantamentos do filtro (" + escopoTexto() + "), inclusive os ainda sem dados.";
    $("tabLev").setAttribute("aria-selected", String(S.aba === "lev")); $("tabBai").setAttribute("aria-selected", String(S.aba === "bai"));
    var prevCom = {}; // chave -> levantamento anterior com dados (dentro do filtro)
    vis.forEach(function (l, i) { prevCom[l.chave] = vis[i - 1] || null; });

    if (S.aba === "lev") {
      var linhas = visTodos.map(function (l) {
        var c = L.agregar(l, f), p = prevCom[l.chave] ? L.agregar(prevCom[l.chave], f) : null;
        return { l: l, c: c, dI: c && p ? L.variacao(c.iip, p.iip) : null, dB: c && p ? L.variacao(c.ib, p.ib) : null, __cls: l.status === "sem_dados" ? "sem-dados" : "" };
      });
      function num(get) { return { v: function (r) { return r.c ? get(r.c) : null; }, h: function (r) { return r.c ? L.fmtInt(get(r.c)) : "—"; }, tx: function (r) { return r.c ? get(r.c) : ""; } }; }
      var cols = [
        { t: "Levantamento", esq: true, v: function (r) { return r.l.semana_inicio * 1; }, h: function (r) { return '<a href="levantamento.html?id=' + esc(r.l.chave) + '"><b>' + esc(r.l.nome) + "</b></a>" + (r.l.status === "sem_dados" ? ' <span class="selo neutro mini">Sem dados</span>' : ""); }, tx: function (r) { return r.l.nome + (r.l.status === "sem_dados" ? " (sem dados)" : ""); } },
        { t: "SE", esq: true, v: function (r) { return r.l.semana_exibicao.rotulo; }, h: function (r) { return esc(r.l.semana_exibicao.rotulo); }, tx: function (r) { return r.l.semana_exibicao.rotulo; } },
        { t: "Coletado em", v: function (r) { return r.l.coletado_em; }, h: function (r) { return r.l.coletado_em ? esc(L.fmtDataHora(r.l.coletado_em)) : "—"; }, tx: function (r) { return r.l.coletado_em ? L.fmtDataHora(r.l.coletado_em) : ""; } },
        Object.assign({ t: "Pesquisados" }, num(function (c) { return c.pesq; })),
        Object.assign({ t: "Positivos" }, num(function (c) { return c.pos; })),
        Object.assign({ t: "Dep. positivos" }, num(function (c) { return c.dep; })),
        { t: "IIP", v: function (r) { return r.c ? r.c.iip : null; }, h: function (r) { return r.c ? '<span class="cel-iip">' + esc(L.fmtPct(r.c.iip)) + "</span>" : "—"; }, tx: function (r) { return r.c ? L.fmtDec(r.c.iip) : ""; } },
        { t: "Classe IIP", esq: true, v: function (r) { return r.c ? r.c.iip : null; }, h: function (r) { return r.c ? L.selo("iip", r.c.iip) : "—"; }, tx: function (r) { var k = r.c && L.classificar("iip", r.c.iip); return k ? k.rotulo : ""; } },
        { t: "Δ IIP (p.p.)", v: function (r) { return r.dI ? r.dI.abs : null; }, h: function (r) { return r.dI ? L.delta(r.dI, "", 2) : "—"; }, tx: function (r) { return r.dI ? L.fmtSinal(r.dI.abs, 2) : ""; } },
        { t: "IB", v: function (r) { return r.c ? r.c.ib : null; }, h: function (r) { return r.c ? '<span class="cel-iip">' + esc(L.fmtDec(r.c.ib)) + "</span>" : "—"; }, tx: function (r) { return r.c ? L.fmtDec(r.c.ib) : ""; } },
        { t: "Δ IB", v: function (r) { return r.dB ? r.dB.abs : null; }, h: function (r) { return r.dB ? L.delta(r.dB, "", 2) : "—"; }, tx: function (r) { return r.dB ? L.fmtSinal(r.dB.abs, 2) : ""; } },
        Object.assign({ t: "Tubitos" }, num(function (c) { return c.tub; }))
      ];
      L.TIPOS.forEach(function (k) { cols.push(Object.assign({ t: '<abbr title="' + esc(L.DESC_TIPOS[k][0] + " — " + L.DESC_TIPOS[k][1]) + '">' + k + "</abbr>" }, num(function (c) { return c.tipos[k]; }))); });
      cols.push(Object.assign({ t: "Imóveis c/ albopictus" }, num(function (c) { return c.alb; })));
      tabela($("tabHist"), cols, linhas, "lev");
      $("notaHist").innerHTML = "* período estimado a partir do ID da semana do eVisita · n/i = não informado · Δ = diferença para o levantamento anterior com dados dentro do filtro. Deslize a tabela para o lado para ver todas as colunas.";
      CSV_ATUAL = { nome: "lira-historico-levantamentos.csv", cab: cols.map(function (c) { return c.t.replace(/<[^>]+>/g, ""); }), linhas: linhas.map(function (r) { return cols.map(function (c) { return c.tx(r); }); }) };
    } else {
      // por bairro
      var codigos = Object.keys(BAIRROS).filter(function (cd) { return (!S.estrato || BAIRROS[cd].estrato === S.estrato) && (!S.bairro || cd === S.bairro); }).sort(function (a, b) { return a - b; });
      var porLev = vis.map(function (l) { var m = {}; L.areasDe(l).forEach(function (a) { m[a.codigo] = L.calc(a.dados); }); return m; });
      var ult = vis.length - 1;
      var linhasB = codigos.map(function (cd) {
        var vals = porLev.map(function (m) { return m[cd] || null; });
        var fi = foco ? vis.indexOf(foco) : -1, ci = comp ? vis.indexOf(comp) : -1;
        var d = fi >= 0 && ci >= 0 && vals[fi] && vals[ci] ? L.variacao(vals[fi].iip, vals[ci].iip) : null;
        return { cd: cd, b: BAIRROS[cd], vals: vals, d: d };
      });
      var fixa = { __cls: "total", cd: "", b: { nome: "Município (total geral)", estrato: "" }, tot: vis.map(function (l) { return L.calc(l.total_geral); }), d: foco && comp ? L.variacao(L.calc(foco.total_geral).iip, L.calc(comp.total_geral).iip) : null };
      function celula(c) { return c ? '<span class="celula-bairro"><span class="selo mini ' + L.classificar("iip", c.iip).id + '" title="' + esc(L.classificar("iip", c.iip).rotulo) + '">' + L.ICONES[L.classificar("iip", c.iip).id] + esc(L.fmtPct(c.iip)) + "</span><small>" + c.pos + " em " + c.pesq + "</small></span>" : "—"; }
      var colsB = [
        { t: "Bairro", esq: true, v: function (r) { return r.b.nome; }, h: function (r) { return "<b>" + esc(r.b.nome) + "</b>" + (r.cd ? ' <small style="color:var(--muted)">cód. ' + esc(r.cd) + "</small>" : ""); }, tx: function (r) { return r.b.nome + (r.cd ? " (" + r.cd + ")" : ""); } },
        { t: "Estrato", esq: true, v: function (r) { return r.b.estrato; }, h: function (r) { return esc(r.b.estrato); }, tx: function (r) { return r.b.estrato; } }
      ];
      vis.forEach(function (l, i) {
        colsB.push({ t: esc(l.nome), v: function (r) { var c = r.tot ? r.tot[i] : r.vals[i]; return c ? c.iip : null; }, h: function (r) { return celula(r.tot ? r.tot[i] : r.vals[i]); }, tx: function (r) { var c = r.tot ? r.tot[i] : r.vals[i]; return c ? L.fmtDec(c.iip) + "%" : ""; } });
      });
      colsB.push({ t: foco && comp ? "Δ " + esc(foco.nome.split("/")[0]) + " vs " + esc(comp.nome.split("/")[0]) : "Δ", v: function (r) { return r.d ? r.d.abs : null; }, h: function (r) { return r.d ? L.delta(r.d, "p.p.", 2) : "—"; }, tx: function (r) { return r.d ? L.fmtSinal(r.d.abs, 2) : ""; } });
      tabela($("tabHist"), colsB, linhasB, "bai", [fixa]);
      $("notaHist").textContent = "Cada célula mostra o IIP do bairro e “positivos em pesquisados” (ex.: 4 em 34). Bairros têm poucos imóveis por levantamento: variações grandes podem refletir amostra pequena. A variação compara o levantamento e a comparação escolhidos nos filtros.";
      CSV_ATUAL = { nome: "lira-historico-bairros.csv", cab: colsB.map(function (c) { return c.t.replace(/<[^>]+>/g, ""); }), linhas: [fixa].concat(linhasB).map(function (r) { return colsB.map(function (c) { return c.tx(r); }); }) };
    }
  }

  /* ---------- eventos ---------- */
  /* As escolhas só são aplicadas ao clicar em "Comparar" (ou Enter): evita redesenhar a cada seleção. */
  function marcarPendente(sim) {
    $("btnComparar").classList.toggle("pendente", !!sim);
  }
  ["fFoco", "fComp", "fEstrato", "fBairro"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      if (id === "fFoco") { S.foco = $("fFoco").value; montarComp(ALL.filter(function (l) { return l.status === "com_dados"; }), S.foco); }
      if (id === "fComp") S.comp = $("fComp").value;
      if (id === "fEstrato") { $("fBairro").value = ""; S.estrato = $("fEstrato").value; S.bairro = ""; montarBairros(); }
      marcarPendente(true);
    });
    $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("btnComparar").click(); } });
  });
  $("btnComparar").addEventListener("click", function () { marcarPendente(false); atualizar(); });
  $("btnLimpar").addEventListener("click", function () {
    ["fEstrato", "fBairro"].forEach(function (id) { $(id).value = ""; });
    S.foco = ""; S.comp = "auto"; S.bairro = ""; marcarPendente(false); atualizar();
  });
  $("rTop").addEventListener("click", function () { S.todos = false; atualizar(); });
  $("rTodos").addEventListener("click", function () { S.todos = true; atualizar(); });
  $("vGrafico").addEventListener("click", function () { S.tabela = false; if (S.evol) S.evol(); });
  $("vTabela").addEventListener("click", function () { S.tabela = true; if (S.evol) S.evol(); });
  $("tabLev").addEventListener("click", function () { S.aba = "lev"; atualizar(); });
  $("tabBai").addEventListener("click", function () { S.aba = "bai"; atualizar(); });
  $("btnCsv").addEventListener("click", function () { if (CSV_ATUAL) L.baixarCSV(CSV_ATUAL.nome, CSV_ATUAL.cab, CSV_ATUAL.linhas); });
  $("btnImprimir").addEventListener("click", function () { window.print(); });
  $("btnFiltros").addEventListener("click", function () {
    var fechado = $("filtros").classList.toggle("fechado");
    $("btnFiltros").setAttribute("aria-expanded", String(!fechado));
  });
  if (window.matchMedia("(max-width: 760px)").matches) { $("filtros").classList.add("fechado"); $("btnFiltros").setAttribute("aria-expanded", "false"); }
  document.addEventListener("lira:tema", atualizar);

  /* menu de seções com destaque da seção visível */
  (function () {
    var links = [].slice.call(document.querySelectorAll("#subnav a"));
    var alvos = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var lista = links[0].parentNode, ind = document.createElement("span");
    ind.className = "sub-ind"; ind.setAttribute("aria-hidden", "true"); lista.insertBefore(ind, lista.firstChild); lista.classList.add("com-ind");
    function marcar(i) {
      links.forEach(function (a, k) {
        a.classList.toggle("ativo", k === i);
        if (k === i) {
          ind.style.width = a.offsetWidth + "px"; ind.style.transform = "translateX(" + a.offsetLeft + "px)"; ind.classList.add("pronto");
          if (lista.scrollTo) lista.scrollTo({ left: a.offsetLeft - 20, behavior: "smooth" });
        }
      });
      if (i < 0) ind.classList.remove("pronto");
    }
    window.addEventListener("resize", function () { var k = links.findIndex(function (a) { return a.classList.contains("ativo"); }); if (k >= 0) marcar(k); });
    var trava = 0;
    links.forEach(function (a, i) { a.addEventListener("click", function () { marcar(i); trava = Date.now() + 1100; }); });
    function ver() {
      if (Date.now() < trava) return;
      var y = window.scrollY + 160, atual = -1;
      alvos.forEach(function (el, i) { if (el && !el.hidden && el.offsetParent !== null && el.getBoundingClientRect().top + window.scrollY <= y) atual = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) atual = alvos.length - 1; // fim da página
      marcar(atual);
    }
    window.addEventListener("scroll", ver, { passive: true }); setInterval(function () { if (Date.now() >= trava) ver(); }, 400); ver();
  })();

  montarFiltrosFixos(); montarBairros();
  document.querySelectorAll(".alterna, .tabs").forEach(L.deslizante);
  atualizar();
})();
