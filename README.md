# Plantão Inteligente

Crie um sistema web completo, profissional, robusto e pronto para produção para gestão de plantões hospitalares e multiprofissionais, com foco em hospitais, UPAs, maternidades, pronto atendimento, clínicas e unidades de saúde.

O sistema deve ser construído com arquitetura escalável, interface moderna e fluxo real de operação hospitalar. Ele deve permitir cadastro ilimitado de médicos e outros profissionais da saúde, controle total de escala, trocas de plantão com histórico completo, gestão financeira por profissional, relatórios automáticos, notificações por e-mail e regras inteligentes de validação.

O objetivo é entregar uma aplicação com aparência e comportamento de produto real, já pronta para implantação.

Objetivo do sistema

Desenvolver uma plataforma digital para:

organizar escalas hospitalares

controlar plantões por setor e unidade

evitar conflitos de horário

registrar trocas com auditoria completa

calcular automaticamente pagamentos

gerar relatórios gerenciais e financeiros

enviar notificações automáticas

permitir operação por gestor e por profissionais da saúde

Perfis de acesso

Criar autenticação com controle de permissões por perfil.

1. Gestor Master

Acesso total ao sistema.

Permissões:

cadastrar, editar e excluir profissionais

cadastrar setores, especialidades e unidades

criar e editar plantões

aprovar ou recusar trocas

visualizar dashboard geral

visualizar financeiro completo

emitir relatórios

configurar notificações

configurar regras do sistema

acessar logs e auditoria

2. Coordenador / Supervisor

Permissões limitadas por unidade, setor ou equipe.

Permissões:

visualizar escalas do seu setor

aprovar trocas quando autorizado

acompanhar conflitos

visualizar relatórios da área

gerir equipe local

3. Profissionais de Saúde

O sistema deve aceitar cadastro ilimitado de:

médicos

enfermeiros

fisioterapeutas

técnicos de enfermagem

biomédicos

psicólogos

terapeutas ocupacionais

nutricionistas

fonoaudiólogos

farmacêuticos

outros profissionais da saúde

Permissões:

acessar escala pessoal

visualizar plantões disponíveis

solicitar troca

aceitar ou recusar trocas

acompanhar histórico de trocas

ver valores a receber

receber notificações por e-mail

Estrutura do sistema

O sistema deve ter menu lateral profissional e organizado com os seguintes módulos:

Dashboard

Escala de Plantões

Trocas de Plantão

Profissionais

Setores e Unidades

Financeiro

Relatórios

Notificações

Configurações

Auditoria / Logs

1. Dashboard executivo

Criar uma tela inicial moderna com indicadores em tempo real.

Exibir KPIs:

total de plantões do mês

plantões confirmados

plantões pendentes

trocas solicitadas

trocas aprovadas

trocas recusadas

conflitos detectados

custo total do mês

custo por setor

profissionais ativos

profissionais com maior carga horária

Gráficos:

plantões por semana

plantões por setor

custo por profissional

custo por setor

trocas por período

horas trabalhadas por profissional

Feed de atividades:

quem criou plantão

quem solicitou troca

quem aceitou

quem recusou

quem aprovou

quem cancelou

horário e data de cada ação

2. Módulo de escala de plantões

Criar um calendário interativo com visualização:

mensal

semanal

diária

por lista

Funcionalidades:

criar plantões manualmente

editar plantões

excluir plantões

duplicar plantões

copiar escala para outra semana ou mês

filtrar por profissional

filtrar por setor

filtrar por unidade

filtrar por profissão

filtrar por status

Campos do plantão:

unidade de saúde

setor

profissão

profissional responsável

data

hora de início

hora de término

carga horária

tipo de plantão

valor por hora

valor total do plantão

observações

status do plantão

Status possíveis:

agendado

confirmado

pendente

em aberto

trocando

concluído

cancelado

3. Detecção inteligente de conflitos

Implementar validação automática e obrigatória ao criar ou editar plantões.

O sistema deve impedir:

mesmo profissional em dois plantões no mesmo horário

sobreposição parcial de horários

jornada acima do limite definido

plantão duplicado no mesmo setor e mesmo horário

alocação em unidades incompatíveis no mesmo intervalo

Exibir alertas claros:

conflito de horário

carga horária excedida

plantão já existente

profissional indisponível

Regras configuráveis:

permitir ou bloquear sobreaviso

limite máximo de horas por dia

limite máximo de horas por semana

tempo mínimo de descanso entre plantões

4. Sistema completo de trocas de plantão

Esse módulo é obrigatório e deve ser um dos principais do sistema.

Fluxo 1 — troca para colega específico

Profissional solicita troca para outro colega
→ colega recebe notificação
→ colega aceita ou recusa
→ gestor ou coordenador aprova, se essa regra estiver ativada
→ sistema atualiza a escala
→ tudo fica registrado em histórico

Fluxo 2 — troca para grupo

