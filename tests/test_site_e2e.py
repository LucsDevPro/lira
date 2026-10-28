"""Testes de navegador (Playwright): páginas, legenda, classificação, filtros e gráficos."""
import json
import os
import re
import shutil
import subprocess
import sys

import pytest

pw = pytest.importorskip("playwright.sync_api")
from classificacao import classificar  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(RAIZ, "docs")


@pytest.fixture(scope="session")
def site_atual(tmp_path_factory):
    """docs/ com lira-data.js regenerado a partir dos dados reais do repositório."""
    destino = tmp_path_factory.mktemp("site") / "docs"
    shutil.copytree(DOCS, destino)
    env = dict(os.environ, LIRA_OUTPUT=str(destino / "assets" / "data" / "lira-data.js"))
    subprocess.run([sys.executable, os.path.join(RAIZ, "generate_dashboard.py")], check=True, env=env, cwd=RAIZ)
    return destino


@pytest.fixture(scope="session")
def site_com_novembro(tmp_path_factory, site_atual):
    """Variante SÓ PARA TESTE: novembro com dados (cópia dos de agosto) para validar a Home principal."""
    destino = tmp_path_factory.mktemp("site_nov") / "docs"
    shutil.copytree(site_atual, destino)
    arq = destino / "assets" / "data" / "lira-data.js"
    txt = arq.read_text(encoding="utf-8")
    dados = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    por = {l["chave"]: l for l in dados["levantamentos"]}
    nov, ago = por["331-332"], por["318-319"]
    nov.update(status="com_dados", estratos=ago["estratos"], total_geral=dict(ago["total_geral"], Total_Imoveis_Aegypti=60, Total_Aegypti=70, IIP=3.48),
               coletado_em="2026-11-03T03:05:00-04:00", ausentes=[])
    arq.write_text("window.LIRA_DATA = " + json.dumps(dados, ensure_ascii=False) + ";", encoding="utf-8")
    return destino


