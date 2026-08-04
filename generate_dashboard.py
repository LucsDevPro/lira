# -*- coding: utf-8 -*-
"""
Gera docs/index.html a partir de data/history.json. Todos os snapshots
ficam embutidos na página, com um seletor no topo para trocar entre
períodos. O GitHub Pages publica o conteúdo da pasta docs/.

Identidade visual: cores oficiais da Prefeitura Municipal de Ponta Porã
(extraídas do logo em docs/assets/logo_pmpp.png) e fonte Poppins/Inter.
"""

import json
import os

HISTORY_PATH = "data/history.json"
OUTPUT_PATH = "docs/index.html"

# Paleta oficial (extraída do logo da PMPP)
COR_MARINHO = "#002B68"     # "PREFEITURA MUNICIPAL DE" / "PORÃ"
COR_AZUL = "#007ECA"        # "PONTA"
COR_VERDE = "#00B93B"       # ícone / risco baixo
COR_AMARELO = "#FFB900"     # detalhe / risco médio


def calcular_iip(total_imoveis_aegypti, total_imoveis):
    if not total_imoveis:
        return 0.0
    return round((total_imoveis_aegypti / total_imoveis) * 100, 2)


def carregar_snapshots():
    if not os.path.exists(HISTORY_PATH):
        return []

    with open(HISTORY_PATH, encoding="utf-8") as f:
        historico = json.load(f)

    for snap in historico.values():
        for bloco in snap["estratos"].values():
            t = bloco["total"]
            if "IIP" not in t:
                t["IIP"] = calcular_iip(t.get("Total_Imoveis_Aegypti", 0), t.get("Total_Imoveis", 0))
        tg = snap["total_geral"]
        if "IIP" not in tg:
            tg["IIP"] = calcular_iip(tg.get("Total_Imoveis_Aegypti", 0), tg.get("Total_Imoveis", 0))

    return sorted(historico.values(), key=lambda s: s["gerado_em"])


