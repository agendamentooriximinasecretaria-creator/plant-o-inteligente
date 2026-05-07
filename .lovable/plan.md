I will completely refactor the "Professional" modal in `src/pages/ProfissionaisPage.tsx` to meet hospital/professional standards.

### 1. Structure and Layout
- Refactor the existing `Dialog` into a more robust structure with:
  - Fixed Header (`DialogHeader` + `DialogTitle`).
  - Fixed Footer (sticky at the bottom with standard "Cancel" and "Save" buttons).
  - Scrollable Body area with `overflow-x-hidden`.
- Implement **Tabs** (using Radix `Tabs` or a custom implementation if needed, but the project seems to use `Tabs` from shadcn/ui) to group fields:
  - **Aba 1: Dados Básicos**: Nome, CPF, Telefone, E-mail, Status, Vínculo, Observações.
  - **Aba 2: Profissional**: Profissão, Especialidade, Conselho, Registro, Competências.
  - **Aba 3: Unidade e Setor**: Unidade Principal, Setor Principal.
  - **Aba 4: Documentos**: Conselho (CRM/COREN), Nº Documento, Validade.
  - **Aba 5: Regras**: Limite de Trocas de Plantão, Limite de Trocas de Paciente.
  - **Aba 6: Carimbo**: Integration with `CarimboAssinaturaProfissional`.

### 2. Responsiveness and UI Fixes
- Set modal width to `max-w-5xl` (or `6xl` if needed) and `w-[95vw]`.
- Use a responsive grid system:
  - `grid-cols-1` for mobile.
  - `md:grid-cols-2` or `lg:grid-cols-3` for larger screens depending on field width.
- Ensure all inputs (`input`, `select`, `textarea`) have `w-full` and proper focus/border styling.
- Remove horizontal scrolling by ensuring `min-w-0` and `overflow-x-hidden` on all containers.
- Improve visual feedback for mandatory fields (`*`).

### 3. Functional Integrity
- Maintain all existing `useMutation` and `useQuery` logic for saving and fetching data.
- Ensure "Edit Professional" correctly populates all fields, including sensitive ones fetched on demand.
- Keep the `CarimboAssinaturaProfissional` integration working correctly in the new tabbed layout.

### Technical Details:
- Files to modify: `src/pages/ProfissionaisPage.tsx`.
- Components to use: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`.
- CSS Classes: Use Tailwind `sticky`, `bottom-0`, `z-10` for the footer; `overflow-y-auto`, `max-h-[calc(90vh-140px)]` for the body.
