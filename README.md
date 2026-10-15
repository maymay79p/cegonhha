# Cegonha

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.

## Perfis atuais

- Morador
- Portaria

O perfil de síndico não faz parte do sistema atual.

## Recursos principais

- cadastro e atualização de dados pessoais;
- registro de encomendas pela Portaria;
- histórico geral da Portaria e individual do Morador;
- central de notificações interna para Morador e Portaria;
- **push notifications com Expo Notifications** para avisos mesmo quando o aplicativo não está em primeiro plano;
- notificações automáticas de chegada, retirada, lembrete, vínculo, entrega prevista e denúncia;
- OCR de etiquetas com **Google ML Kit**, executado no próprio aparelho, com tentativa de leitura de nome, CPF, bloco e apartamento;
- cruzamento dos dados lidos na etiqueta com os moradores do condomínio;
- histórico das leituras OCR da Portaria;
- mural do condomínio em tempo real com nome e data da publicação, exclusão pelo autor, denúncia por outros usuários e moderação pela Portaria;
- central de denúncias;
- relatórios semanais e indicadores da Portaria;
- localização/endereço do condomínio com abertura no aplicativo de mapas;
- código do condomínio em tela de destaque com opção de copiar;
- pesquisa e filtros nas áreas de encomendas;
- atualização em tempo real com listeners do Firestore;
- tema claro, escuro ou conforme o sistema;
- login por e-mail/senha e opção de autenticação com Google.

## Instalação e validação

```bash
npm install
npm install --prefix functions
npm run typecheck
npm test --prefix functions
npm run doctor
```

O GitHub Actions instala as dependências do aplicativo e das Cloud Functions, executa o TypeScript do app e os testes do backend de push a cada alteração da `main`.

## Firebase

O projeto usa Firestore Security Rules e Cloud Functions. Depois de atualizar o projeto, publique regras e funções com:

```bash
npm run firebase:deploy
```

Para publicar separadamente:

```bash
npm run firebase:rules
npm run firebase:functions
```

Isso é especialmente importante para notificações, tokens de push, vínculo de moradores, mural e denúncias.

## Comunicação entre Morador e Portaria

A comunicação prevista pelo Cegonha é operacional e coletiva, não um chat privado individual.

### Portaria → Morador

O Morador recebe aviso interno e, quando autorizou notificações no aparelho, push notification quando:

- uma encomenda é registrada em seu nome;
- uma retirada é confirmada pela Portaria;
- uma encomenda permanece há mais de 3 dias aguardando retirada;
- sua solicitação de vínculo com o condomínio é aprovada ou rejeitada.

### Morador → Portaria

A Portaria recebe aviso interno e push notification quando:

- um Morador solicita vínculo com o condomínio;
- um Morador cadastra uma nova entrega prevista;
- uma publicação do Mural é denunciada.

Cada usuário da Portaria possui seu próprio estado de leitura dos avisos internos. Assim, um porteiro abrir uma notificação não a marca automaticamente como lida para os demais usuários da Portaria.

### Comunicação geral

Moradores e Portaria vinculados ao mesmo condomínio usam o **Mural** como canal comum de comunicação em tempo real. As mensagens exibem autor, perfil, data e horário, têm filtro de linguagem imprópria e podem ser denunciadas. O autor pode excluir a própria publicação e a Portaria pode moderar o conteúdo.

**Chat privado Morador ↔ Portaria não faz parte da proposta funcional do Cegonha.** Os canais definidos para o projeto são os avisos automáticos relacionados à operação das encomendas e o Mural para comunicação coletiva do condomínio.

As gravações críticas de encomenda e comunicação usam batches/transações quando necessário. Dessa forma, ações como registrar chegada, retirada, lembrete ou decidir uma solicitação de vínculo evitam estados parciais, como atualizar o status sem criar o aviso correspondente.

## Push notifications com Expo Notifications

O aplicativo registra um `ExpoPushToken` por instalação autorizada na coleção `pushDispositivos`. O registro contém somente os dados necessários para direcionar os avisos: usuário, perfil, condomínio, plataforma, token e estado ativo.

