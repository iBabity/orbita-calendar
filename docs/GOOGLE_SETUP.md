# Conexão com Google Calendar

Crie um projeto próprio no Google Cloud, ative a Google Calendar API e configure uma credencial OAuth do tipo Aplicativo da Web. Cadastre o domínio do seu ambiente e a URI de retorno no formato `https://SEU_DOMINIO/api/google-auth/callback`.

Configure no servidor, fora do código:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI
- GOOGLE_TOKEN_ENCRYPTION_KEY: chave aleatória de 32 bytes em base64 para proteger os tokens armazenados.

A aplicação solicita openid, email, calendar.calendarlist.readonly e calendar.events. A conta conectada precisa ter permissão de escrita nas agendas que serão usadas para criar ou alterar eventos. Em modo de testes, cadastre os usuários de teste no Google Cloud.

Cada usuário autoriza o acesso à própria conta. Não troque a chave de criptografia de uma instalação existente sem planejar a migração dos tokens.

A autenticação do site e a conexão do Google são fluxos separados. Para publicar outra instalação, configure também sua própria identidade de projeto no Sites, as permissões de acesso e o banco D1.
