# Turno partido no lançamento de plantões + carregamento da lista de profissionais

## Situação atual (verificada)

1. **Tipos de Plantão já suporta múltiplos horários.** A coluna `intervalos` existe em `shift_types`, e `ShiftTypesManager.tsx` já tem o botão "Adicionar horário", validação de sobreposição, soma automática da carga e exibição `08:00–12:00 + 14:00–18:00` na tabela.
2. **O Lançamento de Plantões ignora essas faixas.** Em `EscalaPage.tsx`, o mapeamento `TIPOS_PLANTAO` usa apenas `hora_inicio`/`hora_fim` (início da 1ª faixa e fim da última). Ao escolher um tipo partido, o sistema cria **um** plantão 08:00–18:00 (10h) em vez de dois registros (4h + 4h = 8h). Essa parte não está implantada.
3. **Lista de profissionais.** A página usa `queryKey: ['professionals']` com `staleTime` global de 5 min e sem espera pela sessão de autenticação. Quando a consulta roda antes da sessão estar pronta, o resultado (vazio/erro) fica em cache e só aparece após atualizar a página manualmente. Causa provável, a confirmar no primeiro passo da correção.

## O que será feito

### A. Turno partido no lançamento de plantões
- Ao selecionar um tipo com 2+ faixas no modal de Novo Plantão, o formulário mostra as faixas do tipo (somente leitura) e a carga total (ex.: 8h).
- Ao salvar, o sistema cria **um registro de plantão por faixa** para cada profissional/setor/data — mesmo tipo, mesma data.
- As validações existentes (conflito de horário, descanso mínimo, 24h, cobertura) passam a rodar por faixa, com as mesmas regras de aviso/bloqueio de hoje (Gestor Master mantém avisos não-bloqueantes).
- Edição de um plantão continua editando apenas aquele registro/faixa.
- Escala recorrente segue o mesmo comportamento (uma linha por faixa por data).
- Totais de horas, ADN, impressões e relatórios não mudam de regra: continuam lendo `shifts`, que sempre tem uma faixa por registro.

### B. Carregamento da lista de profissionais
- A consulta de profissionais (e as consultas auxiliares de plantões/trocas do mês) passa a aguardar a sessão pronta antes de executar, e a revalidar ao montar a página, eliminando a necessidade de atualizar manualmente.
- Erro real de consulta continua exibindo o estado de erro com botão "Tentar novamente".

## Detalhes técnicos

1. `src/pages/EscalaPage.tsx`
   - `TIPOS_PLANTAO`: expor `intervalos` (via `getIntervalos` de `ShiftTypesManager`).
   - Ao trocar `tipo_plantao`, guardar as faixas no estado do formulário; `hora_inicio`/`hora_fim` continuam refletindo a 1ª faixa para compatibilidade da UI.
   - `revalidateServerSide` e as validações locais (`check_shift_conflict`, `check_descanso_minimo`, alerta 24h) iteram sobre as faixas.
   - `saveMutation` (criação e recorrente): `payloads` passam a ser `profissional × setor × data × faixa`, com `carga_horaria` de cada faixa via `calcHours`.
2. `src/pages/ProfissionaisPage.tsx`: usar `isReady`/`session` do `useAuth` como `enabled` das queries e `refetchOnMount: 'always'` (ou `staleTime: 0`) na query `['professionals']`.
3. Sem migração de banco — `intervalos` já existe.