Profissional disponibiliza plantão para grupo elegível
→ todos os profissionais compatíveis recebem aviso
→ o primeiro que aceitar entra como candidato
→ gestor aprova, se exigido
→ sistema confirma a substituição
→ histórico completo é salvo

Registrar obrigatoriamente:

quem solicitou

quem recebeu

quem aceitou

quem recusou

quem aprovou ou rejeitou

motivo da troca

data e hora de cada etapa

status atual da troca

Status da troca:

solicitada

aguardando resposta

aceita

recusada

aguardando aprovação

aprovada

rejeitada

cancelada

concluída

Extras importantes:

comentário na solicitação

justificativa obrigatória opcional

anexar observação do gestor

histórico cronológico completo

trilha de auditoria

5. Cadastro completo de profissionais

Permitir cadastro ilimitado de profissionais da saúde.

Dados do cadastro:

nome completo

profissão

especialidade

conselho profissional

número do registro

CPF

telefone

e-mail

data de nascimento

endereço

banco

agência

conta

chave PIX

valor por hora

valor por plantão

unidade principal

setor principal

vínculo

status ativo ou inativo

observações internas

Tela individual do profissional:

dados cadastrais

plantões realizados

horas trabalhadas no mês

horas trabalhadas no período

total a receber

histórico de trocas

plantões cancelados

taxa de aceite de trocas

setores em que atua

6. Módulo financeiro

Criar um dashboard financeiro forte, claro e auditável.

Regras de cálculo:

horas trabalhadas × valor/hora = total a receber

plantões fixos podem usar valor por plantão

adicionais podem ser cadastrados

descontos podem ser cadastrados

cálculo por período fechado

Exibir:

total por profissional

total por setor

total por unidade

total por mês

custo previsto

custo realizado

diferenças entre previsto e realizado

Recursos:

filtro por período

filtro por profissional

filtro por setor

filtro por unidade

detalhamento por plantão

exportação

7. Relatórios automáticos

Criar relatórios prontos para operação e gestão.

Relatórios obrigatórios:

relatório de escala por período

relatório financeiro por profissional

relatório financeiro por setor

relatório de trocas

relatório de conflitos detectados

relatório de plantões concluídos

relatório de plantões cancelados

relatório de produtividade por profissional

Exportação:

PDF

Excel

CSV

Os relatórios devem ter:

filtros avançados

cabeçalho com identidade do hospital

período

data de emissão

assinatura visual profissional

paginação em PDF

8. Sistema de notificações

Implementar centro de notificações interno e envio por e-mail.

Eventos que geram notificação:

plantão criado

plantão alterado

plantão cancelado

troca solicitada

troca aceita

troca recusada

troca aprovada

troca rejeitada

lembrete de plantão próximo

pagamento processado

conflito detectado

Canais:

notificação no sistema

e-mail

webhook

9. E-mail e fallback de envio

Implementar envio automático de e-mails com múltiplos canais.

Canal de envio:

Ambos: Webhook + Gmail SMTP

Regra:

Se o webhook falhar, o sistema deve usar automaticamente o Gmail SMTP como fallback.

Tela de configuração:

canal ativo

status do webhook

status do Gmail SMTP

e-mail remetente

nome do remetente

host SMTP

porta

usuário SMTP

senha SMTP

criptografia TLS/SSL

botão testar envio

Status:

configurado

pendente

erro

ativo

10. Notificação ao paciente

Adicionar um módulo opcional e pronto para uso futuro de notificações ao paciente, mesmo que o sistema principal seja focado em plantões.

O sistema deve definir:

como o paciente recebe e-mail

qual canal está ativo

qual remetente será usado

fallback automático

Canais:

webhook

Gmail SMTP

ambos

Regra:

Se webhook falhar e o canal for “Ambos”, o Gmail envia automaticamente como fallback.

Eventos para paciente:

confirmação de atendimento

reagendamento

cancelamento

lembrete de consulta

orientações pré-atendimento

11. Criar mensagens padrão automáticas

Criar uma área de templates de mensagens editáveis, já com modelos prontos.

Modelos de e-mail para profissionais
1. Novo plantão criado

Assunto: Novo plantão atribuído

Mensagem:
Olá, {{nome_profissional}}.

Um novo plantão foi atribuído para você.

Unidade: {{unidade}}
Setor: {{setor}}
Data: {{data}}
Horário: {{hora_inicio}} às {{hora_fim}}

Acesse o sistema para mais detalhes.

2. Solicitação de troca recebida

Assunto: Solicitação de troca de plantão

Mensagem:
Olá, {{nome_profissional}}.

Você recebeu uma solicitação de troca de plantão de {{solicitante}}.

Data: {{data}}
Horário: {{hora_inicio}} às {{hora_fim}}
Setor: {{setor}}

Entre no sistema para aceitar ou recusar.

3. Troca aceita

