(function () {
  "use strict";
  var L = window.LIRA, W = window.LIRA_W, esc = L.esc;
  L.montarChrome("levantamento");
  L.configurarChartJS();
  function $(id) { return document.getElementById(id); }

  var param = new URLSearchParams(location.search).get("id");
  var atual = L.porChave(param) || L.principal().lev;
  var sort = { k: null, dir: "asc" };

  function montarSeletor() {
    $("selLev").innerHTML = L.levantamentos.slice().reverse().map(function (l) {
      return '<option value="' + esc(l.chave) + '"' + (l === atual ? " selected" : "") + ">" + esc(l.nome + " · " + l.semana_exibicao.rotulo + (l.status === "sem_dados" ? " (sem dados)" : "")) + "</option>";
    }).join("");
    var i = L.levantamentos.indexOf(atual);
    $("btnAnt").disabled = i <= 0; $("btnProx").disabled = i >= L.levantamentos.length - 1;
  }

  function ir(chave) {
    atual = L.porChave(chave) || atual;
    try { history.replaceState(null, "", "?id=" + encodeURIComponent(atual.chave)); } catch (e) { /* ok */ }
    sort = { k: null, dir: "asc" };
    render();
  }

  function render() {
    montarSeletor();
    document.title = "LIRAa " + atual.nome + " — Detalhes";
    var sem = atual.status !== "com_dados";
    $("conteudoLev").hidden = sem; $("semDados").hidden = !sem;
    $("btnExcel").disabled = sem;
    if (sem) {
      var ex = atual.ultima_tentativa;
      $("semDados").innerHTML = '<div class="card"><div class="vazio"><strong>' + esc(atual.nome) + " ainda não tem dados</strong>" +
        esc((atual.ausentes || [])[0] || "") + "<br>" + esc(atual.semana_exibicao.rotulo) + " · ciclo " + esc(atual.id_ciclo == null ? "não informado" : atual.id_ciclo) +
        " · IDs de semana " + esc(atual.semana_inicio + "–" + atual.semana_fim) +
        (ex ? "<br>Última tentativa: " + esc(L.fmtDataHora(ex.em)) + " (" + esc(ex.resultado) + ")" : "") + "</div></div>" +
        '<section class="secao"><div class="card">' + L.regua("iip", null) + "</div></section>";
      L.destruirGrafico("gEstratos");
      return;
    }
    var idx = L.comDados.indexOf(atual), anterior = L.comDados[idx - 1] || null;
    var c = L.agregar(atual);
    $("destaque").innerHTML = W.destaque(atual, anterior, { chip: atual.chave === L.data.home ? "Levantamento principal" : "Levantamento", tag: "h2", acoes: false });
    W.cardsEstratos($("cardsEstratos"), atual);
    W.criadouros($("listaCriadouros"), c);
    W.avisoAusentes($("avisoAusentes"), atual);
    consolidado(); graficoEstratos(); areas();
  }

  function consolidado() {
    var nomes = Object.keys(atual.estratos);
    function resto(t) { return (t.Resid_Aegypti || 0) + (t.Comercio_Aegypti || 0) + (t.Outros_Aegypti || 0); }
    function linha(nome, t, cls) {
      return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + esc(nome) + "</td><td>" + L.fmtInt(t.Total_Imoveis || 0) + "</td><td>" + (t.TB_Aegypti || 0) + "</td><td>" + resto(t) + "</td><td>" + (t.Tubitos || 0) + "</td>" +
        L.TIPOS.map(function (k) { return "<td>" + (t[k] || 0) + "</td>"; }).join("") +
        "<td>" + (t.Total_Aegypti || 0) + "</td><td>" + (t.Total_Imoveis_Aegypti || 0) + "</td><td>" + (t.Total_Imoveis_Albopictus || 0) + "</td></tr>";
    }
    $("tabConsolidado").innerHTML = '<table class="dados"><thead><tr><th>Estrato</th><th>Imóveis pesquisados</th><th><abbr title="Terreno baldio com foco">TB (foco)</abbr></th><th><abbr title="Residência + comércio + outros, com foco">Resto (foco)</abbr></th><th>Tubitos</th>' +
      L.TIPOS.map(function (k) { return '<th><abbr title="' + esc(L.DESC_TIPOS[k][0] + " — " + L.DESC_TIPOS[k][1]) + '">' + k + "</abbr></th>"; }).join("") +
      "<th>Depósitos Ae. aegypti</th><th>Imóveis Ae. aegypti</th><th>Imóveis Ae. albopictus</th></tr></thead><tbody>" +
      nomes.map(function (n) { return linha(n, atual.estratos[n].total); }).join("") + linha("TOTAL GERAL", atual.total_geral, "total") + "</tbody></table>";
  }

  function graficoEstratos() {
    var nomes = Object.keys(atual.estratos);
    var vals = nomes.map(function (n) { var x = L.calc(atual.estratos[n].total).iip; return Math.round((x + 1e-12) * 100) / 100; });
    var o = L.opcoesBase();
    o.plugins.faixasRisco = { indice: "iip" };
    o.plugins.tooltip.callbacks = { label: function (ctx) { var cl = L.classificar("iip", ctx.parsed.y); return " IIP " + L.fmtPct(ctx.parsed.y) + (cl ? " — " + cl.rotulo : ""); } };
    o.scales.y.suggestedMax = 4.5; o.scales.y.ticks.callback = function (v) { return v + "%"; };
    o.layout = { padding: { top: 18 } };
    var cores = vals.map(function (v) { return L.css("--serie-1"); });
    L.criarGrafico("gEstratos", { type: "bar", data: { labels: nomes, datasets: [{ label: "IIP (%)", data: vals, backgroundColor: cores, borderRadius: 4, maxBarThickness: 64 }] },
      options: o, plugins: [{ id: "rotulosEstrato", afterDatasetsDraw: function (ch) { var ctx = ch.ctx; ch.getDatasetMeta(0).data.forEach(function (b, i) { ctx.save(); ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif"; ctx.fillStyle = L.css("--ink"); ctx.textAlign = "center"; ctx.fillText(L.fmtDec(vals[i], 2), b.x, b.y - 6); ctx.restore(); }); } }] });
  }

  function areas() {
    var linhas = L.areasDe(atual).map(function (a) { var c = L.calc(a.dados); return { a: a, c: c }; });
    $("contadorAreas").textContent = linhas.length + " área(s)";
    var cols = [
      { t: "Estrato", esq: true, v: function (r) { return r.a.estrato; }, h: function (r) { return esc(r.a.estrato); } },
      { t: "Cód.", esq: true, v: function (r) { return +r.a.codigo; }, h: function (r) { return esc(r.a.codigo); } },
      { t: "Bairro / área", esq: true, v: function (r) { return r.a.nome; }, h: function (r) { return "<b>" + esc(r.a.nome) + "</b>"; } },
      { t: "Pesquisados", v: function (r) { return r.c.pesq; }, h: function (r) { return L.fmtInt(r.c.pesq); } },
      { t: "Positivos", v: function (r) { return r.c.pos; }, h: function (r) { return L.fmtInt(r.c.pos); } },
      { t: "IIP", v: function (r) { return r.c.iip; }, h: function (r) { return "<b>" + esc(L.fmtPct(r.c.iip)) + "</b>"; } },
      { t: "Classificação", esq: true, v: function (r) { return r.c.iip; }, h: function (r) { return L.selo("iip", r.c.iip); } },
      { t: "IB", v: function (r) { return r.c.ib; }, h: function (r) { return esc(L.fmtDec(r.c.ib)); } },
      { t: "Tubitos", v: function (r) { return r.c.tub; }, h: function (r) { return r.c.tub; } }
    ];
    L.TIPOS.forEach(function (k) { cols.push({ t: '<abbr title="' + esc(L.DESC_TIPOS[k][0]) + '">' + k + "</abbr>", v: function (r) { return r.c.tipos[k]; }, h: function (r) { var v = r.c.tipos[k]; return v ? "<b>" + v + "</b>" : '<span style="color:var(--muted)">0</span>'; } }); });
    cols.push({ t: "Depósitos Ae. aegypti", v: function (r) { return r.c.dep; }, h: function (r) { return r.c.dep; } });
    cols.push({ t: "Imóveis c/ albopictus", v: function (r) { return r.c.alb; }, h: function (r) { return r.c.alb; } });

    function desenhar() {
      var rows = linhas.slice();
      if (sort.k != null) {
        var col = cols[sort.k];
        rows.sort(function (x, y) { var a = col.v(x), b = col.v(y); var c = typeof a === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR"); return sort.dir === "desc" ? -c : c; });
      }
      $("tabAreas").innerHTML = '<table class="dados"><thead><tr>' + cols.map(function (c, i) {
        return '<th scope="col" tabindex="0" data-i="' + i + '" aria-sort="' + (sort.k === i ? (sort.dir === "desc" ? "descending" : "ascending") : "none") + '"' + (c.esq ? ' class="esq"' : "") + ">" + c.t + "</th>";
      }).join("") + "</tr></thead><tbody>" + rows.map(function (r) {
        return "<tr>" + cols.map(function (c) { return "<td" + (c.esq ? ' class="esq"' : "") + ">" + c.h(r) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table>";
      $("tabAreas").querySelectorAll("th").forEach(function (th) {
        function acao() { var i = +th.getAttribute("data-i"); sort = { k: i, dir: sort.k === i && sort.dir === "asc" ? "desc" : "asc" }; desenhar(); }
        th.addEventListener("click", acao);
        th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acao(); } });
      });
    }
    desenhar();
  }

  $("selLev").addEventListener("change", function () { ir($("selLev").value); });
  $("btnAnt").addEventListener("click", function () { var i = L.levantamentos.indexOf(atual); if (i > 0) ir(L.levantamentos[i - 1].chave); });
  $("btnProx").addEventListener("click", function () { var i = L.levantamentos.indexOf(atual); if (i < L.levantamentos.length - 1) ir(L.levantamentos[i + 1].chave); });
  $("btnExcel").addEventListener("click", function () { L.baixarExcel(atual); });
  $("btnImprimir").addEventListener("click", function () { window.print(); });
  document.addEventListener("lira:tema", render);
  render();
})();
