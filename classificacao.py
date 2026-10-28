# -*- coding: utf-8 -*-
"""
Classificação de risco (IIP e IB) — implementação Python das regras
centralizadas em regras_classificacao.json.

O site usa as MESMAS regras (o JSON é embutido em lira-data.js e lido por
docs/assets/js/lira-core.js). Os testes em tests/ garantem que Python e
JavaScript classificam igual.
"""

import json
import os

CAMINHO_REGRAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "regras_classificacao.json")


def carregar_regras(caminho=CAMINHO_REGRAS):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def calcular_indice(numerador, imoveis_pesquisados):
    """Valor por 100 imóveis, sem arredondar (None se não houver imóveis)."""
    if not imoveis_pesquisados:
        return None
    return numerador / imoveis_pesquisados * 100


def arredondar(valor):
    """Arredondamento de exibição/classificação: 2 casas decimais."""
    return None if valor is None else round(valor + 1e-12, 2)


def classificar(indice, valor, regras=None):
    """
    Devolve a faixa (dict) de `indice` ('iip' ou 'ib') para `valor`,
    ou None se valor for None. A classificação usa o valor com 2 casas
    decimais — o mesmo que é exibido.
    """
    regras = regras or carregar_regras()
    if valor is None:
        return None
    v = arredondar(valor)
    for faixa in regras["indices"][indice]["faixas"]:
        lim = faixa["limite_superior"]
        if lim is None:
            return faixa
        if v < lim or (faixa["superior_inclusivo"] and v == lim):
            return faixa
    return regras["indices"][indice]["faixas"][-1]
