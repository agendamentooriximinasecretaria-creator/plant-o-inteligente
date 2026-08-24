# Ordem personalizada dos setores na Escala Mensal Oficial

Hoje, na impressão "Escala Mensal Oficial", os setores são sempre agrupados em ordem alfabética (tanto na pré-visualização em HTML quanto no PDF). A ideia é permitir que o gestor defina manualmente a ordem em que os blocos de setor aparecem no documento.

## O que muda para o usuário

No modal **Imprimir Escala**, ao escolher o modelo **Escala Mensal Oficial**, aparece uma nova seção **Ordem dos setores**:

- Lista os setores que realmente têm plantões no mês/filtros selecionados.
- Cada item tem botões de subir/descer (▲ ▼) para reordenar.
- Botão **Ordem alfabética** para restaurar o padrão.
- Se a lista não for alterada, o comportamento continua igual ao de hoje (alfabético).
- A ordem escolhida vale igualmente para pré-visualizar, imprimir e salvar em PDF.
- Quando um filtro de setor único está selecionado, a seção fica oculta (não há o que ordenar).

## Detalhes técnicos

1. `src/lib/printEscalaMensalOficial.ts`
   - Adicionar `ordemSetores?: string[]` em `MensalOpts` (nomes de setor, na ordem desejada).
   - Criar um helper de ordenação: setores presentes em `ordemSetores` seguem aquele índice; os não listados vão ao fim em ordem alfabética.
   - Aplicar o helper nos dois pontos onde hoje há `Array.from(unidadeMap.keys()).sort()` — no gerador de HTML (~linha 328) e no gerador de PDF (~linha 787) — para que visualização e PDF fiquem idênticos.

2. `src/pages/EscalaPage.tsx`
   - Adicionar `ordemSetores: string[]` ao estado `printForm`.
   - Derivar a lista de setores candidatos a partir dos setores da unidade filtrada (`sectors`), mantendo os já ordenados no topo.
   - Nova seção de UI no modal, renderizada só quando `printForm.modelo === 'mensal_oficial'` e sem filtro de setor único, com os botões de subir/descer e "Ordem alfabética".
   - Passar `ordemSetores: printForm.ordemSetores` nas chamadas de `abrirEscalaMensalOficial` e `gerarPdfEscalaMensalOficial`.

Sem mudanças de banco de dados; a ordem é apenas uma preferência do momento da impressão.
