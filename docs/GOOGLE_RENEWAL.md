# Renovação da conexão Google

A conexão Google é renovada no servidor com a autorização já salva. Expirar o acesso de curta duração não deve exigir que a pessoa entre no Google novamente.

## Correção da reconexão diária

Ao carregar várias agendas, duas requisições podiam renovar o mesmo acesso ao mesmo tempo. A requisição que perdia a gravação concorrente devolvia `reauthentication_required`, mesmo havendo uma renovação válida salva. O mesmo acontecia se uma rejeição atrasada chegasse depois de outra requisição renovar a conexão.

Agora o servidor consulta a autorização mais recente e reutiliza a renovação vencedora, sem sobrescrevê-la. Erros temporários de rede ou de persistência não viram pedidos de consentimento. Desconexão explícita e troca de conta continuam impedindo o uso da conexão anterior.

Um acesso rejeitado com HTTP 401 permite uma tentativa de renovação. Somente leituras são repetidas uma vez; criação, edição e exclusão nunca são reenviadas automaticamente. Marcações antigas de reconexão podem ser recuperadas usando a autorização salva, com intervalo de cinco minutos após uma rejeição real. “Verificar conexão” permite uma tentativa explícita e somente de leitura, sem abrir o consentimento.

A tela atualiza o estado da conexão ao voltar para a janela e periodicamente enquanto estiver visível. Os testes simulam renovações simultâneas, rejeição atrasada, falha temporária, recuperação de estado antigo e abertura da agenda em sete dias sucessivos.

O Google ainda pode exigir consentimento quando a autorização de longa duração for realmente revogada ou expirar. O aplicativo não tenta contornar essa decisão. Referências: [acesso offline e renovação](https://developers.google.com/identity/protocols/oauth2/web-server#offline) e [expiração de autorizações](https://developers.google.com/identity/protocols/oauth2#expiration).
