# -*- coding: utf-8 -*-
"""
Gera docs/assets/data/lira-data.js a partir de:

  - data/history.json            (todos os levantamentos já coletados)
  - config_levantamentos.json    (levantamentos previstos, home, janela)
  - regras_classificacao.json    (regras ÚNICAS de classificação IIP/IB)
  - data/estado_coleta.json      (estado das coletas, opcional)

As páginas do site (docs/index.html, dashboard.html, levantamento.html) são
estáticas e leem esse arquivo. Nenhum valor coletado é alterado aqui:
só se acrescentam metadados (rótulo de semana, período, avisos de dados
ausentes). Levantamentos configurados que ainda não têm dados entram na
lista com status "sem_dados" — nunca com números inventados.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

from semana_util import semana_exibicao_por_week_id, periodo_de_exibicao

DIR_BASE = os.path.dirname(os.path.abspath(__file__))
HISTORY_PATH = os.environ.get("LIRA_HISTORY", os.path.join(DIR_BASE, "data", "history.json"))
ESTADO_PATH = os.environ.get("LIRA_ESTADO", os.path.join(DIR_BASE, "data", "estado_coleta.json"))
CONFIG_PATH = os.path.join(DIR_BASE, "config_levantamentos.json")
REGRAS_PATH = os.path.join(DIR_BASE, "regras_classificacao.json")
OUTPUT_PATH = os.environ.get("LIRA_OUTPUT", os.path.join(DIR_BASE, "docs", "assets", "data", "lira-data.js"))

TZ_MS = timezone(timedelta(hours=-4))

# Campos esperados no total geral; se faltar algum, vira aviso de "dado ausente".
CAMPOS_ESPERADOS = [
    "Total_Imoveis", "Total_Imoveis_Aegypti", "Total_Aegypti", "Tubitos",
    "A1", "A2", "B", "C", "D1", "D2", "E", "Total_Imoveis_Albopictus",
]


def carregar(caminho, padrao):
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    return padrao


def calcular_iip(total_imoveis_aegypti, total_imoveis):
    if not total_imoveis:
        return 0.0
    return round((total_imoveis_aegypti / total_imoveis) * 100, 2)


def completar_iip(snap):
    """Só preenche o IIP quando o registro não traz (não sobrescreve nada)."""
    for bloco in snap["estratos"].values():
        t = bloco["total"]
        if "IIP" not in t:
            t["IIP"] = calcular_iip(t.get("Total_Imoveis_Aegypti", 0), t.get("Total_Imoveis", 0))
    tg = snap["total_geral"]
    if "IIP" not in tg:
        tg["IIP"] = calcular_iip(tg.get("Total_Imoveis_Aegypti", 0), tg.get("Total_Imoveis", 0))


def codigo_area(nome):
    m = re.match(r"\s*(\d+)\s*-", nome or "")
    return m.group(1) if m else ""


def reagrupar_estratos(estratos, sobrescritas):
    """
    Move áreas para o estrato correto (config "areas_estrato") e refaz os
    totais dos estratos SOMANDO os valores originais das áreas. Nenhum valor
    de área é alterado, e o total geral não muda.
    """
    sobrescritas = {k: v for k, v in (sobrescritas or {}).items() if not k.startswith("_")}
    if not sobrescritas:
        return estratos

    nomes = sorted(estratos)
    novos = {n: [] for n in nomes}
    for nome, bloco in estratos.items():
        for area in bloco["areas"]:
            destino = sobrescritas.get(codigo_area(area.get("AREA")), nome)
            novos[destino if destino in novos else nome].append(area)

    saida = {}
    for nome in nomes:
        areas = novos[nome]
        modelo = estratos[nome]["total"]
        total = {"AREA": modelo.get("AREA", f"TOTAL {nome.upper()}")}
        for campo, valor in modelo.items():
            if campo in ("AREA", "IIP"):
                continue
            if isinstance(valor, (int, float)):
                total[campo] = sum(a.get(campo, 0) or 0 for a in areas)
        total["IIP"] = calcular_iip(total.get("Total_Imoveis_Aegypti", 0), total.get("Total_Imoveis", 0))
        saida[nome] = {"areas": areas, "total": total}
    return saida


def enriquecer(chave, snap, lev):
    """Acrescenta metadados ao registro (sem tocar nos valores coletados)."""
    completar_iip(snap)
    ausentes = []

    exib = snap.get("semana_exibicao")
    if exib and "rotulo" in exib:
        periodo = snap.get("periodo") or periodo_de_exibicao(exib)
        origem = snap.get("periodo_origem", "data da coleta")
    else:
        exib, periodo = semana_exibicao_por_week_id(snap["semana_inicio"], snap["semana_fim"])
        origem = "id da semana (estimado)"

    id_ciclo = snap.get("id_ciclo", lev.get("id_ciclo") if lev else None)
    id_ano = snap.get("id_ano", lev.get("id_ano") if lev else None)
    for campo in CAMPOS_ESPERADOS:
        if campo not in snap["total_geral"]:
            ausentes.append(f"campo {campo} ausente")
    if lev and lev.get("observacao"):
        ausentes.append(lev["observacao"])

    nome = (lev or {}).get("nome")
    return {
        "chave": chave,
        "nome": nome,
        "mes": (lev or {}).get("mes") or periodo["inicio"][:7],
        "status": "com_dados",
        "semana_inicio": str(snap["semana_inicio"]),
        "semana_fim": str(snap["semana_fim"]),
        "id_ciclo": id_ciclo,
        "id_ano": id_ano,
        "coleta": (lev or {}).get("coleta", "somente_historico"),
        "coletado_em": snap.get("gerado_em"),
        "semana_exibicao": exib,
        "periodo": periodo,
        "periodo_origem": origem,
        "ausentes": ausentes,
        "estratos": reagrupar_estratos(snap["estratos"], SOBRESCRITAS_ESTRATO),
        "total_geral": snap["total_geral"],
    }


def pendente(lev, estado):
    exib, periodo = semana_exibicao_por_week_id(
        lev["semana_inicio"], lev["semana_fim"], lev.get("se_inicio"))
    ex = estado.get("execucoes", {}).get(lev["chave"], {})
    if lev["coleta"] == "recuperacao_unica":
        motivo = "Aguardando coleta de dados."
    elif lev["coleta"] == "automatica":
        motivo = "Aguardando coleta de dados."
    else:
        motivo = "Sem dados no histórico."
    return {
        "chave": lev["chave"],
        "nome": lev.get("nome"),
        "mes": lev.get("mes") or periodo["inicio"][:7],
        "status": "sem_dados",
        "semana_inicio": str(lev["semana_inicio"]),
        "semana_fim": str(lev["semana_fim"]),
        "id_ciclo": lev.get("id_ciclo"),
        "id_ano": lev.get("id_ano"),
        "coleta": lev["coleta"],
        "coletado_em": None,
        "semana_exibicao": exib,
        "periodo": periodo,
        "periodo_origem": "id da semana (estimado)",
        "ausentes": [motivo],
        "ultima_tentativa": ex or None,
        "estratos": None,
        "total_geral": None,
    }


SOBRESCRITAS_ESTRATO = {}


def montar_dados():
    global SOBRESCRITAS_ESTRATO
    config = carregar(CONFIG_PATH, {"levantamentos": []})
    SOBRESCRITAS_ESTRATO = config.get("areas_estrato", {})
    historico = carregar(HISTORY_PATH, {})
    estado = carregar(ESTADO_PATH, {})
    regras = carregar(REGRAS_PATH, {})

    por_chave_cfg = {l["chave"]: l for l in config.get("levantamentos", [])}
    lista = []

    for chave, snap in historico.items():
        lista.append(enriquecer(chave, snap, por_chave_cfg.get(chave)))

    for chave, lev in por_chave_cfg.items():
        if chave not in historico:
            lista.append(pendente(lev, estado))

    lista.sort(key=lambda l: int(l["semana_inicio"]))

    for l in lista:
        if not l["nome"]:
            ano, mes = l["mes"].split("-")
            meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
                     "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
            l["nome"] = f"{meses[int(mes) - 1]}/{ano}"

    return {
        "gerado_em": datetime.now(TZ_MS).isoformat(),
        "municipio": config.get("municipio", {}),
        "fuso_horario": config.get("fuso_horario", {}),
        "automacao": config.get("automacao", {}),
        "home": config.get("home"),
        "regras": regras,
        "levantamentos": lista,
    }


def main():
    dados = montar_dados()
    if not any(l["status"] == "com_dados" for l in dados["levantamentos"]):
        raise SystemExit(
            f"Não encontrei nenhum dado em {HISTORY_PATH}. "
            "Rode lira_scraper.py ou importar_xlsx_historico.py primeiro."
        )

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("/* Gerado por generate_dashboard.py — não editar à mão. */\n")
        f.write("window.LIRA_DATA = ")
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    com = sum(1 for l in dados["levantamentos"] if l["status"] == "com_dados")
    sem = len(dados["levantamentos"]) - com
    print(f"Dados do site gerados em {OUTPUT_PATH}: {com} levantamento(s) com dados, {sem} sem dados.")


if __name__ == "__main__":
    main()