Assunto: Troca aceita

Mensagem:
Olá, {{nome_profissional}}.

Sua solicitação de troca foi aceita por {{responsavel}} e está aguardando aprovação final.

4. Troca recusada

Assunto: Troca recusada

Mensagem:
Olá, {{nome_profissional}}.

Sua solicitação de troca foi recusada por {{responsavel}}.

Motivo: {{motivo}}

5. Troca aprovada

Assunto: Troca aprovada

Mensagem:
Olá, {{nome_profissional}}.

Sua troca de plantão foi aprovada e a escala já foi atualizada.

6. Lembrete de plantão

Assunto: Lembrete de plantão

Mensagem:
Olá, {{nome_profissional}}.

Este é um lembrete do seu próximo plantão.

Data: {{data}}
Horário: {{hora_inicio}} às {{hora_fim}}
Setor: {{setor}}
Unidade: {{unidade}}

Modelos de e-mail para pacientes
1. Confirmação de atendimento

Assunto: Confirmação de atendimento

Mensagem:
Olá, {{nome_paciente}}.

Seu atendimento foi confirmado com sucesso.

Data: {{data}}
Horário: {{hora}}
Unidade: {{unidade}}
Setor/Especialidade: {{setor}}

Em caso de necessidade, entre em contato com a unidade.

2. Reagendamento

Assunto: Seu atendimento foi reagendado

Mensagem:
Olá, {{nome_paciente}}.

Seu atendimento foi reagendado.

Nova data: {{nova_data}}
Novo horário: {{novo_horario}}
Unidade: {{unidade}}

3. Cancelamento

Assunto: Atendimento cancelado

Mensagem:
Olá, {{nome_paciente}}.

Informamos que seu atendimento foi cancelado.

Motivo: {{motivo}}

Se necessário, entre em contato para novo agendamento.

4. Lembrete de atendimento

Assunto: Lembrete de atendimento

Mensagem:
Olá, {{nome_paciente}}.

Lembramos que você possui atendimento agendado para:

Data: {{data}}
Horário: {{hora}}
Unidade: {{unidade}}

12. Configurações do sistema

Criar painel completo com:

nome do hospital

logo

cores da identidade visual

setores

unidades

profissões

especialidades

tipos de plantão

regras de conflito

necessidade de aprovação do gestor

notificações automáticas

parâmetros financeiros

templates de mensagens

integração por webhook

integração Gmail SMTP

13. Auditoria e logs

Criar módulo de auditoria completo.

Registrar:

login

logout

criação de plantão

edição de plantão

exclusão de plantão

solicitação de troca

aceite

recusa

aprovação

rejeição

alteração financeira

envio de notificação

erro de envio

exportação de relatório

Cada log deve conter:

usuário

ação

data

hora

módulo

detalhes da ação

14. Experiência visual

A interface deve ser:

moderna

limpa

profissional

hospitalar

intuitiva

elegante

rápida

Direção visual:

aparência premium

cards organizados

tabelas bonitas

calendário visual forte

gráficos claros

navegação simples

excelente experiência em celular e desktop

Use uma identidade visual séria, com aparência de software hospitalar real.

15. Requisitos técnicos

Quero o sistema já estruturado de forma profissional, com:

frontend moderno

backend funcional

banco de dados real

autenticação segura

permissões por perfil

formulários validados

persistência real dos dados

responsividade completa

exportação de relatórios

envio real de e-mails

logs de auditoria

arquitetura preparada para crescimento

16. Dados de demonstração

Popular o sistema com dados fictícios para demonstração, incluindo:

unidades

setores

médicos

enfermeiros

fisioterapeutas

plantões

trocas

relatórios

notificações

Quero entrar e já ver o sistema funcionando.

17. Login inicial do gestor

Criar automaticamente um usuário gestor master e exibir claramente as credenciais iniciais:

E-mail: gestor@hospital.com

Senha: gestor123

Esse login deve ter acesso total ao sistema.

18. Entrega final esperada

Quero um sistema completo, pronto para ser lançado, com:

dashboard funcional

gestão de escalas

trocas com histórico completo

cadastro ilimitado de profissionais da saúde

cálculo financeiro automático

relatórios exportáveis

notificação por e-mail

fallback entre webhook e Gmail SMTP

mensagens padrão prontas

módulo opcional de notificação ao paciente

configuração administrativa completa

login inicial do gestor

interface profissional e pronta para uso real

19. Regra importante de qualidade

Não entregar apenas protótipo visual.

Quero:

telas funcionais

fluxos reais

persistência de dados

regras de negócio implementadas

sistema utilizável

aparência de produto pronto para produção

20. Prioridade do projeto

Priorizar:

funcionamento real

estabilidade

clareza da operação

segurança

boa experiência do usuário

visual profissional

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gestorplantaosmsoriximina.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/392c26f5-73ff-4814-a607-e2da47bcaa56).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
