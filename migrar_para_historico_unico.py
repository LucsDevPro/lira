# -*- coding: utf-8 -*-
"""
Script de migração — rode UMA VEZ para juntar os arquivos antigos
(data/latest.json e data/history/*.json) no novo arquivo único
data/history.json. Depois de confirmar que o dashboard continua
mostrando tudo certo, pode apagar data/latest.json e a pasta
data/history/ (com os arquivos .json antigos).

Uso:
    python migrar_para_historico_unico.py
"""

import json
import glob
import os

CAMINHO_HISTORICO = "data/history.json"


def main():
    historico = {}

    if os.path.exists(CAMINHO_HISTORICO):
        with open(CAMINHO_HISTORICO, encoding="utf-8") as f:
            historico = json.load(f)

    arquivos = glob.glob("data/history/*.json")
    if os.path.exists("data/latest.json"):
        arquivos.append("data/latest.json")

    if not arquivos:
        print("Nenhum arquivo antigo encontrado para migrar.")
        return

    for caminho in arquivos:
        try:
            with open(caminho, encoding="utf-8") as f:
                snap = json.load(f)
            chave = f"{snap['semana_inicio']}-{snap['semana_fim']}"
            # se já existir a mesma semana, mantém a versão com data mais recente
            if chave in historico and historico[chave]["gerado_em"] > snap["gerado_em"]:
                continue
            historico[chave] = snap
            print(f"Migrado: {caminho} -> chave {chave}")
        except Exception as exc:
            print(f"Ignorado (erro ao ler {caminho}): {exc}")

    os.makedirs("data", exist_ok=True)
    with open(CAMINHO_HISTORICO, "w", encoding="utf-8") as f:
        json.dump(historico, f, ensure_ascii=False, indent=2)

    print(f"\nPronto. {len(historico)} período(s) em {CAMINHO_HISTORICO}.")
    print("Depois de conferir o dashboard, pode apagar data/latest.json e data/history/.")


if __name__ == "__main__":
    main()
