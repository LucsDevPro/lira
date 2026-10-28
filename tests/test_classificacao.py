import json
import os

import pytest

from classificacao import carregar_regras, classificar, calcular_indice, arredondar

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.mark.parametrize("valor,esperado", [
    (0, "baixo"), (0.99, "baixo"),
    (1.0, "medio"), (1.39, "medio"), (3.9, "medio"),
    (3.91, "alto"), (4.0, "alto"), (5.34, "alto"), (11.76, "alto"),
])
def test_faixas_iip(valor, esperado):
    assert classificar("iip", valor)["id"] == esperado


def test_iip_1_39_e_risco_medio():
    f = classificar("iip", 1.39)
    assert f["rotulo"] == "Risco médio"
    assert f["nome_oficial"] == "Alerta"


def test_ib_1_39_e_risco_medio():
    assert classificar("ib", 1.39)["rotulo"] == "Risco médio"


def test_valor_vazio():
    assert classificar("iip", None) is None
    assert calcular_indice(5, 0) is None


def test_limites_oficiais_do_iip():
    faixas = carregar_regras()["indices"]["iip"]["faixas"]
    assert [f["nome_oficial"] for f in faixas] == ["Satisfatório", "Alerta", "Risco"]
    assert faixas[0]["limite_superior"] == 1.0 and not faixas[0]["superior_inclusivo"]
    assert faixas[1]["limite_superior"] == 3.9 and faixas[1]["superior_inclusivo"]
    assert faixas[2]["limite_superior"] is None
    assert carregar_regras()["indices"]["iip"]["oficial"] is True


def test_ib_usa_as_mesmas_faixas_do_iip():
    ind = carregar_regras()["indices"]
    for fi, fb in zip(ind["iip"]["faixas"], ind["ib"]["faixas"]):
        assert (fi["id"], fi["limite_superior"], fi["superior_inclusivo"], fi["nome_oficial"]) == \
               (fb["id"], fb["limite_superior"], fb["superior_inclusivo"], fb["nome_oficial"])
    assert ind["iip"]["oficial"] is True and ind["ib"]["mesmas_faixas_do_iip"] is True


def test_dados_reais_batem_com_a_classificacao():
    with open(os.path.join(RAIZ, "data", "history.json"), encoding="utf-8") as f:
        h = json.load(f)
    tg = h["318-319"]["total_geral"]
    iip = calcular_indice(tg["Total_Imoveis_Aegypti"], tg["Total_Imoveis"])
    ib = calcular_indice(tg["Total_Aegypti"], tg["Total_Imoveis"])
    assert arredondar(iip) == 1.39 == tg["IIP"]
    assert arredondar(ib) == 1.39
    assert classificar("iip", iip)["rotulo"] == "Risco médio"
    assert classificar("ib", ib)["rotulo"] == "Risco médio"