Quando um documento é criado em `notificacoes`, a Cloud Function `enviarPushDaNotificacao` identifica os dispositivos destinatários e envia a mensagem pelo Expo Push Service. O mesmo documento continua alimentando a Central de Avisos dentro do aplicativo, portanto push e histórico interno permanecem sincronizados a partir da mesma origem.

O fluxo cobre:

- chegada de encomenda;
- retirada registrada;
- lembrete de encomenda há mais de 3 dias;
- aprovação ou rejeição de vínculo;
- nova solicitação de vínculo para a Portaria;
- nova entrega prevista para a Portaria;
- nova denúncia do Mural para a Portaria.

No Android, o aplicativo cria o canal `cegonha-geral`. Quando a conta é desconectada pelo Perfil, o registro daquele dispositivo é removido do Firestore para reduzir o risco de outra pessoa no mesmo aparelho receber avisos da conta anterior. Tokens que o Expo informar como `DeviceNotRegistered` também são removidos automaticamente pelo backend.

### Configuração necessária no ambiente real

`expo-notifications` é um módulo nativo. Depois de atualizar as dependências, gere uma nova development build:

```bash
npm install
eas build --profile development -p android
```

Depois de instalar a nova build no celular:

```bash
npm run start:dev
```

Para Android, as credenciais **FCM V1** do projeto precisam estar configuradas no EAS/Firebase para que o Expo Push Service consiga entregar notificações remotas. Não coloque arquivo de conta de serviço, chave privada ou outra credencial secreta no repositório público.

O aplicativo solicita a permissão de notificações depois que o perfil autenticado é carregado. Se o usuário negar, a Central de Avisos interna continua funcionando normalmente, mas não haverá push do sistema operacional naquele aparelho.

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

O Expo Go não contém os módulos nativos usados pelo projeto e não deve ser usado para validar o OCR ou o push remoto.

## Login com Google

O código do aplicativo possui o botão **Continuar com Google**, troca do token do Google por uma credencial do Firebase e fluxo de primeiro acesso para completar o cadastro de Morador ou Portaria.

Para ativar a integração no ambiente real:

1. No Firebase Console, abra **Authentication > Sign-in method** e habilite o provedor **Google**.
2. No projeto Google Cloud/Firebase, mantenha os Client IDs OAuth necessários para Web, Android e/ou iOS.
3. Para Android, use o package `com.maymay79p.cegonha` e configure a impressão digital SHA exigida pelo Google.
4. Para iOS, use o bundle identifier `com.maymay79p.cegonha`.
5. Os Client IDs Web e Android atuais já estão definidos no projeto; `.env` pode sobrescrevê-los quando necessário.
6. Reinicie o Metro limpando o cache após alterações de ambiente.

Em Android/iOS, OAuth deve ser validado em development build ou compilação do aplicativo, para que o scheme `cegonha://` possa retornar corretamente ao app.

No primeiro login com Google, se ainda não existir um documento do usuário no Firestore, o Cegonha mantém a sessão autenticada e abre a tela **Concluir cadastro**. O usuário escolhe Morador ou Portaria, informa os campos obrigatórios e o sistema cria o perfil sem solicitar uma nova senha.

## Mural do condomínio

Moradores e Portaria vinculados ao mesmo condomínio podem publicar mensagens no Mural. Cada publicação registra o ID e o nome do autor, o tipo de perfil e a data/hora. O autor pode excluir a própria publicação; outros usuários podem denunciá-la; e a Portaria possui recursos de moderação e banimento.

## Observações de execução

O lembrete de encomenda com mais de 3 dias ainda é identificado quando a Portaria utiliza o aplicativo e o painel encontra a pendência. O aviso gerado por esse fluxo passa a ser enviado também por push. Para que a verificação dos 3 dias aconteça mesmo sem nenhum aparelho da Portaria abrir o app, seria necessário transformar essa verificação em uma tarefa agendada no backend.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo. Um mapa incorporado no Cegonha exigiria uma biblioteca/SDK de mapas e configuração adicional.
