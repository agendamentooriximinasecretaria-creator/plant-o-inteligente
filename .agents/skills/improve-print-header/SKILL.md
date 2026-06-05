---
name: improve-print-header
description: Padronização e centralização do cabeçalho institucional em impressões e PDFs com logos da SMS e Prefeitura.
---

# Melhoria na Impressão de Escalas - Oriximiná

O sistema agora utiliza um cabeçalho institucional padronizado e centralizado para todos os tipos de impressão (Escala Mensal, Semanal e Relatórios).

## Mudanças Realizadas

1.  **Cabeçalho Centralizado**:
    *   **SECRETARIA MUNICIPAL DE SAÚDE — ORIXIMINÁ**
    *   **Hospital Municipal de Oriximiná · CNPJ 05.131.081/0001-82**
    *   **GestorPlantão · Sistema de Gestão de Escalas**

2.  **Identidade Visual (Logos)**:
    *   **Lado Esquerdo**: Logo da Secretaria Municipal de Saúde (formato redondo).
    *   **Lado Direito**: Logo da Prefeitura Municipal de Oriximiná.
    *   Aplicado tanto na visualização em tela (HTML) quanto na exportação para PDF.

3.  **Consistência entre Módulos**:
    *   A lógica de cabeçalho foi centralizada no arquivo `src/lib/documentTemplates.ts`.
    *   Os estilos foram atualizados em `src/lib/documentStyle.ts` para garantir o alinhamento correto.
    *   Os caminhos das logos foram atualizados para os ativos oficiais em `src/lib/logoSMS.ts`.

4.  **Ajustes de Renderização**:
    *   Ajustado o espaçamento e o tamanho das logos para evitar quebras de layout.
    *   Garantida a centralização dos títulos institucionais.
