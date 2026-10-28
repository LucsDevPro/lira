(function () {
  "use strict";
  var L = window.LIRA, W = window.LIRA_W, esc = L.esc;
  L.montarChrome("home");
  L.configurarChartJS();

  var P = L.principal(), lev = P.lev, cfg = P.configurado;
  var anterior = null;
  L.comDados.forEach(function (l, i) { if (l === lev) anterior = L.comDados[i - 1] || null; });

  /* Aviso quando o levantamento principal (Novembro) ainda não tem dados */
  (function () {
    var el = document.getElementById("avisoFallback");
    if (!P.fallback || !cfg) return;
    var a = L.data.automacao || {};
    el.innerHTML = '<div class="aviso atencao" role="status">' + L.ICO.info + "<div><strong>" + esc(cfg.nome) + " ainda não tem dados coletados.</strong> " +
      "A coleta automática roda todos os dias às " + esc((a.horarios_locais || []).join(" e ")) + " (horário de Ponta Porã, UTC−4), de " +
      esc(L.fmtData(a.janela_inicio)) + " a " + esc(L.fmtData(a.janela_fim)) + ". " +
      "Enquanto isso, esta página mostra o levantamento mais recente com dados: <strong>" + esc(lev.nome) + "</strong>. Nenhum número foi estimado.</div></div>";
  })();

  /* Destaque */
  (function () {
    var el = document.getElementById("destaque");
    var c = L.agregar(lev);
    el.innerHTML = W.destaque(lev, anterior, P.fallback ? "Último levantamento com dados" : "Levantamento principal", "h1");
    document.title = "LIRAa " + lev.nome + " — Ponta Porã";

    document.getElementById("legendas").innerHTML = '<div class="card">' + L.regua("iip", c.iip) + '</div><div class="card">' + L.regua("ib", c.ib) + "</div>";

    document.getElementById("subEstratos").textContent = lev.nome + " · " + lev.semana_exibicao.rotulo;
    W.cardsEstratos(document.getElementById("cardsEstratos"), lev);
    W.criadouros(document.getElementById("criadouros"), c);
    document.getElementById("subRanking").textContent = lev.nome + " — IIP por bairro (cada bairro tem poucos imóveis; leia junto do nº pesquisado).";
    W.ranking(document.getElementById("ranking"), lev, { limite: 5, comparado: anterior });
    W.avisoAusentes(document.getElementById("avisoAusentes"), lev);
  })();

  /* Evolução + variação */
  function evolucao() { W.graficoEvolucao("gEvolucao", L.comDados, null); }
  evolucao();
  document.addEventListener("lira:tema", evolucao);

  (function () {
    var box = document.getElementById("boxVariacao");
    var linhas = "";
    L.comDados.forEach(function (l, i) {
      var c = L.agregar(l), a = i ? L.agregar(L.comDados[i - 1]) : null;
      var d = a ? L.variacao(c.iip, a.iip) : null;
      linhas += "<tr><td class=\"esq\">" + esc(l.nome) + "</td><td>" + esc(L.fmtPct(c.iip)) + "</td><td>" + (a ? L.delta(d, "p.p.") : "—") + "</td></tr>";
    });
    box.innerHTML = '<h3 class="card-titulo">Variação entre ciclos</h3><p class="card-sub">Diferença do IIP em pontos percentuais (p.p.) em relação ao levantamento anterior com dados.</p>' +
      '<div class="tabela-scroll" style="max-height:none"><table class="dados"><thead><tr><th class="esq">Levantamento</th><th>IIP</th><th>Variação</th></tr></thead><tbody>' + linhas + "</tbody></table></div>";
  })();

  /* Lista de levantamentos */
  document.getElementById("listaLev").innerHTML = L.levantamentos.slice().reverse().map(function (l) {
    var c = L.agregar(l), pr = l === lev;
    return '<a class="card kpi" style="text-decoration:none;color:inherit;display:block' + (pr ? ";border-color:var(--azul)" : "") + '" href="levantamento.html?id=' + esc(l.chave) + '">' +
      '<div class="rot">' + esc(l.semana_exibicao.rotulo) + (l.chave === L.data.home ? " · principal" : "") + "</div>" +
      '<div class="val" style="font-size:20px">' + esc(l.nome) + "</div>" +
      (c ? '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>' + esc(L.fmtPct(c.iip)) + "</b>" + L.selo("iip", c.iip) + "</div>" +
        '<div class="sub">' + L.fmtInt(c.pos) + " de " + L.fmtInt(c.pesq) + " imóveis positivos</div>"
        : '<div style="margin-top:8px"><span class="selo neutro">Sem dados</span></div><div class="sub">' + esc((l.ausentes || [])[0] || "") + "</div>") +
      "</a>";
  }).join("");
})();
