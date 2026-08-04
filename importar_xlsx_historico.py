# -*- coding: utf-8 -*-
"""
Importa um arquivo LIRA_COMPLETO_*.xlsx (no formato antigo, com abas
Estrato_1..4 e Total_Geral) para data/history.json, sob a chave
"SEMANA_INICIO-SEMANA_FIM". Se essa chave já existir, ela é sobrescrita
— nenhum arquivo novo é criado.

Uso:
    python importar_xlsx_historico.py ARQUIVO.xlsx SEMANA_INICIO SEMANA_FIM DATA_ISO

Exemplo:
    python importar_xlsx_historico.py LIRA_COMPLETO_307_308.xlsx 307 308 2026-05-18T12:00:00-04:00
"""

import sys
import os
import json
import pandas as pd

from semana_util import par_semanas_epidemiologicas, formatar_ciclo

ESTRATOS = ["Estrato_1", "Estrato_2", "Estrato_3", "Estrato_4"]
CAMINHO_HISTORICO = "data/history.json"


def calcular_iip(total_imoveis_aegypti, total_imoveis):
    if not total_imoveis:
        return 0.0
    return round((total_imoveis_aegypti / total_imoveis) * 100, 2)


def linha_total_dict(df):
    linha = df.iloc[-1].to_dict()
    linha["IIP"] = calcular_iip(
        linha.get("Total_Imoveis_Aegypti", 0), linha.get("Total_Imoveis", 0)
    )
    return linha


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(1)

    caminho_xlsx = sys.argv[1]
    semana_inicio = str(sys.argv[2])
    semana_fim = str(sys.argv[3])
    data_iso = sys.argv[4]

    xls = pd.ExcelFile(caminho_xlsx)

    estratos_dados = {}

    for i, aba in enumerate(ESTRATOS, start=1):
        df = pd.read_excel(xls, aba)
        nome_estrato = f"Estrato {i}"
        estratos_dados[nome_estrato] = {
            "areas": df.iloc[:-1].to_dict(orient="records"),
            "total": linha_total_dict(df),
        }

    df_total = pd.read_excel(xls, "Total_Geral")

    (ano_i, sem_i), (ano_f, sem_f) = par_semanas_epidemiologicas(data_iso)

    snapshot = {
        "gerado_em": data_iso,
        "semana_inicio": semana_inicio,   # week_id — usado só na busca
        "semana_fim": semana_fim,          # week_id — usado só na busca
        "semana_exibicao": {                # week_number — usado só na interface
            "ano_inicio": ano_i, "semana_inicio": sem_i,
            "ano_fim": ano_f, "semana_fim": sem_f,
            "rotulo": formatar_ciclo(data_iso),
        },
        "estratos": estratos_dados,
        "total_geral": linha_total_dict(df_total),
    }

    os.makedirs("data", exist_ok=True)

    if os.path.exists(CAMINHO_HISTORICO):
        with open(CAMINHO_HISTORICO, encoding="utf-8") as f:
            historico = json.load(f)
    else:
        historico = {}

    chave = f"{semana_inicio}-{semana_fim}"
    historico[chave] = snapshot

    with open(CAMINHO_HISTORICO, "w", encoding="utf-8") as f:
        json.dump(historico, f, ensure_ascii=False, indent=2)

    print(f"{CAMINHO_HISTORICO} atualizado (chave: {chave})")


if __name__ == "__main__":
    main()
