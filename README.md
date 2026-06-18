# Dashboard de Agenda de Exames — GRO Saúde

<p align="center"><img src="logo.png" alt="GRO Saúde" width="120"></p>

Dashboard interativo para visualização da evolução de exames da **Clínica GRO Saúde — Gestão de Segurança e Medicina Ocupacional**.

🔗 **Acesse o dashboard:** https://grosaudegerencia-cell.github.io/evolucaodeexames/

## Funcionalidades

- **KPIs em tempo real:** total de exames, realizados, agendados, empresas atendidas, média diária e tipos de exame.
- **Gráficos de evolução:**
  - Anual (comparativo entre anos)
  - Mensal (mês a mês, com linhas por ano)
  - Semanal
  - Por tipo de exame (ASO Admissional, Periódico, Demissional, Retorno, Consulta, Coleta)
  - Por descrição de exame (Audiometria, Hemograma, Espirometria, Raio-X, etc.)
  - Top empresas atendidas
- **Filtros combinados:** ano, mês, tipo de exame, empresa e status.
- **Tabela detalhada** com busca, ordenação e paginação.
- Identidade visual GRO Saúde (verde corporativo).

## Estrutura do projeto

| Arquivo | Descrição |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Estilos e identidade visual |
| `app.js` | Lógica de filtros, gráficos e tabela |
| `data.js` | **Base de dados dos exames** |

## Como atualizar com os dados reais

Edite o arquivo **`data.js`** e substitua os registros de exemplo pelos dados exportados das agendas (Excel), mantendo o mesmo formato:

```js
{ data:"2026-01-15", tipo:"ASO Admissional", descricao:"Audiometria", empresa:"Nome da Empresa", paciente:"Nome do Paciente", status:"Realizado" }
```
Campos:
- **data:** `AAAA-MM-DD`
- **tipo:** categoria do exame
- **descricao:** procedimento específico
- **empresa:** empresa cliente
- **paciente:** nome do colaborador
- **status:** `Realizado` ou `Agendado`

Após salvar e enviar (commit/push), o dashboard é atualizado automaticamente.

---

© 2026 GRO Saúde — Gestão de Riscos Ocupacionais.
