# Órbita Calendar

O Órbita é um gerenciador de agendas que reúne calendários do Google e agendas próprias em um único lugar. A ideia é ter uma visão completa da rotina, mantendo trabalho, estudos e vida pessoal organizados em espaços separados.

Criei o projeto para estudar desenvolvimento e resolver uma necessidade do meu dia a dia: organizar os horários dos treinamentos no trabalho e conciliá-los com meus compromissos pessoais. Cada evento fica na agenda escolhida, com suas próprias cores e informações, sem misturar os assuntos.

## O que já dá para fazer

- Consultar a rotina por dia, semana, mês ou lista de compromissos.
- Conectar o Google Calendar e escolher em qual agenda criar cada evento.
- Criar, editar, duplicar, mover e excluir agendamentos, conforme as permissões de cada agenda.
- Registrar nome do contato, empresa e telefone nos treinamentos e solicitar um link do Google Meet.
- Personalizar nomes e cores das agendas do Órbita, além de excluir e restaurar agendas próprias.
- Usar tema claro, escuro ou automático, alto contraste, texto ampliado e redução de animações.
- Acessar pelo computador, tablet ou celular e instalar pelo navegador como aplicativo.

A agenda do Bitrix pode ser usada quando estiver disponível na conta Google conectada. A chegada dos eventos ao Bitrix24 depende da sincronização entre os dois serviços.

## Cada pessoa começa do zero

A instalação não inclui compromissos, horários agendados, dados de contatos ou uma conta Google conectada. Depois de entrar, cada pessoa recebe suas próprias agendas vazias e decide como organizá-las.

- Eventos, nomes, cores, agendas excluídas e históricos são separados por usuário no servidor.
- Cada pessoa autoriza a própria conta Google. Não existe uma agenda Bitrix ou uma conta pessoal fixa no código.
- A seleção de agendas do navegador também é separada por usuário.
- O repositório não inclui banco de dados, tokens OAuth, segredos ou a identidade da instalação original.

Para hospedar uma cópia, registre seu próprio site, configure um banco D1 novo e as credenciais OAuth do seu aplicativo. Configure também quem pode acessar a instalação. Nenhuma base de dados da instalação original deve ser copiada.

## Desenvolvimento

O projeto usa **TypeScript, React, Vinext, Cloudflare Workers, D1 e Drizzle**. Os eventos próprios ficam no servidor, separados por usuário. A conexão direta com o Google usa OAuth, e as credenciais ficam na configuração privada do servidor.

É necessário Node.js 22.13 ou superior e um ambiente compatível com o runtime do Sites. As configurações locais e os segredos não fazem parte deste repositório.

```sh
node scripts/install-ci.mjs
node scripts/run-framework.mjs dev
```

Para conferir os tipos e compilar:

```sh
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
```

A configuração da conexão Google está descrita em [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md).

## Sobre o projeto

Este é um projeto de estudo em evolução, construído a partir do uso real. O foco é tornar a organização dos compromissos mais prática, tanto no trabalho quanto fora dele.

O funcionamento depende de internet. Algumas operações do Google dependem das permissões da conta; eventos com convidados ou recorrência têm restrições para preservar seus vínculos. A instalação e a sincronização entre aparelhos físicos ainda precisam de validação em cada equipamento.

Projeto independente, sem vínculo com Notion, Google ou Bitrix24.
