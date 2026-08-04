# -*- coding: utf-8 -*-

import os
import re
import sys
import json
import time
from datetime import datetime, timezone, timedelta

import pandas as pd
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from semana_util import par_semanas_epidemiologicas, formatar_ciclo

# =====================================================
# CONFIG GERAL
# =====================================================

URL_BASE = "https://evisita.saude.ms.gov.br/endemias/pncd_v2"

# As credenciais NUNCA ficam escritas aqui. Elas vêm de variáveis de
# ambiente (no GitHub Actions, de "Secrets"; localmente, de um arquivo
# .env carregado antes de rodar o script, ou exportadas no terminal).
USUARIO = os.environ.get("LIRA_USUARIO")
SENHA = os.environ.get("LIRA_SENHA")

ID_MUNICIPIO = 62
ID_REGIAO = 388
ID_ATIVIDADE = 1
ID_ANO = 14
ID_CICLO = 163

# =====================================================
# SEMANA DO CICLO (FIXA)
#
# Definido pelo usuário: sempre que trocar de ciclo/semana no site,
# basta atualizar estes dois valores e enviar (commit/push) a mudança.
# =====================================================

SEMANA_INICIO = "318"
SEMANA_FIM = "319"

# =====================================================
# ÁREAS - ESTRATO 1
# =====================================================

AREAS_ESTRATO_1 = [
    1236, 1237, 1238, 1239,
    1413, 1414, 1415, 1416, 1417, 1418, 1419, 1420
]

# =====================================================
# ÁREAS - ESTRATO 2
# =====================================================

AREAS_ESTRATO_2 = [
    1421, 1422, 1423, 1424, 1425,
    1426, 1427, 1428, 1429, 1430, 1431
]

# =====================================================
# ÁREAS - ESTRATO 3
# =====================================================

AREAS_ESTRATO_3 = [
    1442, 1443, 1444, 1445, 1446, 1447,
    1448, 1449, 1450, 1453, 6971, 6972, 6973
]

# =====================================================
# ÁREAS - ESTRATO 4
# =====================================================

AREAS_ESTRATO_4 = [
    1480, 1481, 1482, 1483, 1484, 1485, 1486,
    2595, 2596, 2597, 6742, 6743
]

HEADLESS = True

# Fuso horário de Mato Grosso do Sul (sem horário de verão desde 2019)
TZ_MS = timezone(timedelta(hours=-4))

# =====================================================
# DRIVER
# =====================================================

def criar_driver():

    options = Options()

    if HEADLESS:
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

    return webdriver.Chrome(options=options)

# =====================================================
# URL
# =====================================================

def montar_url(area, semana_inicio, semana_fim):

    return (
        f"{URL_BASE}?"
        f"id_municipio={ID_MUNICIPIO}&"
        f"id_regiao={ID_REGIAO}&"
        f"id_area={area}&"
        f"id_atividade={ID_ATIVIDADE}&"
        f"id_ano={ID_ANO}&"
        f"id_ciclo={ID_CICLO}&"
        f"semana_inicio={semana_inicio}&"
        f"semana_fim={semana_fim}&"
        f"acao=filtrar"
    )

# =====================================================
# LOGIN
# =====================================================

def fazer_login(driver):

    if not USUARIO or not SENHA:
        raise RuntimeError(
            "Credenciais não encontradas. Defina as variáveis de ambiente "
            "LIRA_USUARIO e LIRA_SENHA (no GitHub, como Secrets do repositório)."
        )

    driver.get(URL_BASE)

    time.sleep(2)

    driver.find_element("name", "cpf").send_keys(USUARIO)
    driver.find_element("name", "password").send_keys(SENHA)
    driver.find_element("css selector", "button[type='submit']").click()

    time.sleep(3)

# =====================================================
# EXTRAÇÃO
# =====================================================

def numero(texto):

    texto = re.sub(r"[^\d]", "", texto)

    return int(texto) if texto else 0

# =====================================================
# EXTRAIR DADOS
# =====================================================

