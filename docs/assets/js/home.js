(function () {
  "use strict";
  var L = window.LIRA, W = window.LIRA_W, esc = L.esc;
  L.montarChrome("home");
  L.configurarChartJS();

  var P = L.principal(), lev = P.lev, cfg = P.configurado;
  var anterior = null;
  L.comDados.forEach(function (l, i) { if (l === lev) anterior = L.comDados[i - 1] || null; });
  var c = L.agregar(lev);

  /* Aviso quando o levantamento principal (Novembro) ainda não tem dados */
  if (P.fallback && cfg) {
    var a = L.data.automacao || {};
    document.getElementById("avisoFallback").innerHTML = '<div class="aviso" role="status">' + L.ICO.info + "<div><strong>" + esc(cfg.nome) + " ainda não tem dados coletados.</strong> " +
      "A coleta automática roda todos os dias às " + esc((a.horarios_locais || []).join(" e ")) + " (horário de Ponta Porã), de " +
      esc(L.fmtData(a.janela_inicio)) + " a " + esc(L.fmtData(a.janela_fim)) + ". " +
      "Enquanto isso, esta página mostra o levantamento mais recente com dados: <strong>" + esc(lev.nome) + "</strong>.</div></div>";
  }

  document.getElementById("destaque").innerHTML = W.destaque(lev, anterior, {
    chip: P.fallback ? "Último levantamento com dados" : "Levantamento principal", tag: "h1", acoes: true });
  document.title = "LIRAa " + lev.nome + " — Ponta Porã";

  document.getElementById("subEstratos").textContent = lev.nome + " · " + lev.semana_exibicao.rotulo;
  W.cardsEstratos(document.getElementById("cardsEstratos"), lev);
  W.criadouros(document.getElementById("criadouros"), c);
  document.getElementById("subRanking").textContent = lev.nome + ". Cada bairro tem poucos imóveis: leia junto de “positivos de pesquisados”.";
  W.ranking(document.getElementById("ranking"), lev, { limite: 5, comparado: anterior, limpo: true });
  W.avisoAusentes(document.getElementById("avisoAusentes"), lev);

  /* Evolução (só IIP) */
  function evolucao() { W.graficoEvolucao("gEvolucao", L.comDados, null, { soIip: true }); }
  evolucao();
  document.addEventListener("lira:tema", evolucao);

  /* Variação entre ciclos */
  var linhas = "";
  L.comDados.slice().reverse().forEach(function (l) {
    var i = L.comDados.indexOf(l), x = L.agregar(l), a = i ? L.agregar(L.comDados[i - 1]) : null;
    linhas += "<dt>" + esc(l.nome) + "</dt><dd>" + esc(L.fmtPct(x.iip)) + "</dd>" +
      (a ? '<dd class="sep"></dd>' : "");
    if (a) linhas += '<dt style="font-size:12.5px;color:var(--muted)">variação</dt><dd>' + L.delta(L.variacao(x.iip, a.iip), "p.p.") + '</dd><dd class="sep"></dd>';
  });
  document.getElementById("boxVariacao").innerHTML = '<h3 class="card-titulo">Variação entre ciclos</h3><p class="card-sub">IIP em cada levantamento e diferença para o anterior.</p><dl class="mini-lista">' + linhas + "</dl>";

  /* Lista de levantamentos */
  document.getElementById("listaLev").innerHTML = L.levantamentos.slice().reverse().map(function (l) {
    var x = L.agregar(l);
    return '<a class="lev-linha" href="levantamento.html?id=' + esc(l.chave) + '"><div><b>' + esc(l.nome) + "</b><small>" + esc(l.semana_exibicao.rotulo) + (l.chave === L.data.home ? " · principal" : "") + "</small></div>" +
      '<div class="meio"><small>' + (x ? L.fmtInt(x.pos) + " de " + L.fmtInt(x.pesq) + " imóveis positivos" : esc((l.ausentes || [])[0] || "Sem dados")) + "</small></div>" +
      '<div class="iip">' + (x ? esc(L.fmtPct(x.iip)) : '<span class="selo neutro mini">Sem dados</span>') + "</div>" +
      '<svg class="ir" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a>';
  }).join("");
})();
