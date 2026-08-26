# Corrigir ADN indevido (8.0h) na Escala Mensal

## O que está acontecendo (confirmado nos dados)

JEANE BENTES BATISTA e GABRIEL LORENZI DE SOUZA RIBEIRO estão com o ADN **desmarcado** no cadastro (`recebe_adicional_noturno = false`), mas ambos têm `is_plantonista = true` (Jeane também com cargo "Plantonista").

Os 8.0h vêm de um único plantão: **FERIADO 07/09/2026, 00:00–23:59**. Como a faixa de ADN padrão é 23:00–07:00, esse plantão cruza 00:00–07:00 (7h) + 23:00–23:59 (~1h) = ~8.0h. Não existe configuração salva de ADN no sistema (`adn_config` ausente), então vale a regra antiga.

Duas falhas somadas:

1. **O "desmarcar ADN" do profissional é ignorado na grade da tela.** Ao montar as linhas da escala, o campo enviado para a grade é calculado como "recebe ADN **ou** é plantonista **ou** cargo contém plantonista". Com isso, quem é plantonista volta a ser elegível mesmo com a caixinha desmarcada — o veto explícito nunca é aplicado.
2. **A marcação "Gera Adicional Noturno" do tipo de plantão não é respeitada.** O tipo FERIADO está com essa opção desligada (verificado no banco), mas o cálculo só olha o horário do plantão, ignorando essa flag. Por isso qualquer plantão que toque a faixa noturna gera ADN.

## Correção proposta

- Passar a elegibilidade do profissional sem misturar com "plantonista": o valor de `recebe_adicional_noturno` vai puro para a grade, e a condição de plantonista continua existindo apenas como critério adicional (nunca sobrepondo o desmarcado). Quem está desmarcado passa a mostrar "—".
- Somar ADN somente quando o **tipo de plantão** tiver "Gera Adicional Noturno" ativado. Assim FERIADO, MANHÃ/TARDE, Diurno 12h e Sobreaviso deixam de gerar ADN; Noturno 12h, Noite, Plantão 24h e ADN continuam gerando.
- Aplicar a mesma regra nos três lugares que calculam ADN, para visualização, impressão e PDF ficarem idênticos.

## Detalhes técnicos

1. `src/pages/EscalaPage.tsx` (~linha 2503): `recebe_adn` passa a ser apenas `professionals.recebe_adicional_noturno`; `is_plantonista`/cargo entram em campo separado usado só como critério adicional em `adnConfig.eligibility.by_flag`.
2. `src/components/schedule/MonthlyConsolidatedGrid.tsx` (bloco ~200-222): condicionar o acúmulo de ADN a `s.gera_adn === true` (o campo já é recebido e hoje não é usado) e manter o veto `recebe_adn === false`.
3. `src/pages/EscalaPage.tsx` (bloco ~1341-1420, dados da Escala Mensal Oficial/PDF): incluir `gera_adicional_noturno` no mapeamento do tipo e exigir essa flag antes de somar ADN; manter o veto quando `recebe_adicional_noturno === false` e não usar `is_plantonista` para reverter o veto.
4. Nenhuma alteração de banco: os tipos de plantão e os cadastros já estão corretos.
