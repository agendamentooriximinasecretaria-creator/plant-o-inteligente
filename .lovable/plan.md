Plano para corrigir a impressão e exportação PDF dos relatórios:

1. Corrigir a causa principal do PDF enviado
- O PDF mostra duas origens de bagunça: os gráficos são capturados como um bloco gigante e viram páginas mal distribuídas, e tabelas largas como “Relatório de Trocas” são forçadas em A4 retrato, deixando colunas estreitas demais e texto quebrado letra por letra.
- A primeira página também fica quase vazia porque o bloco de gráficos é empurrado inteiro para a página seguinte por regra de quebra.

2. Ajustar impressão HTML dos relatórios
- Separar cabeçalho, filtros, cada gráfico, tabela, totais, assinatura e rodapé em seções próprias de impressão.
- Remover `break-inside: avoid` de blocos grandes que não cabem na página e manter essa regra apenas em elementos pequenos.
- Fazer os gráficos imprimirem em tamanho controlado, um por seção quando necessário, sem empurrar conteúdo para páginas vazias.
- Para tabelas com muitas colunas, mudar automaticamente para A4 paisagem e reduzir fonte/altura de célula só nesses relatórios largos.

3. Ajustar exportação PDF direta
- Detectar quantidade de colunas antes de criar o PDF.
- Usar paisagem para tabelas largas e retrato para relatórios simples.
- Definir larguras proporcionais por tipo de coluna no relatório de trocas: protocolo/tipo/datas/status estreitos; nomes, setor, unidade, motivo e observação com mais espaço.
- Trocar a quebra agressiva por ajuste profissional: fonte menor em tabelas largas, `overflow: linebreak`, margem ABNT compatível e sem texto letra por letra.
- Adicionar título, emissão e gráficos com paginação previsível, sem deixar páginas iniciais vazias.

4. Corrigir especificamente o Relatório de Trocas
- Reduzir e reorganizar as colunas impressas/exportadas para caberem com legibilidade: manter todos os dados importantes, mas com cabeçalhos curtos e larguras próprias.
- Preservar informações como protocolo, tipo, solicitante, destinatário, unidade, setor, plantão, horário, carga, motivo, status, criação/resolução, tempo e observação.

5. Validar com o PDF enviado como referência
- Gerar/inspecionar novamente a saída visual após a correção.
- Conferir se não há páginas vazias indevidas, texto cortado, colunas quebrando letra por letra, gráficos cortados ou tabelas desalinhadas.