def extrair_dados(html, id_area):

    soup = BeautifulSoup(html, "html.parser")

    dados = {}
    dados["ID_AREA"] = id_area
    dados["AREA"] = f"AREA_{id_area}"

    for tabela in soup.find_all("table"):

        texto = tabela.get_text(" ", strip=True)

        if "Quarteirões trabalhados" in texto:

            strong = tabela.find("strong")

            if strong:
                nome = strong.get_text(strip=True)
                nome = nome.replace(":", "")
                dados["AREA"] = nome

            break

    tabela_principal = soup.find_all("table")[0]
    linhas = tabela_principal.find_all("tr")
    linha = linhas[2].find_all(["td", "th"])

    dados["Residencia"] = numero(linha[0].get_text())
    dados["Comercio"] = numero(linha[1].get_text())
    dados["TB"] = numero(linha[2].get_text())
    dados["Outros"] = numero(linha[3].get_text())
    dados["PE"] = numero(linha[4].get_text())
    dados["Total_Imoveis"] = numero(linha[5].get_text())
    dados["Tubitos"] = numero(linha[13].get_text())

    tabelas = soup.find_all("table")

    for tabela in tabelas:

        texto = tabela.get_text(" ", strip=True)

        if "Nº de depósitos com espécimes" in texto:

            for tr in tabela.find_all("tr"):

                colunas = tr.find_all(["td", "th"])

                if not colunas:
                    continue

                nome = colunas[0].get_text(strip=True)

                if nome == "Aedes aegypti":
                    dados["A1"] = numero(colunas[1].get_text())
                    dados["A2"] = numero(colunas[2].get_text())
                    dados["B"] = numero(colunas[3].get_text())
                    dados["C"] = numero(colunas[4].get_text())
                    dados["D1"] = numero(colunas[5].get_text())
                    dados["D2"] = numero(colunas[6].get_text())
                    dados["E"] = numero(colunas[7].get_text())
                    dados["Total_Aegypti"] = numero(colunas[8].get_text())

        if "Nº de imóveis com espécimes" in texto:

            for tr in tabela.find_all("tr"):

                colunas = tr.find_all(["td", "th"])

                if not colunas:
                    continue

                nome = colunas[0].get_text(strip=True)

                if nome == "Aedes aegypti":
                    dados["Resid_Aegypti"] = numero(colunas[1].get_text())
                    dados["Comercio_Aegypti"] = numero(colunas[2].get_text())
                    dados["TB_Aegypti"] = numero(colunas[3].get_text())
                    dados["Outros_Aegypti"] = numero(colunas[4].get_text())
                    dados["Total_Imoveis_Aegypti"] = numero(colunas[5].get_text())

                if nome == "Aedes albopictus":
                    dados["Resid_Albopictus"] = numero(colunas[1].get_text())
                    dados["Comercio_Albopictus"] = numero(colunas[2].get_text())
                    dados["TB_Albopictus"] = numero(colunas[3].get_text())
                    dados["Outros_Albopictus"] = numero(colunas[4].get_text())
                    dados["Total_Imoveis_Albopictus"] = numero(colunas[5].get_text())

    return dados

# =====================================================
# TOTAL
# =====================================================

def adicionar_total(df, nome_total):

    total = {"AREA": nome_total}

    for coluna in df.columns:

        if coluna == "AREA":
            continue

        if pd.api.types.is_numeric_dtype(df[coluna]):
            total[coluna] = df[coluna].sum()

    df = pd.concat([df, pd.DataFrame([total])], ignore_index=True)

    return df

# =====================================================
# PROCESSAR ESTRATO
# =====================================================

def processar_estrato(driver, areas, nome_estrato, semana_inicio, semana_fim):

    resultados = []

    for area in areas:

        print(f"Extraindo {nome_estrato} - Área {area}...")

        url = montar_url(area, semana_inicio, semana_fim)
        driver.get(url)
        time.sleep(3)

        html = driver.page_source
        dados = extrair_dados(html, area)
        resultados.append(dados)

    return resultados

# =====================================================
# IIP (Índice de Infestação Predial)
# =====================================================

def calcular_iip(total_imoveis_aegypti, total_imoveis):

    if not total_imoveis:
        return 0.0

    return round((total_imoveis_aegypti / total_imoveis) * 100, 2)

# =====================================================
# MAIN
# =====================================================

COLUNAS = [
    "AREA", "Tubitos",
    "Residencia", "Comercio", "TB", "Outros", "PE", "Total_Imoveis",
    "A1", "A2", "B", "C", "D1", "D2", "E", "Total_Aegypti",
    "Resid_Aegypti", "Comercio_Aegypti", "TB_Aegypti", "Outros_Aegypti",
    "Total_Imoveis_Aegypti",
    "Resid_Albopictus", "Comercio_Albopictus", "TB_Albopictus",
    "Outros_Albopictus", "Total_Imoveis_Albopictus",
]


