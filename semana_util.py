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
