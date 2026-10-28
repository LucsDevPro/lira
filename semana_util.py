# -*- coding: utf-8 -*-
"""
Conversão entre as duas formas de identificar uma semana no sistema:

- week_id (ID contínuo do site, ex.: 318): usado SOMENTE para montar a URL
  de busca no eVisita. Não precisa de conversão nenhuma para isso.

- week_number (Semana Epidemiológica, ex.: SE 31/2026): usado SOMENTE
  para exibição na interface/dashboard. É calculado a partir da DATA REAL
  da coleta (não a partir do week_id), usando o padrão de Semana
  Epidemiológica (SE) do Ministério da Saúde/SINAN — semanas de domingo
  a sábado, numeradas de 1 a 52/53 dentro de cada ano.

Cada ciclo do LIRAa usa dois week_ids consecutivos (ex.: 318 e 319, um
"quinzenário"). Como só temos uma data real associada ao ciclo (a data
da coleta/importação), a segunda semana epidemiológica é obtida somando
1 à primeira — o próprio pacote `epiweeks` cuida da virada de ano.
"""

from datetime import date
from epiweeks import Week


def semana_epidemiologica(data):
    """Recebe uma data (date ou string ISO) e devolve (ano, semana)."""
    if isinstance(data, str):
        data = date.fromisoformat(data[:10])

    w = Week.fromdate(data)
    return w.year, w.week


def par_semanas_epidemiologicas(data):
    """
    Devolve as duas SEs de um ciclo (início e fim), a partir da data real
    de coleta: ((ano_inicio, semana_inicio), (ano_fim, semana_fim)).
    """
    if isinstance(data, str):
        data = date.fromisoformat(data[:10])

    w_inicio = Week.fromdate(data)
    w_fim = w_inicio + 1

    return (w_inicio.year, w_inicio.week), (w_fim.year, w_fim.week)


def formatar_ciclo(data):
    """Ex.: 'SE 31-32/2026'."""
    (ano_i, sem_i), (ano_f, sem_f) = par_semanas_epidemiologicas(data)

    if ano_i == ano_f:
        return f"SE {sem_i}-{sem_f}/{ano_i}"

    return f"SE {sem_i}/{ano_i} - SE {sem_f}/{ano_f}"


# ---------------------------------------------------------------------
# Conversão a partir do week_id do eVisita (usada para levantamentos que
# NÃO são coletados no dia em que acontecem, como a recuperação de janeiro)
# ---------------------------------------------------------------------
#
# Âncora observada nos dados reais já coletados: week_id 318 ↔ SE 32/2026
# (coleta de 12/08/2026). Os week_ids são contínuos (1 por semana), então
# week_id N corresponde à SE (32 + (N - 318)) de 2026. É uma ESTIMATIVA de
# rótulo/período (não altera nenhum valor coletado) e pode ser sobrescrita
# por levantamento em config_levantamentos.json ("se_inicio": [ano, semana]).

ANCORA_WEEK_ID = 318
ANCORA_SE = (2026, 32)


def week_id_para_se(week_id):
    """Devolve a Week (epiweeks) correspondente a um week_id do eVisita."""
    base = Week(ANCORA_SE[0], ANCORA_SE[1])
    return base + (int(week_id) - ANCORA_WEEK_ID)


def semana_exibicao_por_week_id(semana_inicio, semana_fim=None, se_inicio=None):
    """
    Monta o bloco `semana_exibicao` + `periodo` de um levantamento a partir
    dos week_ids (ou de uma SE informada explicitamente em `se_inicio`).
    """
    if se_inicio:
        w_i = Week(int(se_inicio[0]), int(se_inicio[1]))
    else:
        w_i = week_id_para_se(semana_inicio)
    if semana_fim is not None and not se_inicio:
        w_f = week_id_para_se(semana_fim)
    else:
        w_f = w_i + 1

    if w_i.year == w_f.year:
        rotulo = f"SE {w_i.week}-{w_f.week}/{w_i.year}"
    else:
        rotulo = f"SE {w_i.week}/{w_i.year} - SE {w_f.week}/{w_f.year}"

    exibicao = {
        "ano_inicio": w_i.year, "semana_inicio": w_i.week,
        "ano_fim": w_f.year, "semana_fim": w_f.week,
        "rotulo": rotulo,
    }
    periodo = {
        "inicio": w_i.startdate().isoformat(),
        "fim": w_f.enddate().isoformat(),
    }
    return exibicao, periodo


def periodo_de_exibicao(exibicao):
    """Período (datas ISO) a partir de um bloco `semana_exibicao` existente."""
    w_i = Week(int(exibicao["ano_inicio"]), int(exibicao["semana_inicio"]))
    w_f = Week(int(exibicao["ano_fim"]), int(exibicao["semana_fim"]))
    return {"inicio": w_i.startdate().isoformat(), "fim": w_f.enddate().isoformat()}
