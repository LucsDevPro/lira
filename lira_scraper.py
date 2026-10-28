# -*- coding: utf-8 -*-

import os
import re
import sys
import json
import time
import argparse
from datetime import datetime, date, timezone, timedelta

import pandas as pd
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from semana_util import (
    par_semanas_epidemiologicas, formatar_ciclo,
    semana_exibicao_por_week_id, periodo_de_exibicao,
)

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

# =====================================================
# LEVANTAMENTOS (ciclo/semanas)
#
# Os levantamentos (id_ano, id_ciclo, semana_inicio, semana_fim) ficam em
# config_levantamentos.json — NÃO mais fixos aqui. Para trocar de ciclo,
# edite aquele arquivo. Cada levantamento é identificado pela chave
# "semana_inicio-semana_fim", a mesma usada em data/history.json.
# =====================================================

DIR_BASE = os.path.dirname(os.path.abspath(__file__))
CAMINHO_CONFIG = os.path.join(DIR_BASE, "config_levantamentos.json")
DIR_DADOS = os.environ.get("LIRA_DATA_DIR", os.path.join(DIR_BASE, "data"))

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

def montar_url(area, semana_inicio, semana_fim, id_atividade=ID_ATIVIDADE,
               id_ano=ID_ANO, id_ciclo=None):

    if id_ciclo is None:
        raise ValueError("id_ciclo é obrigatório (defina em config_levantamentos.json)")

    return (
        f"{URL_BASE}?"
        f"id_municipio={ID_MUNICIPIO}&"
        f"id_regiao={ID_REGIAO}&"
        f"id_area={area}&"
        f"id_atividade={id_atividade}&"
        f"id_ano={id_ano}&"
        f"id_ciclo={id_ciclo}&"
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

def processar_estrato(driver, areas, nome_estrato, alvo):

    resultados = []

    for area in areas:

        print(f"Extraindo {nome_estrato} - Área {area}...")

        url = montar_url(
            area, alvo["semana_inicio"], alvo["semana_fim"],
            id_atividade=alvo.get("id_atividade", ID_ATIVIDADE),
            id_ano=alvo.get("id_ano", ID_ANO),
            id_ciclo=alvo["id_ciclo"],
        )
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




# =====================================================
# CONFIG / ESTADO / JANELA DE EXECUÇÃO
# =====================================================

def carregar_config(caminho=CAMINHO_CONFIG):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def caminho_historico():
    return os.path.join(DIR_DADOS, "history.json")


def caminho_estado():
    return os.path.join(DIR_DADOS, "estado_coleta.json")


def carregar_json(caminho, padrao):
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)
    return padrao


def salvar_json(caminho, dados):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    os.replace(tmp, caminho)  # gravação atômica: nunca deixa o arquivo pela metade


def dentro_da_janela(agora, config):
    """
    True se `agora` (datetime com fuso) está dentro da janela de automação
    configurada, avaliada no horário de Ponta Porã (UTC−4).
    """
    local = agora.astimezone(TZ_MS).date()
    ini = date.fromisoformat(config["automacao"]["janela_inicio"])
    fim = date.fromisoformat(config["automacao"]["janela_fim"])
    return ini <= local <= fim


def tem_dados(snapshot):
    return bool(snapshot) and (snapshot.get("total_geral", {}).get("Total_Imoveis") or 0) > 0


def selecionar_alvos(config, historico, estado, chaves_forcadas=None):
    """
    Decide o que coletar nesta execução:

    1. recuperações únicas ainda pendentes (e que ainda não têm dados no
       histórico) — em ordem cronológica;
    2. levantamentos 'automatica' (o levantamento corrente).

    Com `chaves_forcadas` (--alvo), coleta exatamente essas chaves.
    """
    por_chave = {l["chave"]: l for l in config["levantamentos"]}

    if chaves_forcadas:
        faltando = [c for c in chaves_forcadas if c not in por_chave]
        if faltando:
            raise SystemExit(f"Levantamento(s) não configurado(s): {', '.join(faltando)}")
        return [por_chave[c] for c in chaves_forcadas]

    alvos = []
    for lev in config["levantamentos"]:
        if lev["coleta"] == "recuperacao_unica":
            concluida = lev["chave"] in estado.get("unicas", {})
            ja_tem = tem_dados(historico.get(lev["chave"]))
            if not concluida and not ja_tem:
                alvos.append(lev)
    for lev in config["levantamentos"]:
        if lev["coleta"] == "automatica":
            alvos.append(lev)
    return alvos