@pytest.fixture(scope="session")
def navegador():
    with pw.sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def abrir(navegador, site, pagina, largura=1280, altura=900):
    ctx = navegador.new_context(viewport={"width": largura, "height": altura})
    page = ctx.new_page()
    erros = []
    page.on("pageerror", lambda e: erros.append(str(e)))
    page.on("console", lambda m: erros.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
    page.route(re.compile(r"fonts\.(googleapis|gstatic)\.com"), lambda r: r.abort())
    page.goto("file://" + str(site / pagina))
    page.wait_for_timeout(600)
    page.erros = erros
    return page


def texto(page, seletor):
    return re.sub(r"\s+", " ", page.inner_text(seletor)).strip()


# ---------------- classificação: JS == Python ----------------

def test_classificacao_js_igual_python(navegador, site_atual):
    page = abrir(navegador, site_atual, "index.html")
    valores = [0, 0.5, 0.99, 0.995, 1, 1.0, 1.39, 2.5, 3.89, 3.9, 3.901, 3.91, 3.95, 4, 5.34, 11.76, 100]
    for indice in ("iip", "ib"):
        js = page.evaluate("([i, vs]) => vs.map(v => LIRA.classificar(i, v).id)", [indice, valores])
        py = [classificar(indice, v)["id"] for v in valores]
        assert js == py, (indice, js, py)
    assert page.erros == []


# ---------------- Home ----------------

def test_home_mostra_1_39_risco_medio_e_legenda(navegador, site_atual):
    page = abrir(navegador, site_atual, "index.html")
    assert page.erros == []
    destaque = texto(page, "#destaque")
    assert "1,39%" in destaque and "Risco médio" in destaque
    assert re.search(r"IB geral.*1,39.*Risco médio", destaque)
    # novembro configurado, mas sem dados: aviso claro e fallback para o último com dados
    assert "Novembro/2026 ainda não tem dados coletados" in texto(page, "#avisoFallback")
    assert "Último levantamento com dados" in destaque
    # legenda oficial com limites e destaque na faixa atual
    leg = texto(page, "#legendas")
    for t in ["Satisfatório", "abaixo de 1%", "Alerta", "de 1% a 3,9%", "Risco", "acima de 3,9%", "Faixas oficiais", "Mesmas faixas do IIP"]:
        assert t in leg, t
    assert page.locator("#legendas .regua").first.locator(".regua-faixa.atual").count() == 1
    assert "Alerta" in texto(page, "#legendas .regua:first-of-type .regua-faixa.atual")
    assert page.locator("#legendas .regua-faixa.atual").count() == 2            # IIP e IB
    # há 4 levantamentos listados e gráfico desenhado
    assert page.locator("#listaLev a").count() == 4
    assert page.evaluate("!!Chart.getChart('gEvolucao')")


def test_home_usa_novembro_quando_ha_dados(navegador, site_com_novembro):
    page = abrir(navegador, site_com_novembro, "index.html")
    assert page.erros == []
    assert "LIRAa Novembro/2026" in texto(page, "#destaque")
    assert "Levantamento principal" in texto(page, "#destaque")
    assert texto(page, "#avisoFallback") == ""
    # IIP 60/1726 = 3,48% (Risco médio); IB 70/1726 = 4,06 (Alto risco)
    assert re.search(r"3,48%.*Risco médio", texto(page, "#destaque"))
    assert re.search(r"4,06.*Alto risco", texto(page, "#destaque"))


# ---------------- Detalhes ----------------

@pytest.mark.parametrize("chave,tem_dados", [("318-319", True), ("307-308", True), ("288-289", False), ("331-332", False)])
def test_detalhes_com_legenda(navegador, site_atual, chave, tem_dados):
    page = abrir(navegador, site_atual, "levantamento.html?id=" + chave)
    assert page.erros == []
    assert page.locator(".regua").count() >= 2                                   # legenda sempre visível
    if tem_dados:
        assert page.locator(".regua-faixa.atual").count() == 2
        assert page.locator("#tabAreas tbody tr").count() == 48
        assert page.evaluate("!!Chart.getChart('gEstratos')")
    else:
        assert "ainda não tem dados" in texto(page, "#semDados")
        assert page.locator(".regua-faixa.atual").count() == 0


def test_detalhes_ordenacao_e_excel(navegador, site_atual):
    page = abrir(navegador, site_atual, "levantamento.html?id=318-319")
    page.click("#tabAreas th:has-text('IIP')")
    page.click("#tabAreas th:has-text('IIP')")                                   # desc
    primeiro = texto(page, "#tabAreas tbody tr:first-child")
    assert "Vila Aurea" in primeiro and "11,76%" in primeiro and "Alto risco" in primeiro
    with page.expect_download() as d:
        page.click("#btnExcel")
    assert d.value.suggested_filename == "LIRA_318_319.xlsx"


# ---------------- Dashboard ----------------

def test_dashboard_graficos_e_secoes(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")
    assert page.erros == []
    for canvas in ["gEvolucao", "gVariacao", "gComp", "gPesq", "gPos"]:
        assert page.evaluate(f"!!Chart.getChart('{canvas}')"), canvas
    # evolução: IIP e IB, 2 levantamentos com dados (maio e agosto)
    cfg = page.evaluate("(() => { const c = Chart.getChart('gEvolucao'); return {l: c.data.labels, d: c.data.datasets.map(d => d.data)}; })()")
    assert cfg["l"] == ["Maio/2026", "Agosto/2026"]
    assert cfg["d"] == [[5.34, 1.39], [5.34, 1.39]]
    # variação entre ciclos: 1,39 − 5,34 = −3,95
    assert page.evaluate("Chart.getChart('gVariacao').data.datasets[0].data") == [-3.95]
    # legenda oficial presente e destacando o resultado atual
    assert page.locator("#legendas .regua-faixa.atual").count() == 2
    assert "Resultado atual" in texto(page, "#legendas")
    # KPIs: imóveis pesquisados e positivos
    kpis = texto(page, "#kpis")
    assert "1.726" in kpis and "24" in kpis and "1,39%" in kpis and "Risco médio" in kpis
    # ranking e criadouros
    assert page.locator("#listaRanking .rank-item").count() == 10
    assert texto(page, "#listaRanking .rank-item:first-child").startswith("1 Vila Aurea")
    assert "Depósito móvel" in texto(page, "#listaCriadouros .criadouro:first-child")     # B é o principal em agosto
    # tabela histórica completa: 4 levantamentos (2 sem dados sinalizados)
    linhas = page.locator("#tabHist tbody tr")
    assert linhas.count() == 4
    assert texto(page, "#tabHist").count("Sem dados") == 2
    assert "Janeiro/2026" in texto(page, "#tabHist") and "Novembro/2026" in texto(page, "#tabHist")


def test_dashboard_filtros(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")

    # Ciclo 163 -> só agosto
    page.select_option("#fCiclo", "163")
    assert "1 de 2 levantamento(s) com dados" in texto(page, "#contagem")
    assert page.evaluate("Chart.getChart('gEvolucao').data.labels") == ["Agosto/2026"]
    assert "só há um levantamento" in texto(page, "#vazioVar").lower()
    page.click("#btnLimpar")
    assert "2 de 2" in texto(page, "#contagem")

    # Ciclo não informado -> só maio
    page.select_option("#fCiclo", "ni")
    assert page.evaluate("Chart.getChart('gEvolucao').data.labels") == ["Maio/2026"]
    page.click("#btnLimpar")

    # Período: apenas julho a setembro
    page.fill("#fDe", "2026-07-01"); page.fill("#fAte", "2026-09-30")
    assert page.evaluate("Chart.getChart('gEvolucao').data.labels") == ["Agosto/2026"]
    page.fill("#fDe", "2026-12-01"); page.fill("#fAte", "")
    assert page.is_visible("#semResultado") and not page.is_visible("#painel")
    page.click("#btnLimpar")
    assert page.is_visible("#painel")

    # Estrato 1: IIP 0,88% (agosto) / 7,59% (maio)
    page.select_option("#fEstrato", "Estrato 1")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets[0].data") == [7.59, 0.88]
    assert "0,88%" in texto(page, "#kpis") and "Baixo risco" in texto(page, "#kpis")
    assert "Baixo risco" in texto(page, "#legendas .regua-faixa.atual")
    assert page.locator("#listaRanking .rank-item").count() == 10 and "Estrato 1" in texto(page, "#listaRanking")

    # Bairro: 434 - Vila Aurea (agosto: 4 de 34 = 11,76% -> Alto risco)
    page.click("#btnLimpar")
    page.select_option("#fBairro", "434")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets[0].data") == [26.32, 11.76]
    assert "11,76%" in texto(page, "#kpis") and "Alto risco" in texto(page, "#kpis")
    assert "Bairro: Vila Aurea" in texto(page, "#chips")
    # remover o filtro pelo chip
    page.click("#chips button")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets[0].data") == [5.34, 1.39]

    # trocar levantamento em foco e comparação
    page.select_option("#fFoco", "307-308")
    assert "5,34%" in texto(page, "#kpis") and "Alto risco" in texto(page, "#kpis")
    page.select_option("#fComp", "none")
    assert "vs" not in texto(page, "#kpis").lower()
    assert page.erros == []


def test_dashboard_tabela_historica_ordena_e_abas(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")
    page.click("#tabHist th:has-text('IIP') >> nth=0")
    page.click("#tabHist th:has-text('IIP') >> nth=0")
    # as linhas sem dados ficam por último ao ordenar por IIP
    assert "Sem dados" in texto(page, "#tabHist tbody tr:last-child")
    page.click("#tabBai")
    assert page.locator("#tabHist tbody tr").count() == 49                        # município + 48 bairros
    assert "Município (total geral)" in texto(page, "#tabHist tbody tr:first-child")
    page.select_option("#fEstrato", "Estrato 2")
    assert page.locator("#tabHist tbody tr").count() == 13                        # município + 12 (inclui Santa Izabel)
    with page.expect_download() as d:
        page.click("#btnCsv")
    assert d.value.suggested_filename == "lira-historico-bairros.csv"


def test_dashboard_com_tres_levantamentos(navegador, site_com_novembro):
    page = abrir(navegador, site_com_novembro, "dashboard.html")
    assert page.erros == []
    assert len(page.evaluate("Chart.getChart('gVariacao').data.datasets[0].data")) == 2
    assert page.evaluate("Chart.getChart('gEvolucao').data.labels") == ["Maio/2026", "Agosto/2026", "Novembro/2026"]
    assert "Novembro/2026" in texto(page, "#fFoco")


# ---------------- responsivo ----------------

@pytest.mark.parametrize("largura", [360, 390, 768, 1280])
@pytest.mark.parametrize("pagina", ["index.html", "dashboard.html", "levantamento.html", "levantamento.html?id=331-332"])
def test_sem_rolagem_horizontal(navegador, site_atual, pagina, largura):
    page = abrir(navegador, site_atual, pagina, largura)
    assert page.evaluate("document.documentElement.scrollWidth") <= largura
    assert page.erros == []


def test_menu_inferior_no_celular_e_tema(navegador, site_atual):
    page = abrir(navegador, site_atual, "index.html", 390, 800)
    nav = page.locator(".nav-principal")
    box = nav.bounding_box()
    assert box["y"] + box["height"] >= 799                                         # barra fixa no rodapé
    page.click("#btnTema")
    assert page.evaluate("document.documentElement.getAttribute('data-theme')") in ("dark", "light")
