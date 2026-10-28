"""Recuperação de janeiro, configuração de novembro, janela e idempotência."""
import json
import os
import re
import shutil
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest
import yaml

import lira_scraper as ls

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TZ = timezone(timedelta(hours=-4))


def area_falsa(id_area, positivos=2, imoveis=40):
    d = {c: 0 for c in ls.COLUNAS if c != "AREA"}
    d.update(AREA=f"{id_area} - AREA TESTE", Total_Imoveis=imoveis, Residencia=30, Total_Aegypti=positivos,
             Total_Imoveis_Aegypti=positivos, B=positivos, Tubitos=positivos)
    return d


@pytest.fixture
def ambiente(tmp_path, monkeypatch):
    """Diretório de dados isolado (cópia do histórico real) + eVisita simulado."""
    dados = tmp_path / "data"
    dados.mkdir()
    shutil.copy(os.path.join(RAIZ, "data", "history.json"), dados / "history.json")
    monkeypatch.setattr(ls, "DIR_DADOS", str(dados))

    visitadas = []
    vazio = {"ligado": False}

    def processar(driver, areas, nome, alvo):
        url = ls.montar_url(areas[0], alvo["semana_inicio"], alvo["semana_fim"],
                            id_atividade=alvo["id_atividade"], id_ano=alvo["id_ano"], id_ciclo=alvo["id_ciclo"])
        visitadas.append((alvo["chave"], url))
        return [area_falsa(a, 0, 0) if vazio["ligado"] else area_falsa(a) for a in areas]
        # (valores de TESTE; nunca gravados no repositório)

    monkeypatch.setattr(ls, "processar_estrato", processar)

    class Drv:
        fechado = False
        def quit(self): Drv.fechado = True

    ctx = type("Ctx", (), {"dados": dados, "visitadas": visitadas, "vazio": vazio, "driver": Drv})
    return ctx


def rodar(args=(), agora=None):
    return ls.executar(ls.ler_argumentos(list(args)), criar=lambda: ambiente_driver(), login=lambda d: None,
                       agora=agora or datetime(2026, 11, 3, 3, 5, tzinfo=TZ))


def ambiente_driver():
    class D:
        def quit(self): pass
    return D()


def ler(ambiente, nome):
    return json.loads((ambiente.dados / nome).read_text(encoding="utf-8"))


def test_urls_exatas_de_janeiro_e_novembro():
    jan = ls.montar_url(1236, 288, 289, id_atividade=1, id_ano=14, id_ciclo=160)
    nov = ls.montar_url(1236, 331, 332, id_atividade=1, id_ano=14, id_ciclo=165)
    assert "&id_atividade=1&id_ano=14&id_ciclo=160&semana_inicio=288&semana_fim=289" in jan
    assert "&id_atividade=1&id_ano=14&id_ciclo=165&semana_inicio=331&semana_fim=332" in nov


def test_config_novembro_e_home():
    cfg = ls.carregar_config()
    por = {l["chave"]: l for l in cfg["levantamentos"]}
    assert cfg["home"] == "331-332"
    assert (por["331-332"]["id_ano"], por["331-332"]["id_ciclo"], por["331-332"]["semana_inicio"], por["331-332"]["semana_fim"]) == (14, 165, 331, 332)
    assert por["331-332"]["coleta"] == "automatica"
    assert (por["288-289"]["id_ano"], por["288-289"]["id_ciclo"], por["288-289"]["semana_inicio"], por["288-289"]["semana_fim"]) == (14, 160, 288, 289)
    assert por["288-289"]["coleta"] == "recuperacao_unica"


def test_janeiro_roda_uma_unica_vez(ambiente):
    antes = ler(ambiente, "history.json")
    assert rodar() == 0
    h1 = ler(ambiente, "history.json")
    est = ler(ambiente, "estado_coleta.json")

    # recuperou janeiro e coletou novembro, com os parâmetros pedidos
    assert set(h1) == {"288-289", "307-308", "318-319", "331-332"}
    urls = dict(ambiente.visitadas)
    assert "id_ciclo=160&semana_inicio=288&semana_fim=289" in urls["288-289"]
    assert "id_ciclo=165&semana_inicio=331&semana_fim=332" in urls["331-332"]
    assert h1["288-289"]["id_ciclo"] == 160 and h1["331-332"]["id_ciclo"] == 165
    assert "288-289" in est["unicas"]

    # dados históricos preservados byte a byte
    assert h1["307-308"] == antes["307-308"] and h1["318-319"] == antes["318-319"]

    # segunda execução (e terceira): janeiro NÃO é coletado de novo; sem duplicar
    ambiente.visitadas.clear()
    assert rodar(agora=datetime(2026, 11, 3, 12, 5, tzinfo=TZ)) == 0
    assert rodar(agora=datetime(2026, 11, 4, 3, 5, tzinfo=TZ)) == 0
    assert {c for c, _ in ambiente.visitadas} == {"331-332"}
    h2 = ler(ambiente, "history.json")
    assert list(h2) == list(h1) and len(h2) == 4
    assert len(h2["331-332"]["estratos"]["Estrato 1"]["areas"]) == 12      # áreas não duplicam
    assert h2["288-289"] == h1["288-289"]                                    # janeiro intacto


