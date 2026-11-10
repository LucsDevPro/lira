(function () {
  "use strict";
  var L = window.LIRA, W = window.LIRA_W, esc = L.esc;
  L.montarChrome("home");
  L.configurarChartJS();

  function listaE(v) { return v.length > 1 ? v.slice(0, -1).join(", ") + " e " + v[v.length - 1] : v.join(""); }

  var P = L.principal(), lev = P.lev, cfg = P.configurado;
  var anterior = null;
  L.comDados.forEach(function (l, i) { if (l === lev) anterior = L.comDados[i - 1] || null; });
  var c = L.agregar(lev);

  /* Aviso quando o levantamento principal (Novembro) ainda não tem dados */
  if (P.fallback && cfg) {
    var a = L.data.automacao || {};
    document.getElementById("avisoFallback").innerHTML = '<div class="aviso" role="status">' + L.ICO.info + "<div><strong>" + esc(cfg.nome) + " ainda não tem dados coletados.</strong> " +
      "A coleta automática roda todos os dias às " + esc(listaE(a.horarios_locais || [])) + " (horário de Ponta Porã), de " +
      esc(L.fmtData(a.janela_inicio)) + " a " + esc(L.fmtData(a.janela_fim)) + ". " +
      "Enquanto isso, esta página mostra o levantamento mais recente com dados: <strong>" + esc(lev.nome) + "</strong>.</div></div>";
  }

  /* ---- Destaque simples: um número, uma cor, uma frase ---- */
  var FRASE = {
    baixo: "Situação satisfatória: poucos imóveis com focos do mosquito.",
    medio: "Situação de alerta: ainda há focos do mosquito. É importante reforçar os cuidados.",
    alto: "Situação de risco: muitos imóveis com focos do mosquito. É preciso agir."
  };
  var cl = L.classificar("iip", c.iip);

  function comparacao() {
    if (!anterior) return "";
    var ca = L.agregar(anterior), v = L.variacao(c.iip, ca.iip);
    if (!v) return "";
    var dir = Math.abs(v.abs) < 0.005 ? "igual" : v.abs > 0 ? "piora" : "melhora";
    var palavra = dir === "igual" ? "ficou igual" : dir === "piora" ? "subiu" : "caiu";
    var ic = dir === "igual" ? L.ICO.igual : dir === "piora" ? L.ICO.mais : L.ICO.menos;
    return '<p class="comparacao"><span class="delta ' + dir + '">' + ic + esc(palavra) + "</span> em relação a " + esc(anterior.nome) +
      " (de " + esc(L.fmtPct(ca.iip)) + " para " + esc(L.fmtPct(c.iip)) + ").</p>";
  }

  // legenda de 3 faixas em linguagem simples, com a faixa atual destacada
  function legenda() {
    var faixas = [0, 2, 5].map(function (v) { return L.classificar("iip", v); });
    return '<section class="regua tem-atual" aria-label="Como interpretar o resultado"><div class="regua-trilha sem-pino">' + faixas.map(function (f) {
      var atual = cl && cl.id === f.id;
      return '<div class="regua-faixa ' + f.id + (atual ? " atual" : "") + '"' + (atual ? ' aria-current="true"' : "") + ">" +
        '<span class="nome">' + L.ICONES[f.id] + esc(f.rotulo) + "</span>" +
        '<span class="lim">' + esc(f.texto_limite) + "</span>" +
        (atual ? '<span class="tag-atual"><span>Resultado atual</span></span>' : "") + "</div>";
    }).join("") + '</div><p class="regua-nota">Faixas oficiais do Ministério da Saúde para o índice de infestação predial (IIP).</p></section>';
  }

  document.getElementById("destaque").innerHTML =
    '<div class="card destaque simples"><div class="destaque-info">' +
    '<span class="eyebrow">' + esc(P.fallback ? "Último levantamento com dados" : "Levantamento principal") + "</span>" +
    "<h1>Situação do mosquito Aedes aegypti em Ponta Porã</h1>" +
    '<p class="sub">LIRAa ' + esc(lev.nome) + " · " + esc(lev.semana_exibicao.rotulo) + " · coletado em " + esc(L.fmtDataHora(lev.coletado_em)) + "</p>" +
    '<div class="indice-grande"><div class="rot">dos imóveis visitados tinham focos do mosquito</div><div class="val">' + esc(L.fmtPct(c.iip)) + "</div>" + L.selo("iip", c.iip) + "</div>" +
    (cl ? '<p class="frase">' + esc(FRASE[cl.id]) + "</p>" : "") +
    comparacao() +
    '<p class="contagem">Foram visitados ' + L.fmtInt(c.pesq) + " imóveis; em " + L.fmtInt(c.pos) + " deles havia foco do mosquito.</p>" +
    "</div>" +
    '<div class="destaque-regua">' + legenda() + "</div></div>";
  document.title = "Mosquito Aedes aegypti em Ponta Porã — LIRAa " + lev.nome;
  document.getElementById("btnDetalhes").href = "levantamento.html?id=" + encodeURIComponent(lev.chave);

  /* ---- Bairros e criadouros (só os principais) ---- */
  document.getElementById("subRanking").textContent = "Porcentagem de imóveis visitados com foco, em cada bairro. Bairros com poucos imóveis visitados podem variar bastante.";
  W.ranking(document.getElementById("ranking"), lev, { limite: 5, limpo: true, simples: true });
  W.criadouros(document.getElementById("criadouros"), c, { limite: 4, simples: true });

  /* ---- Evolução: gráfico + frases curtas ---- */
  function evolucao() { W.graficoEvolucao("gEvolucao", L.levantamentos, null, { soIip: true }); }
  evolucao();
  document.addEventListener("lira:tema", evolucao);

  var linhas = "";
  L.comDados.slice().reverse().forEach(function (l) {
    var i = L.comDados.indexOf(l), x = L.agregar(l), ant = i ? L.agregar(L.comDados[i - 1]) : null, v = ant ? L.variacao(x.iip, ant.iip) : null;
    var txt;
    if (!v) txt = "primeiro levantamento com dados";
    else {
      var dir = Math.abs(v.abs) < 0.005 ? "igual" : v.abs > 0 ? "piora" : "melhora";
      txt = '<span class="delta ' + dir + '">' + (dir === "igual" ? L.ICO.igual : dir === "piora" ? L.ICO.mais : L.ICO.menos) +
        (dir === "igual" ? "igual ao anterior" : dir === "piora" ? "subiu" : "caiu") + "</span>";
    }
    linhas += '<div class="var-item"><div class="var-topo"><span>' + esc(l.nome) + "</span><b>" + esc(L.fmtPct(x.iip)) + '</b></div><div class="var-baixo">' + txt + "</div></div>";
  });
  document.getElementById("boxVariacao").innerHTML = '<h3 class="card-titulo">Levantamento a levantamento</h3><p class="card-sub">Porcentagem de imóveis com focos.</p><div class="var-lista">' + linhas + "</div>";

  /* ---- Observações sobre os dados (só aparece se houver) ---- */
  var obs = document.getElementById("obsDados");
  W.avisoAusentes(document.getElementById("avisoAusentes"), lev);
  if (document.getElementById("avisoAusentes").innerHTML.trim()) obs.hidden = false;
})();