# =====================================================
# COLETA DE UM LEVANTAMENTO
# =====================================================

def coletar_alvo(driver, alvo):
    resultados = []
    for nome, areas in (
        ("Estrato 1", AREAS_ESTRATO_1),
        ("Estrato 2", AREAS_ESTRATO_2),
        ("Estrato 3", AREAS_ESTRATO_3),
        ("Estrato 4", AREAS_ESTRATO_4),
    ):
        resultados.append(processar_estrato(driver, areas, nome, alvo))

    dfs = [pd.DataFrame(r)[COLUNAS] for r in resultados]
    dfs = [adicionar_total(df, f"TOTAL ESTRATO {i}") for i, df in enumerate(dfs, start=1)]

    df_total = pd.concat([df.iloc[:-1] for df in dfs], ignore_index=True)
    df_total = adicionar_total(df_total, "TOTAL GERAL")
    return dfs, df_total


def linha_total(df):
    linha = df.iloc[-1].to_dict()
    # converte tipos numpy para tipos nativos (JSON)
    linha = {k: (v.item() if hasattr(v, "item") else v) for k, v in linha.items()}
    linha["IIP"] = calcular_iip(linha.get("Total_Imoveis_Aegypti", 0), linha.get("Total_Imoveis", 0))
    return linha


def registros(df):
    out = []
    for r in df.to_dict(orient="records"):
        out.append({k: (v.item() if hasattr(v, "item") else v) for k, v in r.items()})
    return out


def construir_snapshot(alvo, dfs, df_total, agora, existente=None):
    """
    Monta o registro de histórico de um levantamento. Os VALORES vêm só do
    que foi extraído; os rótulos de semana/período vêm de config (ou são
    preservados se o levantamento já existia no histórico).
    """
    if existente and existente.get("semana_exibicao"):
        exibicao = existente["semana_exibicao"]
        periodo = existente.get("periodo") or periodo_de_exibicao(exibicao)
        origem = existente.get("periodo_origem", "data da coleta")
    else:
        exibicao, periodo = semana_exibicao_por_week_id(
            alvo["semana_inicio"], alvo["semana_fim"], alvo.get("se_inicio")
        )
        origem = "id da semana (estimado)"

    snapshot = {
        "gerado_em": agora.isoformat(),
        "semana_inicio": str(alvo["semana_inicio"]),   # week_id — usado só na busca
        "semana_fim": str(alvo["semana_fim"]),          # week_id — usado só na busca
        "id_ano": alvo.get("id_ano"),
        "id_ciclo": alvo.get("id_ciclo"),
        "semana_exibicao": exibicao,                    # week_number — só interface
        "periodo": periodo,
        "periodo_origem": origem,
        "estratos": {
            f"Estrato {i}": {
                "areas": registros(df.iloc[:-1]),
                "total": linha_total(df),
            }
            for i, df in enumerate(dfs, start=1)
        },
        "total_geral": linha_total(df_total),
    }
    return snapshot


def salvar_levantamento(alvo, snapshot, dfs, df_total, config, agora):
    """
    Grava o levantamento em data/history.json (upsert pela chave — nunca
    duplica) e, se for o levantamento principal (home), atualiza a planilha
    data/LIRA_COMPLETO_latest.xlsx.
    """
    chave = f"{alvo['semana_inicio']}-{alvo['semana_fim']}"

    historico = carregar_json(caminho_historico(), {})
    historico[chave] = snapshot
    salvar_json(caminho_historico(), historico)

    if chave == config.get("home"):
        os.makedirs(DIR_DADOS, exist_ok=True)
        caminho_excel = os.path.join(DIR_DADOS, "LIRA_COMPLETO_latest.xlsx")
        with pd.ExcelWriter(caminho_excel, engine="openpyxl") as writer:
            for i, df in enumerate(dfs, start=1):
                df.to_excel(writer, index=False, sheet_name=f"Estrato_{i}")
            df_total.to_excel(writer, index=False, sheet_name="Total_Geral")
        print(f"Planilha atualizada: {caminho_excel}")

    return chave


