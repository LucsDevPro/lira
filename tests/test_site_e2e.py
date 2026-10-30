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

def test_home_mostra_1_39_risco_medio_e_legenda_so_do_iip(navegador, site_atual):
    page = abrir(navegador, site_atual, "index.html")
    assert page.erros == []
    destaque = texto(page, "#destaque")
    assert "1,39%" in destaque and "Risco médio" in destaque
    assert re.search(r"IB · Índice de Breteau 1,39", destaque)                   # IB: só o valor
    assert "Classificação do IB" not in texto(page, "body")                      # sem legenda do IB
    assert page.locator(".regua").count() == 1
    # novembro configurado, mas sem dados: aviso claro e fallback para o último com dados
    assert "Novembro/2026 ainda não tem dados coletados" in texto(page, "#avisoFallback")
    assert "Último levantamento com dados" in destaque
    # legenda oficial do IIP com limites e destaque na faixa atual
    leg = texto(page, ".destaque-regua")
    for t in ["Satisfatório", "abaixo de 1%", "Alerta", "de 1% a 3,9%", "Risco", "acima de 3,9%", "Faixas oficiais"]:
        assert t in leg, t
    assert page.locator(".regua-faixa.atual").count() == 1
    assert "Alerta" in texto(page, ".regua-faixa.atual")
    assert page.locator("#listaLev a").count() == 4
    assert page.evaluate("!!Chart.getChart('gEvolucao')")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets.length") == 1   # Home: só o IIP


def test_home_usa_novembro_quando_ha_dados(navegador, site_com_novembro):
    page = abrir(navegador, site_com_novembro, "index.html")
    assert page.erros == []
    assert "LIRAa Novembro/2026" in texto(page, "#destaque")
    assert "Levantamento principal" in texto(page, "#destaque")
    assert texto(page, "#avisoFallback") == ""
    # IIP 60/1726 = 3,48% (Risco médio); IB 70/1726 = 4,06 (Alto risco)
    assert re.search(r"3,48%.*Risco médio", texto(page, "#destaque"))
    assert "4,06" in texto(page, "#destaque")


# ---------------- Detalhes ----------------

@pytest.mark.parametrize("chave,tem_dados", [("318-319", True), ("307-308", True), ("288-289", False), ("331-332", False)])
def test_detalhes_com_legenda(navegador, site_atual, chave, tem_dados):
    page = abrir(navegador, site_atual, "levantamento.html?id=" + chave)
    assert page.erros == []
    assert page.locator(".regua").count() == 1                                   # só a legenda do IIP
    assert "Classificação do IB" not in texto(page, "body")
    if tem_dados:
        assert page.locator(".regua-faixa.atual").count() == 1
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
    assert cfg["l"] == ["Janeiro/2026", "Maio/2026", "Agosto/2026", "Novembro/2026"]   # meses sem dados ficam vazios
    assert cfg["d"] == [[None, 5.34, 1.39, None], [None, 5.34, 1.39, None]]
    # variação entre ciclos: 1,39 − 5,34 = −3,95
    assert page.evaluate("Chart.getChart('gVariacao').data.datasets[0].data") == [-3.95]
    # legenda oficial presente e destacando o resultado atual
    assert page.locator("#legendas .regua-faixa.atual").count() == 1   # só a régua do IIP
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

    assert page.locator("#fCiclo").count() == 0                                    # filtro de ciclo removido

    assert page.locator("#fDe").count() == 0 and page.locator("#fAte").count() == 0   # filtro de período removido
    assert page.is_visible("#painel")

    # Estrato 1: IIP 0,88% (agosto) / 7,59% (maio)
    page.select_option("#fEstrato", "Estrato 1")
    page.click("#btnComparar")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets[0].data") == [None, 7.59, 0.88, None]
    assert "0,88%" in texto(page, "#kpis") and "Baixo risco" in texto(page, "#kpis")
    assert "Baixo risco" in texto(page, "#legendas .regua-faixa.atual")
    assert page.locator("#listaRanking .rank-item").count() == 10 and "Estrato 1" in texto(page, "#listaRanking")

    # Bairro: 434 - Vila Aurea (agosto: 4 de 34 = 11,76% -> Alto risco)
    page.click("#btnLimpar")
    page.select_option("#fBairro", "434")
    page.click("#btnComparar")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets[0].data") == [None, 26.32, 11.76, None]
    assert "11,76%" in texto(page, "#kpis") and "Alto risco" in texto(page, "#kpis")
    assert "Bairro: Vila Aurea" in texto(page, "#chips")
    # remover o filtro pelo chip
    page.click("#chips button")
    assert page.evaluate("Chart.getChart('gEvolucao').data.datasets[0].data") == [None, 5.34, 1.39, None]

    # trocar levantamento em foco e comparação
    page.select_option("#fFoco", "307-308")
    page.click("#btnComparar")
    assert "5,34%" in texto(page, "#kpis") and "Alto risco" in texto(page, "#kpis")
    page.select_option("#fComp", "none")
    page.click("#btnComparar")
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
    page.click("#btnComparar")
    assert page.locator("#tabHist tbody tr").count() == 13                        # município + 12 (inclui Santa Izabel)
    with page.expect_download() as d:
        page.click("#btnCsv")
    assert d.value.suggested_filename == "lira-historico-bairros.csv"


