# Cegonha

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.

## Perfis atuais

- Morador
- Portaria

O perfil de síndico não faz parte do sistema atual. Também não existe chat privado Morador ↔ Portaria: a comunicação do projeto é feita por avisos operacionais e pelo Mural coletivo.

## Jeito mais fácil de rodar

O projeto agora tem **dois modos de desenvolvimento** para não obrigar uma nova build nativa a cada teste.

### 1. Modo rápido — Expo Go

Use para testar login, cadastro, telas, Firestore, encomendas, histórico, Mural, denúncias, relatórios, perfil e a Central de Avisos.

Na primeira vez:

```bash
npm run setup
```

Depois:

```bash
npm start
```

O comando `npm start` força o **Expo Go**. Escaneie o QR Code com o Expo Go no Android.

Neste modo, o app **não tenta registrar push remoto** e continua funcionando normalmente. O OCR com Google ML Kit e o push do sistema operacional precisam de uma development build.

### 2. Modo completo — development build

Use quando precisar testar:

- OCR com Google ML Kit;
- push notification real;
- login Google no ambiente nativo;
- qualquer outra integração nativa.

Gere o APK quando houver mudança em dependências/configuração nativa:

```bash
npm run build:android
```

Instale o APK gerado no celular. Depois, nas próximas vezes, normalmente basta:

```bash
npm run dev
```

**Não é necessário gerar uma nova APK a cada alteração de tela ou TypeScript.** Só gere novamente quando uma biblioteca/configuração nativa mudar.

## Comandos úteis

```bash
npm run setup               # instala/ajusta dependências e valida TypeScript
npm start                   # Expo Go (modo rápido)
npm run dev                 # development build (modo completo)
npm run build:android       # gera APK de desenvolvimento no EAS
npm run build:preview:android # gera APK de demonstração/preview
npm run typecheck           # verifica TypeScript
npm run check               # TypeScript + Expo Doctor
```

O EAS está configurado para gerar **APK** nos perfis `development` e `preview`, facilitando a instalação direta no Android.

## Firebase sem complicar o desenvolvimento

O funcionamento básico do aplicativo não deve depender de Cloud Functions.

Para publicar somente as regras do Firestore:

```bash
npm run firebase:deploy
```

Esse comando agora é equivalente ao deploy das regras e **não tenta publicar Functions**, portanto não esbarra no plano Blaze apenas para testar o app.

Para o backend opcional de push notification:

```bash
npm install --prefix functions
npm run firebase:deploy:push
```

A publicação das Functions exige que o projeto Firebase permita Cloud Functions/Artifact Registry (normalmente plano Blaze). Se o backend de push não estiver publicado, a Central de Avisos interna do Cegonha continua funcionando.

## Recursos principais

- cadastro e atualização de dados pessoais;
- CPF e telefone com formatação/validação;
- confirmação de e-mail no cadastro por e-mail/senha;
- registro de encomendas pela Portaria;
- histórico geral da Portaria e individual do Morador;
- Central de Avisos para Morador e Portaria;
- notificações automáticas de chegada, retirada, lembrete, vínculo, entrega prevista e denúncia;
- push notifications com Expo Notifications quando o backend/FCM estiver configurado;
- OCR local com Google ML Kit para nome, CPF, bloco e apartamento;
- histórico das leituras OCR;
- Mural em tempo real, com filtro de linguagem imprópria, denúncia e moderação;
- Central de Denúncias para ambos os perfis;
- relatórios semanais e indicadores da Portaria;
- localização/endereço do condomínio com abertura no app de mapas;
- código do condomínio com opção de copiar;
- pesquisa e filtros;
- listeners do Firestore em tempo real;
- tema claro, escuro ou conforme o sistema;
- login por e-mail/senha e Google.

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

## Push notifications

O app registra um `ExpoPushToken` por instalação autorizada em `pushDispositivos`. No Expo Go esse registro é ignorado de propósito para permitir desenvolvimento simples sem erros de módulo/credencial.

Na development build, quando FCM/EAS e a Cloud Function estiverem configurados, a função `enviarPushDaNotificacao` processa os documentos criados em `notificacoes` e envia os avisos pelo Expo Push Service.

Para Android real, ainda é necessário configurar FCM V1/EAS. Não coloque chaves privadas ou arquivo de conta de serviço no repositório público. Veja `docs/PUSH_SETUP.md`.

## OCR com Google ML Kit

O OCR é executado localmente com `@react-native-ml-kit/text-recognition`. Por ser um módulo nativo, ele não funciona dentro do Expo Go.

Para testar OCR:

```bash
npm run build:android
```

Instale o APK e depois rode:

```bash
npm run dev
```

O restante do app pode ser desenvolvido normalmente com `npm start` no Expo Go.

## Login Google

O código possui o fluxo de autenticação Google/Firebase. Para Android nativo, use o package `com.maymay79p.cegonha` e mantenha SHA/OAuth configurados no Google/Firebase. O teste mais confiável desse fluxo é feito na development build.

## Validação automática

O GitHub Actions instala as dependências, executa o TypeScript e testa o código do backend de push. Alterações na `main` passam por essa validação automaticamente.

## Observações

O lembrete de encomenda com mais de 3 dias ainda é identificado quando a Portaria abre o aplicativo e o painel encontra a pendência. Para executar essa verificação sem nenhum aparelho aberto seria necessário um processo agendado no backend.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo.

Para um passo a passo curto de execução, veja `docs/RODAR_APP.md`.
