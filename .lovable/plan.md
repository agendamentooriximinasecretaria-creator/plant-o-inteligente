## Problema

No PDF da Escala Mensal Oficial aparece uma segunda linha de assinatura no canto direito, sem nome/cargo embaixo. Isso ocorre porque o código desenha o bloco do "Responsável Técnico" (r2) incondicionalmente, mesmo quando `opts.responsavelTecnico` não está preenchido.

## Causa

Em `src/lib/printEscalaMensalOficial.ts` (linhas ~1043-1078), o bloco direito sempre executa:
- `doc.line(startXR, assY, startXR + lineLen, assY)` desenha a linha horizontal
- `renderResponsavelInfo(doc, r2, ...)` é chamado mesmo com `r2` vazio

O mesmo acontece no template HTML em `src/lib/documentTemplates.ts` — embora lá já exista uma checagem `${responsavelTecnico ? renderBox(...) : ""}`, é preciso garantir consistência.

## Correção

1. Em `printEscalaMensalOficial.ts`, envolver TODO o bloco do "Responsável Direito" (assinatura visual, carimbo, selo digital, linha e info — linhas 1043-1078) em uma checagem:
   ```ts
   const hasR2 = !!(r2 && (r2.nome || r2.cargo));
   if (hasR2) { /* desenha bloco direito */ }
   ```
   Assim, quando não houver Responsável Técnico, nem a linha nem qualquer artefato direito serão renderizados.

2. Centralizar o bloco esquerdo quando for o único: ajustar `startXL` para `(pageW - lineLen) / 2` caso `!hasR2`, para o único signatário aparecer centralizado (igual ao HTML que já usa `justify-content: space-around`).

Nenhuma outra alteração de layout, fonte ou cálculo de altura será feita.