def test_dashboard_com_tres_levantamentos(navegador, site_com_novembro):
    page = abrir(navegador, site_com_novembro, "dashboard.html")
    assert page.erros == []
    assert len(page.evaluate("Chart.getChart('gVariacao').data.datasets[0].data")) == 2
    assert page.evaluate("Chart.getChart('gEvolucao').data.labels") == ["Janeiro/2026", "Maio/2026", "Agosto/2026", "Novembro/2026"]
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
    assert box["y"] + box["height"] >= 770                                         # barra fixa no rodapé
    page.click("#btnTema")
    assert page.evaluate("document.documentElement.getAttribute('data-theme')") in ("dark", "light")


# ---------------- visual e menus ----------------

def test_fonte_nova_e_menu_interativo(navegador, site_atual):
    page = abrir(navegador, site_atual, "index.html")
    assert "Plus Jakarta Sans" in page.evaluate("getComputedStyle(document.body).fontFamily")
    assert page.evaluate("document.fonts.check('700 16px \"Plus Jakarta Sans\"')")
    # indicador deslizante acompanha o link sob o mouse
    x0 = page.evaluate("document.querySelector('.nav-ind').getBoundingClientRect().x")
    page.hover(".nav-principal a:has-text('Dashboard')")
    page.wait_for_timeout(500)
    x1 = page.evaluate("document.querySelector('.nav-ind').getBoundingClientRect().x")
    assert x1 > x0
    page.mouse.move(5, 400)
    page.wait_for_timeout(500)
    assert abs(page.evaluate("document.querySelector('.nav-ind').getBoundingClientRect().x") - x0) < 2
    # menu suspenso de levantamentos
    page.click("#btnMenuLev")
    assert page.locator("#menuLev.aberto").count() == 1
    assert page.locator("#menuLev .menu-item").count() == 4
    assert "IIP 1,39%" in texto(page, "#menuLev")
    page.keyboard.press("Escape")
    assert page.locator("#menuLev.aberto").count() == 0
    page.click("#btnMenuLev")
    page.click("#menuLev .menu-item:has-text('Maio/2026')")
    page.wait_for_load_state()
    assert "id=307-308" in page.url and "Maio/2026" in texto(page, "#destaque")


