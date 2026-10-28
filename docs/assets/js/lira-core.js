/* =========================================================
   LIRAa — núcleo compartilhado (todas as páginas)
   - Classificação de risco (regras ÚNICAS: LIRA_DATA.regras, vindas de
     regras_classificacao.json — nenhum limite é repetido fora dali)
   - Formatação pt-BR, agregações, legenda oficial, cabeçalho/rodapé, tema
   ========================================================= */
(function (global) {
  "use strict";

  var D = global.LIRA_DATA || { levantamentos: [], regras: { indices: {} } };
  var REGRAS = (D.regras && D.regras.indices) || {};

  /* ---------- utilidades ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtInt(n) { return n == null ? "—" : Number(n).toLocaleString("pt-BR"); }
  function fmtDec(n, d) {
    if (n == null || isNaN(n)) return "—";
    d = d == null ? 2 : d;
    return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtPct(n, d) { return n == null ? "—" : fmtDec(n, d) + "%"; }
  function fmtSinal(n, d) {
    if (n == null || isNaN(n)) return "—";
    return (n > 0 ? "+" : n < 0 ? "−" : "") + fmtDec(Math.abs(n), d == null ? 2 : d);
  }
  function fmtData(iso) {
    if (!iso) return "—";
    var p = iso.slice(0, 10).split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function fmtDataHora(iso) {
    if (!iso) return "—";
    // o ISO já vem no horário de Ponta Porã (−04:00): não converte fuso
    return fmtData(iso) + " " + iso.slice(11, 16);
  }
  function fmtPeriodo(p) {
    if (!p) return "—";
    return fmtData(p.inicio).slice(0, 5) + " a " + fmtData(p.fim);
  }
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  function nomeMes(m) { return MESES[parseInt(m.slice(5, 7), 10) - 1]; }

  /* ---------- classificação (única) ---------- */
  function arredondar2(v) { return Math.round((v + 1e-12) * 100) / 100; }

  // Devolve a faixa {id, nome_oficial, rotulo, texto_limite, ...} ou null.
  function classificar(indice, valor) {
    var regra = REGRAS[indice];
    if (!regra || valor == null || isNaN(valor)) return null;
    var v = arredondar2(valor);
    for (var i = 0; i < regra.faixas.length; i++) {
      var f = regra.faixas[i];
      if (f.limite_superior == null) return f;
      if (v < f.limite_superior || (f.superior_inclusivo && v === f.limite_superior)) return f;
    }
    return regra.faixas[regra.faixas.length - 1];
  }

  var ICONES = {
    baixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></svg>',
    medio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 22 20.5H2z"/><path d="M12 10v4.5M12 17.6v.1"/></svg>',
    alto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z"/><path d="M12 7.5v5.5M12 16.2v.1"/></svg>'
  };
  var ICO = {
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    menos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
    igual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/></svg>'
  };

  // Selo "ícone + rótulo" (nunca só cor)
  function selo(indice, valor) {
    var f = classificar(indice, valor);
    if (!f) return '<span class="selo neutro">Sem dados</span>';
    return '<span class="selo ' + f.id + '">' + ICONES[f.id] + esc(f.rotulo) + "</span>";
  }

  /* ---------- legenda / régua oficial ---------- */
  // Posição (0-100%) do pino ao longo da régua de 3 faixas de mesma largura.
  function posicaoPino(indice, valor) {
    var fs = REGRAS[indice].faixas, v = arredondar2(valor);
    var idx = fs.indexOf(classificar(indice, valor));
    var ini = idx === 0 ? 0 : fs[idx - 1].limite_superior;
    var fim = fs[idx].limite_superior;
    if (fim == null) fim = Math.max(ini * 2, ini + 6);       // última faixa: escala visual
    var frac = Math.min(1, Math.max(0, (v - ini) / (fim - ini)));
    return ((idx + frac) / fs.length) * 100;
  }

  function regua(indice, valor, opts) {
    opts = opts || {};
    var regra = REGRAS[indice];
    if (!regra) return "";
    var atual = valor == null ? null : classificar(indice, valor);
    var h = '<section class="regua' + (atual ? " tem-atual" : "") + '" aria-label="Legenda de classificação do ' + esc(regra.sigla) + '">';
    h += '<div class="regua-topo"><h3>Classificação do ' + esc(regra.sigla) + " — " + esc(regra.nome) + "</h3>" +
      '<span class="etiqueta-fonte ' + (regra.oficial ? "oficial" : "referencia") + '">' +
      (regra.oficial ? "Faixas oficiais · Ministério da Saúde" : "Mesmas faixas do IIP · critério do setor") + "</span></div>";
    h += '<div class="regua-trilha">';
    if (atual) {
      h += '<div class="regua-pino" style="left:' + posicaoPino(indice, valor).toFixed(2) + '%"><b>' + esc(fmtDec(valor, 2)) +
        (regra.unidade || "") + '</b><i></i></div>';
    }
    regra.faixas.forEach(function (f) {
      var ehAtual = atual && atual.id === f.id;
      h += '<div class="regua-faixa ' + f.id + (ehAtual ? " atual" : "") + '"' + (ehAtual ? ' aria-current="true"' : "") + ">" +
        '<span class="nome">' + ICONES[f.id] + esc(f.nome_oficial) + "</span>" +
        '<span class="rot">' + esc(f.rotulo) + "</span>" +
        '<span class="lim">' + esc(f.texto_limite) + "</span>" +
        (ehAtual ? '<span class="tag-atual"><span>Resultado atual</span></span>' : "") + "</div>";
    });
    h += "</div>";
    if (!opts.compacta) {
      h += '<p class="regua-nota">' + esc(regra.nota) +
        " <span style=\"opacity:.85\">Cálculo: " + esc(regra.formula) + ".</span></p>";
    }
    h += "</section>";
    return h;
  }

  /* ---------- levantamentos ---------- */
  var LEVS = D.levantamentos || [];
  var COM_DADOS = LEVS.filter(function (l) { return l.status === "com_dados"; });
  function porChave(k) { return LEVS.filter(function (l) { return l.chave === k; })[0] || null; }

  // Levantamento que a Home deve mostrar: o configurado como principal (Novembro).
  // Se ainda não tem dados, cai para o mais recente COM dados e avisa (fallback).
  function principal() {
    var cfg = porChave(D.home);
    if (cfg && cfg.status === "com_dados") return { lev: cfg, fallback: false, configurado: cfg };
    var ult = COM_DADOS[COM_DADOS.length - 1] || null;
    return { lev: ult, fallback: true, configurado: cfg };
  }

  /* ---------- cálculo dos índices ---------- */
  var TIPOS = ["A1", "A2", "B", "C", "D1", "D2", "E"];
  var DESC_TIPOS = {
    A1: ["Depósito elevado", "caixa d'água, cisterna"],
    A2: ["Depósito ao nível do solo", "tambor, tonel, barril"],
    B: ["Depósito móvel", "vasos, garrafas, bebedouros"],
    C: ["Depósito fixo", "ralos, calhas, lajes"],
    D1: ["Pneus e sucatas", "pneus, sucata"],
    D2: ["Lixo", "recipientes descartáveis"],
    E: ["Depósito natural", "ocos de árvore, bromélias"]
  };
  var CAMPOS_SOMA = ["Total_Imoveis", "Total_Imoveis_Aegypti", "Total_Aegypti", "Tubitos", "Total_Imoveis_Albopictus"].concat(TIPOS);

  // t = objeto com os campos do eVisita (total ou soma de áreas)
  function calc(t) {
    t = t || {};
    var pesq = t.Total_Imoveis || 0, pos = t.Total_Imoveis_Aegypti || 0, dep = t.Total_Aegypti || 0;
    var tipos = {};
    TIPOS.forEach(function (k) { tipos[k] = t[k] || 0; });
    return {
      pesq: pesq, pos: pos, dep: dep, tub: t.Tubitos || 0, alb: t.Total_Imoveis_Albopictus || 0, tipos: tipos,
      iip: pesq ? (pos / pesq) * 100 : null,
      ib: pesq ? (dep / pesq) * 100 : null
    };
  }

  function nomeBairro(raw) {
    var s = String(raw || "").replace(/^\s*\d+\s*-\s*/, "").replace(/\s*-?\s*ESTRATO\s*\d+\s*$/i, "").trim();
    var peq = { DE: 1, DA: 1, DO: 1, DOS: 1, DAS: 1, E: 1 };
    var base = s.toLowerCase().split(/\s+/).map(function (w, i) {
      if (i > 0 && peq[w.toUpperCase()]) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
    return base;
  }
  function codigoArea(raw) { var m = String(raw || "").match(/^\s*(\d+)\s*-/); return m ? m[1] : ""; }

  // Lista plana de áreas (bairros) de um levantamento, com estrato pela estrutura dos dados
  function areasDe(lev) {
    var out = [];
    if (!lev || !lev.estratos) return out;
    Object.keys(lev.estratos).forEach(function (est) {
      lev.estratos[est].areas.forEach(function (a) {
        out.push({ estrato: est, codigo: codigoArea(a.AREA), nome: nomeBairro(a.AREA), raw: a.AREA, dados: a });
      });
    });
    return out;
  }

  // Agrega um levantamento com filtros opcionais {estrato, codigo}
  function agregar(lev, f) {
    if (!lev || lev.status !== "com_dados") return null;
    f = f || {};
    if (!f.estrato && !f.codigo) return calc(lev.total_geral);
    var soma = {};
    CAMPOS_SOMA.forEach(function (k) { soma[k] = 0; });
    var n = 0;
    areasDe(lev).forEach(function (a) {
      if (f.estrato && a.estrato !== f.estrato) return;
      if (f.codigo && a.codigo !== f.codigo) return;
      n++;
      CAMPOS_SOMA.forEach(function (k) { soma[k] += a.dados[k] || 0; });
    });
    if (!n) return null;
    return calc(soma);
  }

  function variacao(atual, anterior) {
    if (atual == null || anterior == null) return null;
    var abs = atual - anterior;
    return { abs: abs, pct: anterior ? (abs / anterior) * 100 : null };
  }

  // seta de variação: aumento de infestação = piora
  function delta(v, rotulo, d) {
    if (!v) return '<span class="delta igual">' + ICO.igual + "sem comparação</span>";
    var dir = Math.abs(v.abs) < 0.005 ? "igual" : v.abs > 0 ? "piora" : "melhora";
    var ic = dir === "igual" ? ICO.igual : dir === "piora" ? ICO.mais : ICO.menos;
    return '<span class="delta ' + dir + '">' + ic + esc(fmtSinal(v.abs, d == null ? 2 : d)) + (rotulo ? " " + esc(rotulo) : "") + "</span>";
  }

  /* ---------- tema, cabeçalho, rodapé ---------- */
  function lerTema() { try { return localStorage.getItem("lira-tema"); } catch (e) { return null; } }
  function gravarTema(t) { try { localStorage.setItem("lira-tema", t); } catch (e) { /* ok */ } }
  function temaEfetivo() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  var salvo = lerTema();
  if (salvo === "dark" || salvo === "light") document.documentElement.setAttribute("data-theme", salvo);

  var NAV = [
    { id: "home", href: "index.html", rot: "Início", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>' },
    { id: "dashboard", href: "dashboard.html", rot: "Dashboard", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>' },
    { id: "levantamento", href: "levantamento.html", rot: "Levantamentos", svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>' }
  ];

  function montarChrome(paginaId) {
    var topo = document.getElementById("site-header");
    if (topo) {
      var nav = NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.id === paginaId ? ' aria-current="page"' : "") + ">" + n.svg + "<span>" + n.rot + "</span></a>";
      }).join("");
      topo.innerHTML =
        '<div class="faixa-marca" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
        '<header class="site-header"><div class="container">' +
        '<a class="brand" href="index.html"><img src="assets/logo_pmpp.png" alt="Prefeitura Municipal de Ponta Porã">' +
        '<span class="brand-text"><strong>LIRAa Ponta Porã</strong><span>Setor de Endemias e Vetores</span></span></a>' +
        '<nav class="nav-principal" aria-label="Principal">' + nav + "</nav>" +
        '<button class="btn-tema" id="btnTema" type="button" aria-label="Alternar tema claro/escuro" title="Alternar tema claro/escuro">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg></button>' +
        "</div></header>";
      document.getElementById("btnTema").addEventListener("click", function () {
        var novo = temaEfetivo() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", novo);
        gravarTema(novo);
        document.dispatchEvent(new CustomEvent("lira:tema"));
      });
    }
    var rod = document.getElementById("site-footer");
    if (rod) {
      rod.innerHTML = '<footer class="rodape container"><p>Dados do eVisita/PNCD · <strong>Prefeitura Municipal de Ponta Porã</strong> — Secretaria Municipal de Saúde.</p>' +
        '<p>Atualizado em ' + esc(fmtDataHora(D.gerado_em)) + " (horário de Ponta Porã, UTC−4).</p></footer>";
    }
  }

  /* ---------- gráficos (Chart.js) ---------- */
  function css(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }

  function configurarChartJS() {
    if (!global.Chart) return;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
    Chart.defaults.animation = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 350 };

    // Faixas de risco desenhadas ao fundo (usa as MESMAS regras da classificação)
    Chart.register({
      id: "faixasRisco",
      beforeDatasetsDraw: function (chart, _a, opt) {
        if (!opt || !opt.indice) return;
        var ys = chart.scales.y, area = chart.chartArea, faixas = REGRAS[opt.indice].faixas;
        var ctx = chart.ctx, cores = { baixo: css("--risk-baixo"), medio: css("--risk-medio"), alto: css("--risk-alto") };
        var ini = 0;
        ctx.save();
        faixas.forEach(function (f) {
          var fim = f.limite_superior == null ? ys.max : f.limite_superior;
          var y1 = ys.getPixelForValue(Math.min(fim, ys.max)), y0 = ys.getPixelForValue(Math.max(ini, ys.min));
          if (y0 > y1) {
            ctx.globalAlpha = 0.10; ctx.fillStyle = cores[f.id];
            ctx.fillRect(area.left, y1, area.right - area.left, y0 - y1);
            ctx.globalAlpha = 0.9; ctx.fillStyle = css("--muted"); ctx.font = "600 11px Inter, sans-serif"; ctx.textAlign = "right";
            ctx.fillText(f.nome_oficial + " · " + f.texto_curto, area.right - 6, y1 + 13);
          }
          ini = fim;
        });
        ctx.restore();
      }
    });

    // Rótulo direto no último ponto de cada série
    Chart.register({
      id: "rotuloFinal",
      afterDatasetsDraw: function (chart, _a, opt) {
        if (!opt || !opt.ativo) return;
        var ctx = chart.ctx;
        chart.data.datasets.forEach(function (ds, i) {
          var meta = chart.getDatasetMeta(i);
          if (meta.hidden) return;
          var idx = -1;
          for (var k = ds.data.length - 1; k >= 0; k--) { if (ds.data[k] != null) { idx = k; break; } }
          if (idx < 0 || !meta.data[idx]) return;
          var p = meta.data[idx];
          ctx.save();
          ctx.font = "700 12px Inter, sans-serif";
          ctx.fillStyle = css("--ink");
          ctx.textAlign = idx === 0 ? "left" : "center";
          ctx.fillText(fmtDec(ds.data[idx], 2), p.x, p.y - 12 - (i * 0));
          ctx.restore();
        });
      }
    });
  }

  function opcoesBase() {
    var grade = css("--line"), texto = css("--muted");
    return {
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: css("--ink"), titleColor: css("--surface"), bodyColor: css("--surface"),
          padding: 10, cornerRadius: 8, boxPadding: 4,
          titleFont: { family: "Poppins, Inter, sans-serif", weight: "600", size: 13 }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: texto }, border: { color: css("--line-strong") } },
        y: { beginAtZero: true, grid: { color: grade }, ticks: { color: texto }, border: { display: false } }
      }
    };
  }

  var instancias = {};
  function criarGrafico(id, config) {
    var el = document.getElementById(id);
    if (!el || !global.Chart) return null;
    if (instancias[id]) instancias[id].destroy();
    instancias[id] = new Chart(el, config);
    return instancias[id];
  }
  function destruirGrafico(id) { if (instancias[id]) { instancias[id].destroy(); delete instancias[id]; } }

  /* ---------- exportação ---------- */
  function baixarCSV(nome, cabecalho, linhas) {
    function cel(v) { v = v == null ? "" : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var txt = [cabecalho].concat(linhas).map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    var blob = new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  var COLUNAS_EXCEL = [
    "AREA", "Tubitos", "Residencia", "Comercio", "TB", "Outros", "PE", "Total_Imoveis",
    "A1", "A2", "B", "C", "D1", "D2", "E", "Total_Aegypti",
    "Resid_Aegypti", "Comercio_Aegypti", "TB_Aegypti", "Outros_Aegypti", "Total_Imoveis_Aegypti",
    "Resid_Albopictus", "Comercio_Albopictus", "TB_Albopictus", "Outros_Albopictus", "Total_Imoveis_Albopictus"
  ];
  function baixarExcel(lev) {
    if (!global.XLSX || !lev || !lev.estratos) return;
    var wb = XLSX.utils.book_new(), todas = [];
    Object.keys(lev.estratos).forEach(function (nome, i) {
      var b = lev.estratos[nome];
      var linhas = b.areas.map(function (a) { return COLUNAS_EXCEL.map(function (c) { return a[c] == null ? "" : a[c]; }); });
      todas = todas.concat(linhas);
      var tot = COLUNAS_EXCEL.map(function (c) { return c === "AREA" ? "TOTAL " + nome.toUpperCase() : (b.total[c] == null ? "" : b.total[c]); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLUNAS_EXCEL].concat(linhas, [tot])), "Estrato_" + (i + 1));
    });
    var tg = COLUNAS_EXCEL.map(function (c) { return c === "AREA" ? "TOTAL GERAL" : (lev.total_geral[c] == null ? "" : lev.total_geral[c]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLUNAS_EXCEL].concat(todas, [tg])), "Total_Geral");
    XLSX.writeFile(wb, "LIRA_" + lev.semana_inicio + "_" + lev.semana_fim + ".xlsx");
  }

  global.LIRA = {
    data: D, regras: REGRAS, levantamentos: LEVS, comDados: COM_DADOS, porChave: porChave, principal: principal,
    esc: esc, fmtInt: fmtInt, fmtDec: fmtDec, fmtPct: fmtPct, fmtSinal: fmtSinal, fmtData: fmtData, fmtDataHora: fmtDataHora,
    fmtPeriodo: fmtPeriodo, nomeMes: nomeMes,
    classificar: classificar, selo: selo, regua: regua, ICONES: ICONES, ICO: ICO,
    TIPOS: TIPOS, DESC_TIPOS: DESC_TIPOS, calc: calc, agregar: agregar, areasDe: areasDe, variacao: variacao, delta: delta,
    nomeBairro: nomeBairro, codigoArea: codigoArea,
    montarChrome: montarChrome, css: css, configurarChartJS: configurarChartJS, opcoesBase: opcoesBase,
    criarGrafico: criarGrafico, destruirGrafico: destruirGrafico, baixarCSV: baixarCSV, baixarExcel: baixarExcel,
    temaEfetivo: temaEfetivo
  };
})(window);