def test_rotulos_de_semana_de_janeiro_e_novembro(ambiente):
    rodar()
    h = ler(ambiente, "history.json")
    assert h["288-289"]["semana_exibicao"]["rotulo"] == "SE 2-3/2026"
    assert h["331-332"]["semana_exibicao"]["rotulo"] == "SE 45-46/2026"
    assert h["288-289"]["periodo_origem"].startswith("id da semana")          # sinalizado como estimativa
    assert h["288-289"]["periodo"]["inicio"].startswith("2026-01")


def test_sem_dados_no_evisita_nao_grava_nem_conclui(ambiente):
    ambiente.vazio["ligado"] = True
    assert rodar() == 0
    h = ler(ambiente, "history.json")
    assert "288-289" not in h and "331-332" not in h                          # nada de registro zerado
    est = ler(ambiente, "estado_coleta.json")
    assert est["unicas"] == {}                                                # janeiro continua pendente
    assert est["execucoes"]["331-332"]["resultado"] == "sem_dados"

    ambiente.vazio["ligado"] = False                                          # dados aparecem depois
    assert rodar(agora=datetime(2026, 11, 3, 12, 5, tzinfo=TZ)) == 0
    assert "288-289" in ler(ambiente, "history.json")


def test_erro_em_um_levantamento_nao_perde_os_outros(ambiente, monkeypatch):
    original = ls.processar_estrato

    def quebra_janeiro(driver, areas, nome, alvo):
        if alvo["chave"] == "288-289":
            raise RuntimeError("falha simulada")
        return original(driver, areas, nome, alvo)

    monkeypatch.setattr(ls, "processar_estrato", quebra_janeiro)
    assert rodar() == 1
    h = ler(ambiente, "history.json")
    assert "331-332" in h and "288-289" not in h
    assert ler(ambiente, "estado_coleta.json")["unicas"] == {}                # tenta de novo na próxima


def test_excel_so_do_levantamento_principal(ambiente):
    rodar()
    assert (ambiente.dados / "LIRA_COMPLETO_latest.xlsx").exists()
    xls = pd.ExcelFile(ambiente.dados / "LIRA_COMPLETO_latest.xlsx")
    assert xls.sheet_names == ["Estrato_1", "Estrato_2", "Estrato_3", "Estrato_4", "Total_Geral"]


# ---------------- janela e agendamento ----------------

@pytest.mark.parametrize("quando,esperado", [
    (datetime(2026, 11, 2, 23, 59, tzinfo=TZ), False),
    (datetime(2026, 11, 3, 0, 0, tzinfo=TZ), True),
    (datetime(2026, 11, 3, 3, 0, tzinfo=TZ), True),
    (datetime(2026, 11, 9, 12, 0, tzinfo=TZ), True),
    (datetime(2026, 11, 15, 23, 59, tzinfo=TZ), True),
    (datetime(2026, 11, 16, 0, 0, tzinfo=TZ), False),
    (datetime(2027, 11, 5, 3, 0, tzinfo=TZ), False),
    # instantes em UTC convertidos para Ponta Porã (UTC−4)
    (datetime(2026, 11, 16, 3, 30, tzinfo=timezone.utc), True),    # 15/11 23:30 local
    (datetime(2026, 11, 3, 2, 59, tzinfo=timezone.utc), False),    # 02/11 22:59 local
    (datetime(2026, 11, 3, 7, 0, tzinfo=timezone.utc), True),      # 03/11 03:00 local
])
def test_janela_03_a_15_de_novembro(quando, esperado):
    assert ls.dentro_da_janela(quando, ls.carregar_config()) is esperado


def test_respeitar_janela_nao_coleta_fora(ambiente):
    ls_args = ls.ler_argumentos(["--respeitar-janela"])
    assert ls.executar(ls_args, criar=ambiente_driver, login=lambda d: None, agora=datetime(2026, 12, 1, 3, 0, tzinfo=TZ)) == 0
    assert ambiente.visitadas == []
    assert ls.executar(ls_args, criar=ambiente_driver, login=lambda d: None, agora=datetime(2026, 11, 5, 12, 0, tzinfo=TZ)) == 0
    assert ambiente.visitadas != []


def test_workflow_cron_e_horarios_locais():
    with open(os.path.join(RAIZ, ".github", "workflows", "lira.yml"), encoding="utf-8") as f:
        wf = yaml.safe_load(f)
    crons = [s["cron"] for s in wf[True]["schedule"]]
    assert crons == ["0 7,16 3-15 11 *"]
    minuto, horas, dias, mes, _ = crons[0].split()
    assert minuto == "0" and mes == "11"

    disparos = []
    d = datetime(2026, 1, 1, tzinfo=timezone.utc)
    while d.year == 2026:
        if d.month == 11 and 3 <= d.day <= 15 and d.hour in (7, 16) and d.minute == 0:
            disparos.append(d)
        d += timedelta(hours=1)
    locais = [x.astimezone(TZ) for x in disparos]
    assert len(locais) == 26                                                    # 13 dias × 2
    assert {x.hour for x in locais} == {3, 12}                                  # madrugada e almoço
    assert min(locais).date().isoformat() == "2026-11-03" and max(locais).date().isoformat() == "2026-11-15"
    assert all(ls.dentro_da_janela(x, ls.carregar_config()) for x in locais)

    passos = wf["jobs"]["atualizar"]["steps"]
    run = next(p for p in passos if p.get("name", "").startswith("Rodar scraper"))
    assert "schedule" in run["env"]["ARGS_JANELA"] and "--respeitar-janela" in run["env"]["ARGS_JANELA"]
    assert wf["concurrency"]["cancel-in-progress"] is False                     # sem execuções simultâneas