def main():
    lista = carregar_snapshots()

    if not lista:
        raise SystemExit(
            f"Não encontrei nenhum dado em {HISTORY_PATH}. "
            "Rode lira_scraper.py ou importar_xlsx_historico.py primeiro."
        )

    snapshots_json = json.dumps(lista, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LIRAa — Prefeitura Municipal de Ponta Porã</title>
<link rel="icon" href="assets/logo_pmpp.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  :root {{
    --marinho: {COR_MARINHO};
    --azul: {COR_AZUL};
    --verde: {COR_VERDE};
    --amarelo: {COR_AMARELO};
    --bg: #f4f6fa;
    --panel: #ffffff;
    --text: #1c2733;
    --muted: #67758a;
    --border: #e3e8ef;
    --shadow: 0 1px 3px rgba(16,34,64,0.06), 0 1px 2px rgba(16,34,64,0.08);
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: 'Inter', -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 0 0 60px;
  }}
  h1, h2, h3, .brand-title {{ font-family: 'Poppins', 'Inter', sans-serif; }}

  .topbar {{
    background: linear-gradient(90deg, var(--marinho) 0%, #013a86 100%);
    padding: 4px 0;
  }}
  .topbar .faixa {{
    display: flex;
    height: 6px;
  }}
  .topbar .faixa span {{ flex: 1; }}
  .topbar .faixa span:nth-child(1) {{ background: var(--verde); }}
  .topbar .faixa span:nth-child(2) {{ background: var(--amarelo); }}
  .topbar .faixa span:nth-child(3) {{ background: var(--azul); }}

  header.institucional {{
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow);
    padding: 18px 32px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }}
  .marca {{
    display: flex;
    align-items: center;
    gap: 16px;
  }}
  .marca img {{ height: 52px; }}
  .marca .titulos h1 {{
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--marinho);
  }}
  .marca .titulos .subtitulo-app {{
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }}

  select#seletorSemana {{
    background: var(--panel);
    color: var(--text);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 11px 16px;
    font-size: 14px;
    font-family: inherit;
    min-width: 260px;
    cursor: pointer;
  }}
  select#seletorSemana:focus {{ outline: 2px solid var(--azul); }}

  main {{ padding: 28px 32px 0; max-width: 1280px; margin: 0 auto; }}

  .subtitulo {{ color: var(--muted); font-size: 14px; }}

  .resumo {{
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px 26px;
    margin-bottom: 24px;
    box-shadow: var(--shadow);
    border-left: 5px solid var(--azul);
  }}
  .resumo .iip-grande {{ font-size: 44px; font-weight: 700; font-family: 'Poppins', sans-serif; }}
  .tubitos-destaque {{
    text-align: center;
    background: #fff4e5;
    border: 1.5px solid var(--amarelo);
    border-radius: 12px;
    padding: 14px 26px;
    min-width: 150px;
  }}
  .tubitos-destaque .numero {{
    font-size: 40px;
    font-weight: 700;
    font-family: 'Poppins', sans-serif;
    color: #a15c00;
    line-height: 1;
  }}
  .tubitos-destaque .rotulo {{
    font-size: 12px;
    color: #a15c00;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-top: 6px;
  }}
  .badge {{
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    color: #ffffff;
    margin-top: 6px;
    letter-spacing: 0.2px;
  }}
  .grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }}
  .card {{
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    box-shadow: var(--shadow);
    border-top: 4px solid var(--marinho);
  }}
  .card h3 {{ margin: 0 0 8px; font-size: 14px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }}
  .card .iip {{ font-size: 28px; font-weight: 700; font-family: 'Poppins', sans-serif; }}
  table.mini {{ width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 13px; }}
  table.mini td {{ padding: 5px 0; color: var(--muted); }}
  table.mini td:last-child {{ text-align: right; color: var(--text); font-weight: 600; }}
  .charts {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 28px;
  }}
  .chart-box {{
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px 22px 14px;
    box-shadow: var(--shadow);
  }}
  .chart-box .chart-titulo {{
    font-family: 'Poppins', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: var(--marinho);
    margin: 0 0 14px;
  }}
  .chart-canvas-wrap {{
    position: relative;
    height: 340px;
  }}
  @media (max-width: 800px) {{
    .charts {{ grid-template-columns: 1fr; }}
    .chart-canvas-wrap {{ height: 300px; }}
  }}
  table.dados {{
    width: 100%;
    border-collapse: collapse;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    font-size: 13px;
    box-shadow: var(--shadow);
  }}
  table.dados th {{
    text-align: left;
    background: var(--marinho);
    padding: 12px 14px;
    color: #ffffff;
    font-weight: 600;
    position: sticky;
    top: 0;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }}
  table.dados th:hover {{ background: #013a86; }}
  table.dados th .seta {{ font-size: 10px; opacity: 0.7; margin-left: 4px; }}
  table.dados td {{ padding: 9px 14px; border-top: 1px solid var(--border); }}
  table.dados tr:hover {{ background: #eef4fb; }}
  th.col-tubitos, td.col-tubitos {{ background: #fff9ef; }}
  td.col-tubitos {{ font-weight: 700; font-family: 'Poppins', sans-serif; }}
  td.col-tubitos.tem-foco {{ color: #a15c00; }}
  .tabela-controles {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;
  }}
  .tabela-controles h2 {{
    font-size: 15px;
    color: var(--marinho);
    margin: 0;
  }}
  #contadorAreas {{ font-size: 12px; color: var(--muted); font-weight: 500; }}
  .dica-ordenar {{ font-size: 12px; color: var(--muted); font-weight: 500; }}
  table.dados tr.linha-total td {{
    background: #eef2f8;
    font-weight: 700;
    border-top: 2px solid var(--marinho);
  }}
  table.dados td.badge-cell {{ text-align: left; }}
  table.dados .badge-tabela {{
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
  }}
  td.col-tubitos.sem-foco {{ color: #9aa5b1; font-weight: 500; }}
  footer {{
    color: var(--muted);
    font-size: 12px;
    margin-top: 32px;
    text-align: center;
    padding: 20px 32px 0;
  }}
  footer strong {{ color: var(--marinho); }}
</style>
</head>
<body>

<div class="topbar">
  <div class="faixa"><span></span><span></span><span></span></div>
</div>

<header class="institucional">
  <div class="marca">
    <img src="assets/logo_pmpp.png" alt="Prefeitura Municipal de Ponta Porã">
    <div class="titulos">
      <h1>Vigilância Epidemiológica — LIRAa</h1>
      <p class="subtitulo-app" id="subtitulo"></p>
    </div>
  </div>
  <select id="seletorSemana"></select>
</header>

<main>

<div class="resumo">
  <div>
    <div class="subtitulo">IIP Geral (Índice de Infestação Predial)</div>
    <div class="iip-grande" id="iipGrande"></div>
    <div class="badge" id="badgeGeral"></div>
  </div>
  <div class="tubitos-destaque">
    <div class="numero" id="tubitosGrande"></div>
    <div class="rotulo">Tubitos recolhidos<br>(focos encontrados)</div>
  </div>
  <div style="flex:1"></div>
  <table class="mini" style="max-width:280px">
    <tr><td>Imóveis vistoriados</td><td id="tImoveis"></td></tr>
    <tr><td>Imóveis c/ Ae. aegypti</td><td id="tAegypti"></td></tr>
    <tr><td>Imóveis c/ Ae. albopictus</td><td id="tAlbopictus"></td></tr>
  </table>
</div>

<div class="grid" id="cardsEstratos"></div>

<div class="tabela-controles">
  <h2>Consolidado por estrato</h2>
</div>

<table class="dados" style="margin-bottom:28px;">
  <thead>
    <tr>
      <th>Estrato</th>
      <th>Imóveis vistoriados</th>
      <th class="col-tubitos">Tubitos (focos)</th>
      <th>Depósitos Ae. aegypti</th>
      <th>Imóveis c/ Ae. aegypti</th>
      <th>Imóveis c/ Ae. albopictus</th>
      <th>IIP</th>
      <th>Classificação</th>
    </tr>
  </thead>
  <tbody id="corpoConsolidado"></tbody>
</table>

<div class="charts">
  <div class="chart-box">
    <p class="chart-titulo">IIP por Estrato</p>
    <div class="chart-canvas-wrap"><canvas id="chartEstratos"></canvas></div>
  </div>
  <div class="chart-box">
    <p class="chart-titulo">Histórico do IIP Geral</p>
    <div class="chart-canvas-wrap"><canvas id="chartHistorico"></canvas></div>
  </div>
</div>

<div class="tabela-controles">
  <h2>Detalhamento por área</h2>
  <div style="display:flex; align-items:center; gap:14px;">
    <span id="contadorAreas"></span>
    <span class="dica-ordenar">Clique numa coluna para ordenar (numérico ou alfabético)</span>
  </div>
</div>

<table class="dados">
  <thead>
    <tr>
      <th data-campo="estrato">Estrato</th>
      <th data-campo="area">Área</th>
      <th data-campo="Total_Imoveis">Imóveis vistoriados</th>
      <th class="col-tubitos" data-campo="Tubitos">Tubitos (focos)</th>
      <th data-campo="Total_Aegypti">Depósitos Ae. aegypti</th>
      <th data-campo="Total_Imoveis_Aegypti">Imóveis c/ Ae. aegypti</th>
      <th data-campo="Total_Imoveis_Albopictus">Imóveis c/ Ae. albopictus</th>
    </tr>
  </thead>
  <tbody id="corpoTabela"></tbody>
</table>

<footer>Gerado automaticamente a partir do eVisita/PNCD — <strong>Prefeitura Municipal de Ponta Porã</strong>, Secretaria Municipal de Saúde.</footer>

</main>

<script>
  const SNAPSHOTS = {snapshots_json}; // ordenado do mais antigo pro mais novo
  const corTexto = "#67758a";
  const corGrade = "#e3e8ef";
  const CORES = {{ marinho: "{COR_MARINHO}", azul: "{COR_AZUL}", verde: "{COR_VERDE}", amarelo: "{COR_AMARELO}" }};

  function classificarIIP(valor) {{
    if (valor < 1) return ["Baixo risco", CORES.verde];
    if (valor < 3.9) return ["Risco médio", "#e08e00"];
    return ["Alto risco", "#c62828"];
  }}

  function formatarData(iso) {{
    return iso.slice(0, 16).replace("T", " ");
  }}

  function rotuloCiclo(snap) {{
    if (snap.semana_exibicao && snap.semana_exibicao.rotulo) {{
      return snap.semana_exibicao.rotulo;
    }}
    return `Semana ${{snap.semana_inicio}}-${{snap.semana_fim}}`;
  }}

  let chartEstratos = null;
  let chartHistorico = null;
  let linhasAtuais = [];
  let ordenarCampo = null;
  let ordenarAsc = true;

  function renderizarTabela() {{
    let linhas = linhasAtuais.slice();

    if (ordenarCampo) {{
      linhas.sort((a, b) => {{
        const va = a[ordenarCampo], vb = b[ordenarCampo];
        let cmp;
        if (typeof va === "number" && typeof vb === "number") {{
          cmp = va - vb;
        }} else {{
          cmp = String(va).localeCompare(String(vb), 'pt-BR');
        }}
        return ordenarAsc ? cmp : -cmp;
      }});
    }}

    const corpo = document.getElementById("corpoTabela");
    corpo.innerHTML = "";
    linhas.forEach(l => {{
      const tr = document.createElement("tr");
      const classeTubitos = l.Tubitos > 0 ? "tem-foco" : "sem-foco";
      tr.innerHTML = `
        <td>${{l.estrato}}</td>
        <td>${{l.area}}</td>
        <td>${{l.Total_Imoveis}}</td>
        <td class="col-tubitos ${{classeTubitos}}">${{l.Tubitos}}</td>
        <td>${{l.Total_Aegypti}}</td>
        <td>${{l.Total_Imoveis_Aegypti}}</td>
        <td>${{l.Total_Imoveis_Albopictus}}</td>
      `;
      corpo.appendChild(tr);
    }});

    document.getElementById("contadorAreas").textContent =
      `${{linhas.length}} área(s)`;

    document.querySelectorAll("table.dados th[data-campo]").forEach(th => {{
      th.querySelector(".seta")?.remove();
      if (th.dataset.campo === ordenarCampo) {{
        const seta = document.createElement("span");
        seta.className = "seta";
        seta.textContent = ordenarAsc ? "▲" : "▼";
        th.appendChild(seta);
      }}
    }});
  }}

  document.querySelectorAll("table.dados th[data-campo]").forEach(th => {{
    th.addEventListener("click", () => {{
      const campo = th.dataset.campo;
      if (ordenarCampo === campo) {{
        ordenarAsc = !ordenarAsc;
      }} else {{
        ordenarCampo = campo;
        ordenarAsc = true;
      }}
      renderizarTabela();
    }});
  }});

  function renderizar(indice) {{
    const snap = SNAPSHOTS[indice];
    const tg = snap.total_geral;
    const [labelGeral, corGeral] = classificarIIP(tg.IIP || 0);

    document.getElementById("subtitulo").textContent =
      `${{rotuloCiclo(snap)}} · Coletado em ${{formatarData(snap.gerado_em)}}`;

    document.getElementById("iipGrande").textContent = (tg.IIP || 0) + "%";
    document.getElementById("iipGrande").style.color = corGeral;

    const badge = document.getElementById("badgeGeral");
    badge.textContent = labelGeral;
    badge.style.background = corGeral;

    document.getElementById("tImoveis").textContent = tg.Total_Imoveis || 0;
    document.getElementById("tAegypti").textContent = tg.Total_Imoveis_Aegypti || 0;
    document.getElementById("tAlbopictus").textContent = tg.Total_Imoveis_Albopictus || 0;
    document.getElementById("tubitosGrande").textContent = tg.Tubitos || 0;

    const cardsDiv = document.getElementById("cardsEstratos");
    cardsDiv.innerHTML = "";
    const nomesEstratos = Object.keys(snap.estratos);
    const valoresIIPEstratos = [];

    nomesEstratos.forEach(nome => {{
      const bloco = snap.estratos[nome];
      const t = bloco.total;
      const [label, cor] = classificarIIP(t.IIP || 0);
      valoresIIPEstratos.push(t.IIP || 0);

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${{nome}}</h3>
        <div class="iip" style="color:${{cor}}">${{t.IIP || 0}}%</div>
        <div class="badge" style="background:${{cor}}">${{label}}</div>
        <table class="mini">
          <tr><td>Imóveis vistoriados</td><td>${{t.Total_Imoveis || 0}}</td></tr>
          <tr style="background:#fff9ef">
            <td style="color:#a15c00;font-weight:600">Tubitos (focos)</td>
            <td style="color:#a15c00;font-weight:700">${{t.Tubitos || 0}}</td>
          </tr>
          <tr><td>Imóveis c/ Ae. aegypti</td><td>${{t.Total_Imoveis_Aegypti || 0}}</td></tr>
          <tr><td>Depósitos c/ Ae. aegypti</td><td>${{t.Total_Aegypti || 0}}</td></tr>
        </table>
      `;
      cardsDiv.appendChild(card);
    }});

    const corpoConsolidado = document.getElementById("corpoConsolidado");
    corpoConsolidado.innerHTML = "";

    nomesEstratos.forEach(nome => {{
      const t = snap.estratos[nome].total;
      const [label, cor] = classificarIIP(t.IIP || 0);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${{nome}}</td>
        <td>${{t.Total_Imoveis || 0}}</td>
        <td class="col-tubitos ${{(t.Tubitos || 0) > 0 ? 'tem-foco' : 'sem-foco'}}">${{t.Tubitos || 0}}</td>
        <td>${{t.Total_Aegypti || 0}}</td>
        <td>${{t.Total_Imoveis_Aegypti || 0}}</td>
        <td>${{t.Total_Imoveis_Albopictus || 0}}</td>
        <td style="font-weight:700;color:${{cor}}">${{t.IIP || 0}}%</td>
        <td class="badge-cell"><span class="badge-tabela" style="background:${{cor}}">${{label}}</span></td>
      `;
      corpoConsolidado.appendChild(tr);
    }});

    const [labelTg, corTg] = classificarIIP(tg.IIP || 0);
    const trTotal = document.createElement("tr");
    trTotal.className = "linha-total";
    trTotal.innerHTML = `
      <td>TOTAL GERAL</td>
      <td>${{tg.Total_Imoveis || 0}}</td>
      <td class="col-tubitos">${{tg.Tubitos || 0}}</td>
      <td>${{tg.Total_Aegypti || 0}}</td>
      <td>${{tg.Total_Imoveis_Aegypti || 0}}</td>
      <td>${{tg.Total_Imoveis_Albopictus || 0}}</td>
      <td style="color:${{corTg}}">${{tg.IIP || 0}}%</td>
      <td class="badge-cell"><span class="badge-tabela" style="background:${{corTg}}">${{labelTg}}</span></td>
    `;
    corpoConsolidado.appendChild(trTotal);

    linhasAtuais = [];
    nomesEstratos.forEach(nome => {{
      snap.estratos[nome].areas.forEach(area => {{
        linhasAtuais.push({{
          estrato: nome,
          area: area.AREA || "",
          Total_Imoveis: area.Total_Imoveis || 0,
          Tubitos: area.Tubitos || 0,
          Total_Aegypti: area.Total_Aegypti || 0,
          Total_Imoveis_Aegypti: area.Total_Imoveis_Aegypti || 0,
          Total_Imoveis_Albopictus: area.Total_Imoveis_Albopictus || 0,
        }});
      }});
    }});
    renderizarTabela();

    if (chartEstratos) chartEstratos.destroy();
    try {{
      chartEstratos = new Chart(document.getElementById('chartEstratos'), {{
        type: 'bar',
        data: {{
          labels: nomesEstratos,
          datasets: [{{
            label: 'IIP (%)',
            data: valoresIIPEstratos,
            backgroundColor: CORES.azul,
            hoverBackgroundColor: CORES.marinho,
            borderRadius: 8,
            maxBarThickness: 70
          }}]
        }},
        options: {{
          responsive: true,
          maintainAspectRatio: false,
          layout: {{ padding: {{ top: 8, right: 8, bottom: 0, left: 0 }} }},
          plugins: {{
            legend: {{ display: false }},
            tooltip: {{
              backgroundColor: CORES.marinho,
              titleFont: {{ family: 'Poppins', size: 13, weight: '600' }},
              bodyFont: {{ family: 'Inter', size: 13 }},
              padding: 10,
              cornerRadius: 8,
              callbacks: {{ label: (ctx) => ` IIP: ${{ctx.parsed.y}}%` }}
            }}
          }},
          scales: {{
            x: {{ ticks: {{ color: corTexto, font: {{ family: 'Inter', size: 13 }} }}, grid: {{ display: false }} }},
            y: {{
              beginAtZero: true,
              ticks: {{ color: corTexto, font: {{ family: 'Inter', size: 12 }}, callback: (v) => v + '%' }},
              grid: {{ color: corGrade }}
            }}
          }}
        }}
      }});
    }} catch (e) {{
      console.error("Não foi possível carregar o gráfico de estratos:", e);
    }}
  }}

  const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
                 "julho","agosto","setembro","outubro","novembro","dezembro"];

  function formatarMesAno(iso) {{
    const d = new Date(iso);
    return `${{MESES[d.getUTCMonth()]}} de ${{d.getUTCFullYear()}}`;
  }}

  function montarSeletor() {{
    const select = document.getElementById("seletorSemana");
    SNAPSHOTS.forEach((snap, i) => {{
      const opt = document.createElement("option");
      opt.value = i;
      const mesAno = formatarMesAno(snap.gerado_em);
      opt.textContent = `${{mesAno.charAt(0).toUpperCase()}}${{mesAno.slice(1)}} (${{rotuloCiclo(snap)}})`;
      select.appendChild(opt);
    }});
    select.value = SNAPSHOTS.length - 1;
    select.addEventListener("change", () => renderizar(parseInt(select.value)));
  }}

  function montarGraficoHistorico() {{
    const labels = SNAPSHOTS.map(s => rotuloCiclo(s));
    const valores = SNAPSHOTS.map(s => s.total_geral.IIP || 0);

    chartHistorico = new Chart(document.getElementById('chartHistorico'), {{
      type: 'line',
      data: {{
        labels: labels,
        datasets: [{{
          label: 'IIP Geral (%)',
          data: valores,
          borderColor: CORES.marinho,
          borderWidth: 3,
          backgroundColor: 'rgba(0,43,104,0.08)',
          pointBackgroundColor: CORES.verde,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.3,
          fill: true
        }}]
      }},
      options: {{
        responsive: true,
        maintainAspectRatio: false,
        layout: {{ padding: {{ top: 8, right: 8, bottom: 0, left: 0 }} }},
        plugins: {{
          legend: {{ display: false }},
          tooltip: {{
            backgroundColor: CORES.marinho,
            titleFont: {{ family: 'Poppins', size: 13, weight: '600' }},
            bodyFont: {{ family: 'Inter', size: 13 }},
            padding: 10,
            cornerRadius: 8,
            callbacks: {{ label: (ctx) => ` IIP: ${{ctx.parsed.y}}%` }}
          }}
        }},
        scales: {{
          x: {{ ticks: {{ color: corTexto, maxRotation: 45, minRotation: 0, font: {{ family: 'Inter', size: 12 }} }}, grid: {{ display: false }} }},
          y: {{
            beginAtZero: true,
            ticks: {{ color: corTexto, font: {{ family: 'Inter', size: 12 }}, callback: (v) => v + '%' }},
            grid: {{ color: corGrade }}
          }}
        }}
      }}
    }});
  }}

  montarSeletor();
  renderizar(SNAPSHOTS.length - 1);
  try {{
    montarGraficoHistorico();
  }} catch (e) {{
    console.error("Não foi possível carregar o gráfico de histórico:", e);
  }}
</script>

</body>
</html>
"""

    os.makedirs("docs", exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Dashboard gerado em {OUTPUT_PATH} com {len(lista)} snapshot(s).")


if __name__ == "__main__":
    main()
