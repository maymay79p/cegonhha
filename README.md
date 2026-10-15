# Cegonha

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.

## Perfis atuais

- Morador
- Portaria

O perfil de síndico não faz mais parte do sistema.

## Recursos principais

- cadastro e atualização de dados pessoais do morador;
- registro de encomendas pela portaria;
- histórico geral da portaria e individual do morador;
- central de notificações interna para Morador e Portaria;
- notificações automáticas de chegada, retirada, lembrete, vínculo, entrega prevista e denúncia;
- OCR de etiquetas com **Google ML Kit**, executado no próprio aparelho, com tentativa de leitura de nome, CPF, bloco e apartamento;
- cruzamento dos dados lidos na etiqueta com os moradores do condomínio;
- histórico das leituras OCR da portaria;
- mural do condomínio em tempo real com nome e data da publicação, exclusão pelo autor, denúncia por outros usuários e moderação pela portaria;
- localização/endereço do condomínio com abertura no aplicativo de mapas;
- código do condomínio em tela de destaque com opção de copiar;
- pesquisa e filtros nas áreas de encomendas;
- atualização em tempo real com listeners do Firestore;
- tema claro, escuro ou conforme o sistema;
- login por e-mail/senha e opção de autenticação com Google.

## Instalação e validação

```bash
npm install
npm run typecheck
npm run doctor
```

O GitHub Actions instala as dependências e executa `npm run typecheck` nas alterações da `main`.

## Firebase

Depois de alterar `firestore.rules`, publique as regras no projeto Firebase antes de testar os novos recursos:

```bash
npm run firebase:rules
```

Isso é especialmente importante para notificações, vínculo de moradores, mural e denúncias, pois as permissões de cada fluxo são verificadas pelo Firestore.

## Comunicação entre Morador e Portaria

A comunicação operacional é bidirecional e utiliza o Firestore em tempo real.

### Portaria → Morador

O Morador recebe avisos internos quando:

- uma encomenda é registrada em seu nome;
- uma retirada é confirmada pela Portaria;
- uma encomenda permanece há mais de 3 dias aguardando retirada;
- sua solicitação de vínculo com o condomínio é aprovada ou rejeitada.

### Morador → Portaria

A Portaria recebe avisos internos quando:

- um Morador solicita vínculo com o condomínio;
- um Morador cadastra uma nova entrega prevista;
- uma publicação do Mural é denunciada.

Cada usuário da Portaria possui seu próprio estado de leitura dos avisos de Portaria. Assim, um porteiro abrir uma notificação não faz com que ela seja marcada como lida para os demais usuários da Portaria.

### Comunicação geral

Moradores e Portaria vinculados ao mesmo condomínio usam o **Mural** como canal comum de comunicação em tempo real. As mensagens exibem autor, perfil, data e horário, têm filtro de linguagem imprópria e podem ser denunciadas. O autor pode excluir a própria publicação e a Portaria pode moderar o conteúdo.

As gravações críticas de encomenda e comunicação foram agrupadas em batches/transações quando necessário. Dessa forma, ações como registrar chegada, retirada, lembrete ou decidir uma solicitação de vínculo evitam ficar em estado parcial, por exemplo com o status alterado mas sem o aviso correspondente.

## OCR com Google ML Kit

O Cegonha usa `@react-native-ml-kit/text-recognition` para reconhecer o texto das etiquetas localmente no Android/iOS. A imagem não precisa ser enviada para um serviço externo de OCR e não existe chave de API de OCR para configurar.

Depois de instalar ou atualizar a dependência nativa, é necessário gerar uma nova build do aplicativo. Para Android:

```bash
npm install
eas build --profile development -p android
```

Depois de instalar a development build no celular, inicie o Metro com:

```bash
npm run start:dev
```

O Expo Go não contém o módulo nativo do ML Kit e, por isso, não deve ser usado para testar o OCR.

## Login com Google

O código do aplicativo já possui o botão **Continuar com Google**, troca do token do Google por uma credencial do Firebase e fluxo de primeiro acesso para completar o cadastro de Morador ou Portaria.

Para ativar a integração no ambiente real:

1. No Firebase Console, abra **Authentication > Sign-in method** e habilite o provedor **Google**.
2. No projeto Google Cloud/Firebase, crie os Client IDs OAuth necessários para Web, Android e/ou iOS.
3. Para Android, use o package `com.maymay79p.cegonha` e configure a impressão digital SHA exigida pelo Google.
4. Para iOS, use o bundle identifier `com.maymay79p.cegonha`.
5. Os Client IDs Web e Android atuais já estão definidos no projeto; `.env` pode sobrescrevê-los quando necessário.
6. Reinicie o Metro limpando o cache após alterações de ambiente.

Em Android/iOS, OAuth não deve ser validado pelo Expo Go. Use uma development build ou uma compilação do aplicativo para que o scheme `cegonha://` possa retornar corretamente ao app.

No primeiro login com Google, se ainda não existir um documento do usuário no Firestore, o Cegonha mantém a sessão autenticada e abre a tela **Concluir cadastro**. O usuário escolhe Morador ou Portaria, informa os campos obrigatórios e o sistema cria o perfil sem solicitar uma nova senha.

## Mural do condomínio

Moradores e Portaria vinculados ao mesmo condomínio podem publicar mensagens no mural. Cada publicação registra o ID e o nome do autor, o tipo de perfil e a data/hora. O autor pode excluir a própria publicação; outros usuários podem denunciá-la; e a Portaria mantém os recursos de moderação e banimento.

## Limites atuais

As notificações desta etapa são internas ao aplicativo, armazenadas no Firestore e exibidas em tempo real enquanto o aplicativo está conectado. **Ainda não são notificações push do sistema operacional com o aplicativo totalmente fechado.** Esse recurso exige tokens de dispositivo e um serviço de envio, como Expo Notifications/FCM com um backend ou função em nuvem.

O Mural é o canal geral de comunicação do condomínio. O Cegonha não possui, nesta versão, chat privado direto entre Morador e Portaria.

O lembrete de encomenda com mais de 3 dias é disparado quando a Portaria utiliza o aplicativo e o painel identifica a pendência. Para transformá-lo em um agendamento independente de qualquer aparelho aberto, será necessário um processo de backend agendado.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo. Um mapa incorporado no Cegonha exigirá uma biblioteca/SDK de mapas e configuração adicional.