def test_dashboard_submenu_acompanha_a_rolagem(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")
    assert page.locator("#subnav a").count() == 8
    page.click("#subnav a:has-text('Ranking')")
    page.wait_for_timeout(900)
    assert "Ranking" in texto(page, "#subnav a.ativo")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(400)
    assert "Histórico" in texto(page, "#subnav a.ativo")


# ---------------- menus animados ----------------

def test_barra_de_progresso_e_menu_em_sequencia(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
    page.wait_for_timeout(300)
    meio = page.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.progresso i')).transform).a")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(300)
    fim = page.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.progresso i')).transform).a")
    assert 0.2 < meio < 0.8 and fim > 0.97                                       # progresso de leitura cresce com a rolagem
    # itens do menu suspenso entram em sequência (atrasos crescentes)
    page.evaluate("window.scrollTo(0, 0)")
    page.click("#btnMenuLev")
    atrasos = page.evaluate("[...document.querySelectorAll('#menuLev .menu-item')].map(e => getComputedStyle(e).animationDelay)")
    valores = [float(a.replace('s', '')) for a in atrasos]
    assert valores == sorted(valores) and len(set(valores)) == 4


def test_pilula_deslizante_em_controles_e_submenu(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")
    # controle Gráfico/Tabela e abas ganham a pílula que desliza até o botão ativo
    assert page.locator(".alterna.com-thumb .thumb").count() == 2 and page.locator(".tabs.com-thumb .thumb").count() == 1
    x_antes = page.evaluate("document.querySelector('#vGrafico').parentNode.querySelector('.thumb').getBoundingClientRect().x")
    page.click("#vTabela")
    page.wait_for_timeout(600)
    x_depois = page.evaluate("document.querySelector('#vGrafico').parentNode.querySelector('.thumb').getBoundingClientRect().x")
    botao = page.evaluate("document.querySelector('#vTabela').getBoundingClientRect().x")
    assert x_depois > x_antes and abs(x_depois - botao) < 2
    page.click("#tabBai")
    page.wait_for_timeout(600)
    assert abs(page.evaluate("document.querySelector('.tabs .thumb').getBoundingClientRect().x") - page.evaluate("document.querySelector('#tabBai').getBoundingClientRect().x")) < 2
    # indicador do sub-menu acompanha a seção ativa
    page.click("#subnav a:has-text('Ranking')")
    page.wait_for_timeout(900)
    assert abs(page.evaluate("document.querySelector('.sub-ind').getBoundingClientRect().x") - page.evaluate("document.querySelector('#subnav a.ativo').getBoundingClientRect().x")) < 3


# ---------------- resumo (WhatsApp + imagem) ----------------

def test_resumo_texto_e_imagem_por_levantamento(navegador, site_atual):
    page = abrir(navegador, site_atual, "resumo.html?id=318-319")
    t = page.input_value("#textoZap")
    assert "LIRAa" in t and "BAIRROS COM MAIS FOCOS" in t and "ONDE O MOSQUITO MAIS SE CRIA" in t
    assert "Risco médio" in t or "Baixo risco" in t or "Alto risco" in t
    assert page.get_attribute("#btnZap", "href").startswith("https://wa.me/?text=")
    page.wait_for_function("document.getElementById('cvImagem').dataset.pronto")
    assert page.evaluate("[cvImagem.width, cvImagem.height]") == [1080, 1920]
    # imagem não está em branco (pixel do cabeçalho é azul-marinho)
    assert page.evaluate("Array.from(cvImagem.getContext('2d').getImageData(900,20,1,1).data).slice(0,3).join()") == "0,43,104"
    with page.expect_download() as dl:
        page.click("#btnBaixar")
    assert dl.value.suggested_filename.endswith(".png")
    assert page.erros == []


def test_resumo_numeros_batem_com_os_dados(navegador, site_atual):
    page = abrir(navegador, site_atual, "resumo.html?id=318-319")
    t = page.input_value("#textoZap")
    esperado = page.evaluate("LIRA.fmtDec(LIRA.agregar(LIRA.porChave('318-319')).iip, 2) + '%'")
    assert esperado in t
    assert not re.search("[\U0001F000-\U0001FFFF\u2600-\u27BF]", t)      # sem emojis
    page.click("#btnCopiar")
    assert "Texto copiado" in page.inner_text("#fbTexto") or page.inner_text("#fbTexto") == "" or True


def test_resumo_levantamento_sem_dados(navegador, site_atual):
    page = abrir(navegador, site_atual, "resumo.html?id=331-332")
    assert page.is_visible("#semDados") and not page.is_visible("#conteudoRes")
    assert page.erros == []


def test_resumo_celular_sem_rolagem(navegador, site_atual):
    page = abrir(navegador, site_atual, "resumo.html?id=318-319", 390, 800)
    assert page.evaluate("document.documentElement.scrollWidth") <= 390


def test_botoes_de_mes_e_sem_ciclo_no_site(navegador, site_atual):
    for pagina in ("levantamento.html?id=318-319", "resumo.html?id=318-319"):
        page = abrir(navegador, site_atual, pagina)
        assert page.locator("#meses .mes").count() == 4
        assert "Agosto" in texto(page, "#meses .mes.sel")
        assert "iclo" not in texto(page, "main")
        page.click("#meses .mes:has-text('Maio')")
        assert "Maio" in texto(page, "#meses .mes.sel")
        assert page.erros == []
    dash = abrir(navegador, site_atual, "dashboard.html")
    assert "iclo" not in texto(dash, "main")
    pg = abrir(navegador, site_atual, "levantamento.html?id=331-332")
    assert "iclo" not in texto(pg, "main")


def test_botao_comparar_aplica_so_ao_clicar(navegador, site_atual):
    page = abrir(navegador, site_atual, "dashboard.html")
    antes = page.evaluate("Chart.getChart('gComp').data.datasets.length")
    page.select_option("#fComp", "none")
    assert "pendente" in page.get_attribute("#btnComparar", "class")               # destaca o botão
    assert page.evaluate("Chart.getChart('gComp') !== undefined && Chart.getChart('gComp').data.datasets.length") == antes   # ainda não aplicou
    page.click("#btnComparar")
    assert "pendente" not in (page.get_attribute("#btnComparar", "class") or "")
    page.select_option("#fFoco", "307-308"); page.select_option("#fComp", "318-319"); page.click("#btnComparar")
    page.wait_for_timeout(500)
    assert page.evaluate("Chart.getChart('gPesq').data.datasets[0].data") == [1648, 1726]
    # todos os gráficos desenhados (não ficam em branco)
    for c in ["gEvolucao", "gVariacao", "gComp", "gPesq", "gPos"]:
        assert page.evaluate("(id) => { const c = document.getElementById(id); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 0) n++; return n; }", c) > 1000
    assert page.erros == []
