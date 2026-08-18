# Tipos de Plantão com múltiplos horários (turno partido)

Permitir que um tipo de plantão tenha mais de uma faixa de horário — por exemplo 08:00–12:00 e 14:00–18:00 — com um botão "Adicionar horário" no modal de cadastro.

## Como vai funcionar

No modal "Novo Tipo de Plantão":
- A dupla "Hora início / Hora fim" passa a ser uma lista de faixas.
- Botão "+ Adicionar horário" acrescenta uma nova faixa; cada faixa tem um botão de remover (a primeira nunca é removida).
- A carga horária é a soma das faixas (ex.: 4h + 4h = 8h), ainda editável manualmente.
- Validação: cada faixa precisa de início e fim, e faixas do mesmo tipo não podem se sobrepor.
- Na tabela de tipos, a coluna "Horário" mostra as faixas separadas por " + " (ex.: `08:00–12:00 + 14:00–18:00`).

Ao lançar um plantão na Escala usando um tipo com duas faixas, o sistema cria um registro de plantão por faixa (mesmo profissional, mesma data, mesmo tipo), para que a soma de horas, o cálculo de adicional noturno e as validações de conflito/descanso continuem corretos sem mudança de regra.

## Detalhes técnicos

1. Migração: adicionar `intervalos jsonb not null default '[]'` em `public.shift_types` (formato `[{ "inicio": "08:00", "fim": "12:00" }, ...]`). `hora_inicio`/`hora_fim` continuam preenchidos com o início da primeira faixa e o fim da última, mantendo compatibilidade com todo o código atual.
2. `src/components/ShiftTypesManager.tsx`: estado do formulário passa a ter `intervalos`; UI com lista, botão adicionar/remover; carga = soma via `calcCarga` de cada faixa; ao salvar, deriva `hora_inicio`/`hora_fim` das faixas; ao editar, se `intervalos` estiver vazio (tipos antigos) monta uma faixa única a partir de `hora_inicio`/`hora_fim`.
3. `src/pages/EscalaPage.tsx`: no mapeamento `TIPOS_PLANTAO`, expor `intervalos`. Na criação de plantão (incluindo escala recorrente), se o tipo tiver 2+ faixas, gerar uma linha em `shifts` por faixa; as validações existentes (conflito, descanso, 24h) rodam por faixa como já fazem hoje.
4. Sem alteração nas telas de impressão/relatórios: elas leem `shifts`, que continuam com uma faixa por registro.