def main():

    semana_inicio = SEMANA_INICIO
    semana_fim = SEMANA_FIM

    driver = criar_driver()

    try:
        fazer_login(driver)

        resultados_1 = processar_estrato(driver, AREAS_ESTRATO_1, "Estrato 1", semana_inicio, semana_fim)
        resultados_2 = processar_estrato(driver, AREAS_ESTRATO_2, "Estrato 2", semana_inicio, semana_fim)
        resultados_3 = processar_estrato(driver, AREAS_ESTRATO_3, "Estrato 3", semana_inicio, semana_fim)
        resultados_4 = processar_estrato(driver, AREAS_ESTRATO_4, "Estrato 4", semana_inicio, semana_fim)
    finally:
        driver.quit()

    df1 = pd.DataFrame(resultados_1)[COLUNAS]
    df2 = pd.DataFrame(resultados_2)[COLUNAS]
    df3 = pd.DataFrame(resultados_3)[COLUNAS]
    df4 = pd.DataFrame(resultados_4)[COLUNAS]

    df1 = adicionar_total(df1, "TOTAL ESTRATO 1")
    df2 = adicionar_total(df2, "TOTAL ESTRATO 2")
    df3 = adicionar_total(df3, "TOTAL ESTRATO 3")
    df4 = adicionar_total(df4, "TOTAL ESTRATO 4")

    df_total = pd.concat([
        df1.iloc[:-1], df2.iloc[:-1], df3.iloc[:-1], df4.iloc[:-1]
    ], ignore_index=True)

    df_total = adicionar_total(df_total, "TOTAL GERAL")

    # =================================================
    # EXCEL (sempre sobrescreve o mesmo arquivo, para não
    # acumular dezenas de planilhas no repositório)
    # =================================================

    os.makedirs("data", exist_ok=True)

    caminho_excel = "data/LIRA_COMPLETO_latest.xlsx"

    with pd.ExcelWriter(caminho_excel, engine="openpyxl") as writer:
        df1.to_excel(writer, index=False, sheet_name="Estrato_1")
        df2.to_excel(writer, index=False, sheet_name="Estrato_2")
        df3.to_excel(writer, index=False, sheet_name="Estrato_3")
        df4.to_excel(writer, index=False, sheet_name="Estrato_4")
        df_total.to_excel(writer, index=False, sheet_name="Total_Geral")

    # =================================================
    # JSON (o que alimenta o dashboard)
    # =================================================

    agora = datetime.now(TZ_MS)

    (ano_i, sem_i), (ano_f, sem_f) = par_semanas_epidemiologicas(agora.date())

    def linha_total(df):
        linha = df.iloc[-1].to_dict()
        linha["IIP"] = calcular_iip(linha.get("Total_Imoveis_Aegypti", 0), linha.get("Total_Imoveis", 0))
        return linha

    snapshot = {
        "gerado_em": agora.isoformat(),
        "semana_inicio": semana_inicio,   # week_id — usado só na busca
        "semana_fim": semana_fim,          # week_id — usado só na busca
        "semana_exibicao": {                # week_number — usado só na interface
            "ano_inicio": ano_i, "semana_inicio": sem_i,
            "ano_fim": ano_f, "semana_fim": sem_f,
            "rotulo": formatar_ciclo(agora.date()),
        },
        "estratos": {
            "Estrato 1": {
                "areas": df1.iloc[:-1].to_dict(orient="records"),
                "total": linha_total(df1),
            },
            "Estrato 2": {
                "areas": df2.iloc[:-1].to_dict(orient="records"),
                "total": linha_total(df2),
            },
            "Estrato 3": {
                "areas": df3.iloc[:-1].to_dict(orient="records"),
                "total": linha_total(df3),
            },
            "Estrato 4": {
                "areas": df4.iloc[:-1].to_dict(orient="records"),
                "total": linha_total(df4),
            },
        },
        "total_geral": linha_total(df_total),
    }

    caminho_historico = "data/history.json"

    if os.path.exists(caminho_historico):
        with open(caminho_historico, encoding="utf-8") as f:
            historico = json.load(f)
    else:
        historico = {}

    chave = f"{semana_inicio}-{semana_fim}"
    historico[chave] = snapshot

    with open(caminho_historico, "w", encoding="utf-8") as f:
        json.dump(historico, f, ensure_ascii=False, indent=2)

    print()
    print("====================================")
    print("RELATÓRIO FINALIZADO")
    print(caminho_excel)
    print(f"{caminho_historico} (chave atualizada: {chave})")
    print("====================================")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise
