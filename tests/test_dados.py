"""Integridade dos dados históricos e do gerador do site."""
import json
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMPOS = ["Total_Imoveis", "Total_Imoveis_Aegypti", "Total_Aegypti", "Tubitos",
          "A1", "A2", "B", "C", "D1", "D2", "E", "Total_Imoveis_Albopictus"]


def historico():
    with open(os.path.join(RAIZ, "data", "history.json"), encoding="utf-8") as f:
        return json.load(f)


def test_total_geral_e_soma_das_areas():
    for chave, snap in historico().items():
        for campo in CAMPOS:
            soma = sum(a.get(campo, 0) for e in snap["estratos"].values() for a in e["areas"])
            assert soma == snap["total_geral"][campo], (chave, campo)


def test_gerador_preserva_dados_e_sinaliza_pendentes(tmp_path):
    saida = tmp_path / "lira-data.js"
    env = dict(os.environ, LIRA_OUTPUT=str(saida))
    subprocess.run([sys.executable, os.path.join(RAIZ, "generate_dashboard.py")], check=True, env=env, cwd=RAIZ)
    txt = saida.read_text(encoding="utf-8")
    dados = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])

    por = {l["chave"]: l for l in dados["levantamentos"]}
    assert list(por) == ["288-289", "307-308", "318-319", "331-332"]      # ordem cronológica
    assert dados["home"] == "331-332"
    assert por["288-289"]["status"] == "sem_dados" and por["331-332"]["status"] == "sem_dados"
    assert por["288-289"]["total_geral"] is None                           # nada inventado
    assert por["288-289"]["id_ciclo"] == 160 and por["331-332"]["id_ciclo"] == 165
    assert por["307-308"]["id_ciclo"] == 162 and por["318-319"]["id_ciclo"] == 163
    assert any("ciclo" in a for a in por["307-308"]["ausentes"])           # ausência sinalizada

    # valores originais intactos
    h = historico()
    for chave in ("307-308", "318-319"):
        assert por[chave]["total_geral"] == h[chave]["total_geral"]
        # áreas (valores originais) intactas; só o agrupamento por estrato foi corrigido (Santa Izabel)
        orig = {a["AREA"]: a for e in h[chave]["estratos"].values() for a in e["areas"]}
        novos = {a["AREA"]: a for e in por[chave]["estratos"].values() for a in e["areas"]}
        assert orig == novos
        assert por[chave]["estratos"]["Estrato 1"] == h[chave]["estratos"]["Estrato 1"]

    # as regras embutidas são as do arquivo central
    with open(os.path.join(RAIZ, "regras_classificacao.json"), encoding="utf-8") as f:
        assert dados["regras"] == json.load(f)


def test_santa_izabel_e_estrato_2_sem_alterar_valores(tmp_path):
    saida = tmp_path / "lira-data.js"
    env = dict(os.environ, LIRA_OUTPUT=str(saida))
    subprocess.run([sys.executable, os.path.join(RAIZ, "generate_dashboard.py")], check=True, env=env, cwd=RAIZ)
    txt = saida.read_text(encoding="utf-8")
    dados = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    h = historico()
    for l in dados["levantamentos"]:
        if l["status"] != "com_dados":
            continue
        est = l["estratos"]
        nomes2 = [a["AREA"] for a in est["Estrato 2"]["areas"]]
        nomes3 = [a["AREA"] for a in est["Estrato 3"]["areas"]]
        assert any(n.startswith("423 - SANTA IZABEL") for n in nomes2)
        assert not any(n.startswith("423 - ") for n in nomes3)
        assert (len(est["Estrato 1"]["areas"]), len(nomes2), len(nomes3), len(est["Estrato 4"]["areas"])) == (12, 12, 12, 12)
        # totais dos estratos = soma das áreas; total geral e valores das áreas intactos
        for bloco in est.values():
            for campo in CAMPOS:
                assert bloco["total"][campo] == sum(a.get(campo, 0) for a in bloco["areas"])
        assert sum(b["total"]["Total_Imoveis"] for b in est.values()) == l["total_geral"]["Total_Imoveis"]
        assert l["total_geral"] == h[l["chave"]]["total_geral"]
        orig = {a["AREA"]: a for e in h[l["chave"]]["estratos"].values() for a in e["areas"]}
        novos = {a["AREA"]: a for e in est.values() for a in e["areas"]}
        assert orig == novos