# =====================================================
# EXECUÇÃO
# =====================================================

def executar(args, criar=None, login=None, agora=None):
    """
    Retorna o código de saída (0 = tudo certo). `criar`/`login`/`agora`
    existem para os testes poderem simular o eVisita.
    """
    criar = criar or criar_driver
    login = login or fazer_login
    agora = agora or datetime.now(TZ_MS)

    config = carregar_config(args.config) if args.config else carregar_config()

    if args.respeitar_janela and not dentro_da_janela(agora, config):
        a = config["automacao"]
        print(
            f"Fora da janela de automação ({a['janela_inicio']} a {a['janela_fim']}, "
            f"horário de Ponta Porã UTC−4). Agora: {agora.astimezone(TZ_MS):%d/%m/%Y %H:%M}. Nada a fazer."
        )
        return 0

    historico = carregar_json(caminho_historico(), {})
    estado = carregar_json(caminho_estado(), {"unicas": {}, "execucoes": {}})
    estado.setdefault("unicas", {})
    estado.setdefault("execucoes", {})

    alvos = selecionar_alvos(config, historico, estado, args.alvo)

    if not alvos:
        print("Nenhum levantamento pendente. Nada a fazer.")
        return 0

    print("Levantamentos desta execução: " + ", ".join(
        f"{a['nome']} ({a['chave']}, {a['coleta']})" for a in alvos))

    if args.dry_run:
        return 0

    erros = 0
    driver = criar()
    try:
        login(driver)

        for alvo in alvos:
            chave = alvo["chave"]
            try:
                if alvo.get("id_ciclo") is None:
                    raise RuntimeError(f"id_ciclo não configurado para {chave}")

                dfs, df_total = coletar_alvo(driver, alvo)
                snapshot = construir_snapshot(alvo, dfs, df_total, agora, historico.get(chave))

                if not tem_dados(snapshot):
                    # O eVisita ainda não tem lançamentos para esse período:
                    # não grava (evita zerar/duplicar) e tenta na próxima.
                    print(f"{alvo['nome']}: sem imóveis pesquisados no eVisita ainda — nada gravado.")
                    estado["execucoes"][chave] = {"em": agora.isoformat(), "resultado": "sem_dados"}
                    continue

                salvar_levantamento(alvo, snapshot, dfs, df_total, config, agora)
                historico[chave] = snapshot
                estado["execucoes"][chave] = {"em": agora.isoformat(), "resultado": "ok"}

                if alvo["coleta"] == "recuperacao_unica":
                    estado["unicas"][chave] = {
                        "concluida_em": agora.isoformat(),
                        "total_imoveis": snapshot["total_geral"]["Total_Imoveis"],
                    }
                    print(f"{alvo['nome']}: recuperação única concluída.")

                print(f"{alvo['nome']}: gravado em history.json (chave {chave}).")

            except Exception as exc:  # um levantamento falhar não impede os outros
                erros += 1
                print(f"ERRO em {alvo['nome']} ({chave}): {exc}", file=sys.stderr)
                estado["execucoes"][chave] = {"em": agora.isoformat(), "resultado": "erro", "mensagem": str(exc)}
    finally:
        try:
            driver.quit()
        finally:
            salvar_json(caminho_estado(), estado)

    print()
    print("====================================")
    print("RELATÓRIO FINALIZADO" + (f" — {erros} erro(s)" if erros else ""))
    print("====================================")
    return 1 if erros else 0


def ler_argumentos(argv=None):
    p = argparse.ArgumentParser(description="Coleta o LIRAa no eVisita.")
    p.add_argument("--alvo", action="append", help="chave do levantamento (ex.: 288-289); pode repetir. Sem isso, usa a configuração.")
    p.add_argument("--respeitar-janela", action="store_true",
                   help="só executa dentro da janela de automação (usado nas execuções agendadas)")
    p.add_argument("--dry-run", action="store_true", help="só mostra o que seria coletado")
    p.add_argument("--config", help="caminho alternativo para config_levantamentos.json")
    return p.parse_args(argv)


def main(argv=None):
    return executar(ler_argumentos(argv))


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise
