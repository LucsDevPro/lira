# Dashboard LIRAa

Coleta automática dos dados do LIRAa no eVisita (Secretaria de Saúde de MS)
e publicação de um dashboard em HTML, atualizado automaticamente **dias
úteis às 12h e às 3h da manhã** (horário de Mato Grosso do Sul).

## O que este projeto faz

1. `lira_scraper.py` — faz login no eVisita com Selenium, percorre as
   áreas dos 4 estratos e extrai os dados de cada uma. Salva:
   - `data/LIRA_COMPLETO_latest.xlsx` (a planilha, sempre sobrescrita)
   - `data/history.json` — **um único arquivo** com todos os períodos já
     coletados, um por chave `"semana_inicio-semana_fim"`. Rodar de novo
     no mesmo ciclo apenas atualiza os valores dessa chave — não cria
     arquivo novo nem duplica entradas.
2. `generate_dashboard.py` — lê `data/history.json` e gera
   `docs/index.html`: cards por estrato, gráfico de IIP por estrato,
   gráfico de histórico e a tabela detalhada por área, com um seletor
   no topo para trocar entre os meses/ciclos já coletados.
3. `.github/workflows/lira.yml` — roda os dois scripts automaticamente
   no GitHub Actions e publica o resultado de volta no repositório.
   O GitHub Pages serve o conteúdo da pasta `docs/`.

## Passo a passo para publicar

### 1. Criar o repositório

No GitHub, crie um repositório novo (pode ser privado). Depois, na sua
máquina, dentro desta pasta:

```bash
git init
git add .
git commit -m "Projeto inicial LIRAa"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. Cadastrar as credenciais como Secrets (NUNCA no código)

No repositório: **Settings → Secrets and variables → Actions → New repository secret**

Cadastre dois secrets:

| Nome | Valor |
|---|---|
| `LIRA_USUARIO` | seu CPF de login no eVisita |
| `LIRA_SENHA` | sua senha |

Esses valores ficam criptografados; nenhum colaborador ou log consegue
lê-los, e nada disso aparece no código-fonte.

### 3. Ativar o GitHub Pages

**Settings → Pages → Source** → escolha **"Deploy from a branch"**,
branch `main`, pasta `/docs`. Salve.

Depois do primeiro workflow rodar com sucesso, o dashboard fica
disponível em:

```
https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

### 4. Testar manualmente antes de esperar o horário agendado

Na aba **Actions** do repositório, escolha o workflow **"Atualizar
LIRAa"** e clique em **"Run workflow"**. Acompanhe o log — se o login
falhar, revise os Secrets; se a extração falhar, confira se o HTML do
site mudou de estrutura.

### 5. Horários automáticos

O workflow já está configurado para rodar, dias úteis:
- 5h da manhã
- 12h (meio-dia)
- 19h

(Convertidos para UTC no arquivo `lira.yml`, já que o GitHub Actions
usa UTC. Não precisa mexer em nada — mas se um dia o horário de verão
voltar a valer em MS, os horários de cron precisarão ser ajustados em
1 hora.)

## Migrando de uma versão anterior (arquivos data/latest.json e data/history/*.json)

Se seu repositório ainda tem a estrutura antiga (`data/latest.json` +
vários arquivos em `data/history/`), rode uma vez:

```bash
python migrar_para_historico_unico.py
```

Isso junta tudo em `data/history.json`. Depois de conferir que o
dashboard continua mostrando os mesmos períodos, apague
`data/latest.json` e a pasta `data/history/` — a partir daí só o
`data/history.json` é usado.

## Identidade visual

O dashboard usa a marca da Prefeitura Municipal de Ponta Porã:

- Logo em `docs/assets/logo_pmpp.png` — **esse arquivo precisa
  permanecer no repositório** (não é gerado pelo script, é um asset
  fixo). Se precisar trocar a logo, só substituir esse arquivo
  (mantendo o mesmo nome) e rodar `generate_dashboard.py` de novo.
- Paleta oficial: azul-marinho `#002B68`, azul `#007ECA`, verde
  `#00B93B` e amarelo `#FFB900` (extraídas do próprio logo).
- Fontes: Poppins (títulos) e Inter (texto), carregadas via Google Fonts.

## Duas formas de identificar a semana

O projeto usa dois conceitos separados, como no site:

- **`week_id`** (ex.: `318`) — o ID contínuo do eVisita, usado **somente**
  para montar a URL de busca (`SEMANA_INICIO`/`SEMANA_FIM` em
  `lira_scraper.py`). Não tem significado de calendário isolado.
- **`week_number`** (ex.: `SE 31/2026`) — a Semana Epidemiológica
  padrão (domingo a sábado, reinicia a cada ano), calculada a partir da
  **data real da coleta** (não do `week_id`) e usada **somente** na
  interface do dashboard. O cálculo está em `semana_util.py`, usando a
  biblioteca `epiweeks`.

Como o ciclo do LIRAa usa dois `week_id`s consecutivos (ex.: 318 e 319),
a segunda Semana Epidemiológica é a primeira + 1 (com virada de ano
tratada automaticamente).

## Trocar a semana do ciclo

As variáveis `SEMANA_INICIO` e `SEMANA_FIM` estão fixas no topo de
`lira_scraper.py` (hoje: `318` e `319`). Quando o ciclo mudar no site,
edite esses dois valores e faça commit/push — a próxima execução
automática já usa os novos.

## Rodando localmente (fora do GitHub Actions)

```bash
pip install -r requirements.txt
export LIRA_USUARIO="seu_cpf"
export LIRA_SENHA="sua_senha"
python lira_scraper.py
python generate_dashboard.py
```

Depois abra `docs/index.html` no navegador.

## Sobre segurança

- As credenciais nunca ficam no código — só como Secrets do GitHub.
- Se em algum momento a senha `SENHA = "350970"` do script original
  chegou a ser commitada em algum repositório (mesmo privado), o ideal
  é trocá-la no eVisita, já que qualquer pessoa com acesso ao
  histórico do Git (inclusive commits antigos apagados depois) consegue
  recuperá-la.
