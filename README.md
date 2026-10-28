# Dashboard LIRAa — Ponta Porã

Coleta automática dos dados do LIRAa no eVisita (Secretaria de Saúde de MS) e
publicação de um site (GitHub Pages, pasta `docs/`) com **Home**, **Dashboard
de comparação** e **Detalhes dos levantamentos**.

## Páginas

| Página | Arquivo | O que mostra |
|---|---|---|
| Início | `docs/index.html` | Levantamento principal (**Novembro/2026**), IIP e IB com classificação, legenda oficial, estratos, evolução, ranking e criadouros |
| Dashboard | `docs/dashboard.html` | Filtros (levantamento, comparação, ciclo, período, estrato, bairro), evolução do IIP e IB, variação entre ciclos, comparação por estrato, imóveis pesquisados/positivos, ranking de bairros, principais criadouros e tabela histórica completa (por levantamento e por bairro, com CSV) |
| Levantamentos | `docs/levantamento.html?id=318-319` | Detalhes de um levantamento: consolidado por estrato, detalhamento por área, gráficos, Excel e impressão |

Enquanto o levantamento principal ainda não tem dados coletados, a Home avisa
isso e mostra o **último levantamento com dados**, claramente identificado.
Nenhum número é estimado ou inventado; informações ausentes são sinalizadas.

## Classificação de risco (regras únicas)

Todas as regras ficam em **`regras_classificacao.json`** (lido por
`classificacao.py` e embutido no site). Nenhuma página repete esses limites.

* **IIP** — faixas oficiais do Ministério da Saúde (Diretrizes Nacionais, 2009):
  Satisfatório / baixo risco `< 1%`; Alerta / risco médio `1% a 3,9%`;
  Risco / alto risco `> 3,9%`.
* **IB** — usa as **mesmas faixas do IIP**, conforme definido pelo Setor de
  Endemias (o Ministério da Saúde publica faixas oficiais só para o IIP; para o
  IB define apenas o cálculo: depósitos positivos ÷ imóveis pesquisados × 100).
  A legenda do IB indica "mesmas faixas do IIP · critério do setor". Para mudar,
  edite a seção `ib` do JSON e rode `python generate_dashboard.py`.

## Levantamentos e automação

Os levantamentos ficam em **`config_levantamentos.json`** (id_ano, id_ciclo,
semanas, tipo de coleta). A chave de cada um é `semana_inicio-semana_fim`, a
mesma de `data/history.json`: rodar de novo **atualiza** o registro, nunca
duplica.

* **Janeiro/2026** (`id_ciclo=160`, semanas `288-289`): recuperação **única**.
  Na próxima atualização o scraper coleta e grava em `data/estado_coleta.json`
  que concluiu; depois disso não roda mais. Se o eVisita ainda não devolver
  dados, nada é gravado e ele tenta de novo na execução seguinte.
* **Novembro/2026** (`id_ciclo=165`, semanas `331-332`): levantamento corrente,
  coletado em toda execução e definido como Home (`"home"` no config).
* **Agendamento** (`.github/workflows/lira.yml`): todos os dias de **03/11/2026
  a 15/11/2026**, às **03:00** e **12:00** no horário de Ponta Porã (UTC−4) —
  cron `0 7,16 3-15 11 *` em UTC. O scraper confere a janela real com
  `--respeitar-janela`, então nada roda fora dela (nem em novembro de 2027).
  A execução manual (“Run workflow”) ignora a janela.
* Um levantamento com erro não impede os demais; resultados sem nenhum imóvel
  pesquisado não sobrescrevem dados existentes.

Rótulos de semana/período de Janeiro e Novembro são derivados do ID da semana
(âncora: ID 318 ↔ SE 32/2026) e aparecem marcados como **estimados**. Se
quiser fixar a SE exata, informe `"se_inicio": [2026, 2]` no levantamento.

## Correção de estrato (Santa Izabel)

A área `423 - SANTA IZABEL` vem do eVisita dentro do Estrato 3, mas pertence ao
**Estrato 2**. A correção (`areas_estrato` em `config_levantamentos.json`) é
aplicada só na exibição: `data/history.json` não é alterado, os valores das
áreas ficam idênticos, os totais dos estratos são refeitos somando as áreas e o
total geral não muda.

## Passo a passo para publicar

1. Crie o repositório e envie estes arquivos (`git init`, `git add .`, `git push`).
2. Em **Settings → Secrets and variables → Actions**, cadastre `LIRA_USUARIO`
   (CPF) e `LIRA_SENHA`. Nunca coloque credenciais no código.
3. Em **Settings → Pages**, escolha “Deploy from a branch”, branch `main`,
   pasta `/docs`.
4. Teste em **Actions → Atualizar LIRAa → Run workflow**. Esse primeiro run já
   executa a recuperação de janeiro.

## Rodando localmente

```bash
pip install -r requirements.txt
export LIRA_USUARIO="seu_cpf" LIRA_SENHA="sua_senha"
python lira_scraper.py --dry-run        # só mostra o que seria coletado
python lira_scraper.py                  # coleta (janeiro pendente + novembro)
python lira_scraper.py --alvo 288-289   # força um levantamento específico
python generate_dashboard.py            # gera docs/assets/data/lira-data.js
```

Abra `docs/index.html` no navegador (funciona também direto do arquivo).

## Testes

```bash
pip install pytest playwright pyyaml && playwright install chromium
python -m pytest tests -q
```

Cobrem a recuperação única de janeiro, a configuração de novembro, a janela e
o cron (UTC−4), a não duplicação, a integridade dos dados, a classificação
(Python e JavaScript idênticos), a legenda, os filtros, os gráficos e a
ausência de rolagem horizontal em 360/390/768/1280 px.

## Estrutura

```
config_levantamentos.json   levantamentos, home e janela de automação
regras_classificacao.json   regras únicas de classificação (IIP/IB)
classificacao.py            classificador Python das mesmas regras
lira_scraper.py             coleta (multi-levantamento, idempotente)
generate_dashboard.py       gera docs/assets/data/lira-data.js
semana_util.py              semanas epidemiológicas (SE)
data/                       history.json, planilha, estado_coleta.json
docs/                       site estático (CSS/JS em assets/, libs em assets/vendor/)
```

Os scripts `importar_xlsx_historico.py` e `migrar_para_historico_unico.py`
continuam funcionando como antes.

## Identidade visual e segurança

Marca da Prefeitura Municipal de Ponta Porã (`docs/assets/logo_pmpp.png` —
mantenha o arquivo), paleta `#002B68`, `#007ECA`, `#00B93B`, `#FFB900`, fontes
Poppins/Inter, tema claro/escuro. Chart.js e SheetJS ficam em
`docs/assets/vendor/` (sem depender de CDN). Se a senha `SENHA = "350970"` do
script original chegou a ser commitada em algum momento, troque-a no eVisita.
