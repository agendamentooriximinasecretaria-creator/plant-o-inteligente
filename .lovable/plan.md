# Corrigir ADN indevido (8.0h) na Escala Mensal

## O que está acontecendo (confirmado nos dados)

JEANE BENTES BATISTA e GABRIEL LORENZI DE SOUZA RIBEIRO estão com o ADN **desmarcado** no cadastro (`recebe_adicional_noturno = false`), mas ambos têm `is_plantonista = true` (Jeane também com cargo "Plantonista").

Os 8.0h vêm de um único plantão: **FERIADO 07/09/2026, 00:00–23:59**. Como a faixa de ADN padrão é 23:00–07:00, esse plantão cruza 00:00–07:00 (7h) + 23:00–23:59 (~1h) = ~8.0h. Não existe configuração salva de ADN no sistema (`adn_config` ausente), então vale a regra antiga.

Duas falhas somadas:

1. **O "desmarcar ADN" do profissional é ignorado na grade da tela.** Ao montar as linhas da escala, o campo enviado para a grade é calculado como "recebe ADN **ou** é plantonista **ou** cargo contém plantonista". Com isso, quem é plantonista volta a ser elegível mesmo com a caixinha desmarcada — o veto explícito nunca é aplicado.
2. **A marcação "Gera Adicional Noturno" do tipo de plantão não é respeitada.** O tipo FERIADO está com essa opção desligada (verificado no banco), mas o cálculo só olha o horário do plantão, ignorando essa flag. Por isso qualquer plantão que toque a faixa noturna gera ADN.

## Correção proposta

### 1. Regra de elegibilidade limpa (profissional)

- O valor de `recebe_adicional_noturno` passa **puro** para a grade, sem mistura com "plantonista".
- "Plantonista" (flag ou cargo) continua existindo apenas como **critério adicional** de inclusão, nunca sobrepondo o desmarcado.
- Quem está desmarcado mostra sempre **"—"** na coluna ADN (tela, impressão e PDF).

### 2. Tipo de plantão manda no ADN (solução para o FERIADO)

Em vez de deduzir ADN só pelo horário, o tipo de plantão passa a ser a autoridade — com três comportamentos escolhidos no cadastro do tipo ("Adicional Noturno" no modal Tipo de Plantão):

- **Nunca gerar ADN** — o tipo é ignorado no cálculo, mesmo cruzando a madrugada. É o modo indicado para FERIADO, Folga, Sobreaviso e ausências. Resolve o caso dos 8.0h.
- **Automático pelo horário** (padrão atual) — soma apenas as horas dentro da faixa noturna configurada.
- **Sempre gerar ADN** — o tipo gera ADN integral do plantão, útil para tipos noturnos fechados.

Assim ninguém precisa mexer em horário de plantão nem criar tipos duplicados: basta marcar "Nunca gerar ADN" no FERIADO. Os tipos existentes migram sozinhos: quem hoje tem a caixinha "Gera ADN" ligada vira "Automático pelo horário", quem tem desligada vira "Nunca gerar ADN" — o que já corrige FERIADO, MANHÃ/TARDE, Diurno 12h, Sobreaviso e Folga.

### 3. Uma única fonte de cálculo

O ADN passa a ser calculado por uma função compartilhada, usada pela grade da tela, pela Escala Mensal Oficial e pelo PDF, para os três resultados serem sempre idênticos.

## Detalhes técnicos

1. Migração: adicionar `adn_modo text not null default 'auto'` em `public.shift_types` (valores `nunca` | `auto` | `sempre`), preenchendo `nunca` onde `gera_adicional_noturno` é falso e `auto` onde é verdadeiro. A coluna antiga é mantida por compatibilidade.
2. `src/components/ShiftTypesManager.tsx`: substituir o checkbox "Gera Adicional Noturno" por um select com as três opções, gravando `adn_modo` (e espelhando `gera_adicional_noturno = adn_modo !== 'nunca'`).
3. Nova função em `src/lib/adn.ts`: `calcularAdnPlantao({ hora_inicio, hora_fim, carga, adn_modo, adnConfig })` encapsulando o veto por modo, `carga > 0`, filtro `adnConfig.shift_types` e os tipos de cálculo (`hours`, `shifts`, `fixed_per_shift`).
4. `src/pages/EscalaPage.tsx` (~2503): `recebe_adn` = apenas `professionals.recebe_adicional_noturno`; enviar `is_plantonista`/cargo em campo separado (`plantonista`) e `adn_modo` do tipo; ajustar `TIPOS_PLANTAO` (~328) para expor `adn_modo`.
5. `src/components/schedule/MonthlyConsolidatedGrid.tsx` (~160-230) e `src/pages/EscalaPage.tsx` (~1341-1420, dados da oficial/PDF): usar `calcularAdnPlantao`; elegibilidade = `recebe_adn === true` (ou critérios de `adnConfig`), com veto absoluto quando `recebe_adn === false`; `elegivelAdn` falso renderiza "—".
6. Sem alteração nas telas de impressão além do consumo dos totais já corrigidos.

