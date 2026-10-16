# Cegonha

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.

## Perfis atuais

- Morador
- Portaria

O perfil de síndico não faz parte do sistema atual. Também não existe chat privado Morador ↔ Portaria: a comunicação do projeto é feita por avisos operacionais e pelo Mural coletivo.

## Jeito mais simples de rodar

O Cegonha usa módulos nativos para OCR, login Google e push. Por isso, o modo principal é uma **development build**.

Depois de atualizar o projeto:

```bash
git pull origin main
npm run setup
npm run firebase:deploy
```

Depois desta atualização de OCR/login Google, gere uma APK limpa **uma vez**:

```bash
npm run rebuild:android
```

Instale a APK gerada no Android. A partir daí, para alterações normais de telas, TypeScript, Firestore e regras de negócio, use apenas:

```bash
npm start
```

`npm start` abre o Metro para a development build completa. Não é necessário gerar outra APK até que uma dependência/configuração nativa mude.

O Expo Go continua disponível em modo limitado:

```bash
npm run go
```

Nesse modo OCR, Google Sign-In nativo e push remoto são desativados de propósito.

## Comandos úteis

```bash
npm run setup                 # instala dependências e valida TypeScript
npm run rebuild:android       # gera APK limpa quando módulos nativos mudarem
npm start                     # development build completa
npm run go                    # Expo Go limitado
npm run build:preview:android # gera APK de demonstração/preview
npm run typecheck             # verifica TypeScript
npm run check                 # TypeScript + bundle Expo Go + Expo Doctor
npm run firebase:deploy       # publica somente regras do Firestore
```

O EAS está configurado para gerar APK nos perfis `development` e `preview`, facilitando a instalação direta no Android.

## Firebase sem complicar o desenvolvimento

O funcionamento básico do aplicativo não depende de Cloud Functions.

Para publicar as regras atuais do Firestore:

```bash
npm run firebase:deploy
```

Esse comando **não publica Functions** e, portanto, não esbarra no plano Blaze apenas para testar o app.

O backend opcional de push pode ser publicado separadamente:

```bash
npm install --prefix functions
npm run firebase:deploy:push
```

A publicação de Functions exige que o projeto Firebase permita Cloud Functions/Artifact Registry. Se o backend de push não estiver publicado, a Central de Avisos interna continua funcionando.

## Recursos principais

- cadastro e atualização de dados pessoais;
- CPF e telefone com formatação/validação;
- confirmação de e-mail no cadastro por e-mail/senha;
- login por e-mail/senha e Google;
- registro de encomendas pela Portaria;
- histórico geral da Portaria e individual do Morador;
- Central de Avisos para Morador e Portaria;
- notificações automáticas de chegada, retirada, lembrete, vínculo, entrega prevista e denúncia;
- push notifications com Expo Notifications quando o backend/FCM estiver configurado;
- OCR local com Google ML Kit no Android, via `expo-ocr-kit`;
- tentativa de leitura de nome, CPF, bloco e apartamento;
- histórico das leituras OCR;
- Mural em tempo real, com filtro de linguagem imprópria, denúncia e moderação;
- Central de Denúncias para ambos os perfis;
- relatórios semanais e indicadores da Portaria;
- localização/endereço do condomínio com abertura no app de mapas;
- código do condomínio com opção de copiar;
- pesquisa e filtros;
- listeners do Firestore em tempo real;
- tema claro, escuro ou conforme o sistema.

## Comunicação entre Morador e Portaria

A comunicação prevista pelo Cegonha é operacional e coletiva.

### Portaria → Morador

O Morador recebe avisos quando:

- uma encomenda é registrada em seu nome;
- uma retirada é confirmada;
- uma encomenda permanece mais de 3 dias aguardando retirada;
- uma solicitação de vínculo é aprovada ou rejeitada.

### Morador → Portaria

A Portaria recebe avisos quando:

- um Morador solicita vínculo com o condomínio;
- um Morador registra uma entrega prevista;
- uma publicação do Mural é denunciada.

### Comunicação geral

Moradores e Portaria do mesmo condomínio usam o **Mural** para comunicação coletiva. Publicações possuem autor, perfil, data/hora, filtro de linguagem imprópria e sistema de denúncia/moderação.

**Contato individual por chat não faz parte da proposta funcional do Cegonha.**

## Confirmação de chegada

A encomenda é o registro principal da confirmação. O fluxo foi estruturado para que falhas auxiliares de foto, auditoria ou telemetria do OCR não cancelem a chegada inteira.

O aviso ao Morador é criado logo após a encomenda. Se regras antigas do Firestore bloquearem esse aviso, a tela informa que a chegada foi registrada e orienta a publicar as regras atuais:

```bash
npm run firebase:deploy
```

## OCR

O OCR usa `expo-ocr-kit`, um módulo baseado na Expo Modules API. No Android, o reconhecimento é feito com Google ML Kit no próprio aparelho.

Como OCR é nativo, ele precisa estar compilado na APK. Se aparecer `native module not found`, `not linked` ou mensagem semelhante:

```bash
npm run rebuild:android
```

Instale a APK nova e depois volte a usar:

```bash
npm start
```

## Login Google

No Android, o login usa `@react-native-google-signin/google-signin`, em vez de depender do redirecionamento OAuth pelo navegador. Isso evita o fluxo web que pode gerar `400 invalid_request`.

O package Android é:

```text
com.maymay79p.cegonha
```

O Firebase recebe o `idToken` do Google e conclui a autenticação normalmente.

Se uma APK limpa ainda retornar `DEVELOPER_ERROR`, confira a SHA-1 da chave Android usada pelo EAS:

```bash
npx eas-cli@latest credentials -p android
```

Essa SHA-1 precisa estar cadastrada no cliente Android `com.maymay79p.cegonha` no Firebase/Google Cloud. Depois de alterar a credencial externa, gere outra APK limpa.

## Push notifications

O app registra um `ExpoPushToken` por instalação autorizada em `pushDispositivos`. Na development build, quando FCM/EAS e a Cloud Function estiverem configurados, a função `enviarPushDaNotificacao` processa os documentos criados em `notificacoes` e envia avisos pelo Expo Push Service.

No Expo Go esse recurso é substituído por um stub seguro. Para Android real, ainda é necessário configurar FCM V1/EAS. Não coloque chaves privadas ou arquivos de conta de serviço no repositório público. Veja `docs/PUSH_SETUP.md`.

## Validação automática

O GitHub Actions:

- instala as dependências do app;
- verifica TypeScript;
- executa `expo prebuild` do Android para validar plugins/autolink nativo;
- gera o bundle do modo Expo Go;
- instala e testa o backend de push.

## Observações

O lembrete de encomenda com mais de 3 dias ainda é identificado quando a Portaria abre o aplicativo e o painel encontra a pendência. Para executar essa verificação sem nenhum aparelho aberto seria necessário um processo agendado no backend.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo.

Para o passo a passo de execução, veja `docs/RODAR_APP.md`.
