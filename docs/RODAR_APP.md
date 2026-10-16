# Rodar o Cegonha sem sofrimento

O Cegonha usa recursos nativos para OCR, login Google e push. Por isso, o modo principal do projeto agora é uma **development build**. A vantagem é que você gera a APK quando uma dependência nativa muda e, depois disso, alterações normais de telas e TypeScript rodam só com `npm start`.

## Depois de baixar/atualizar o projeto

Na pasta do projeto:

```bash
git pull origin main
npm run setup
npm run firebase:deploy
```

`npm run firebase:deploy` publica somente as regras do Firestore. Ele não tenta publicar Cloud Functions e não exige Blaze.

## Primeira execução depois de mudança nativa

Como OCR e login Google foram atualizados, gere uma nova APK limpa **uma vez**:

```bash
npm run rebuild:android
```

O comando instala as dependências, valida o TypeScript e chama o EAS com `--clear-cache` para garantir que a APK receba os módulos nativos atuais.

Quando o EAS terminar:

1. instale a APK de desenvolvimento no Android;
2. feche qualquer Expo Go que estiver aberto;
3. rode:

```bash
npm start
```

O `npm start` agora abre o Metro para a **development build completa**.

## Nas próximas vezes

Depois que a APK nova estiver instalada, para alterações normais de código, telas, Firestore e regras de negócio use apenas:

```bash
npm start
```

Não gere outra APK para cada mudança. Uma nova `npm run rebuild:android` só é necessária quando mudar uma dependência/configuração nativa ou quando o app disser que um módulo nativo não existe.

## Expo Go

O Expo Go fica disponível apenas como modo limitado:

```bash
npm run go
```

Nesse modo o Cegonha usa stubs seguros e não tenta executar:

- OCR;
- Google Sign-In nativo;
- push remoto.

Use Expo Go apenas se quiser conferir telas que não dependem desses recursos. Para testar o Cegonha completo, use `npm start` com a APK de desenvolvimento instalada.

## OCR

O OCR usa `expo-ocr-kit`. No Android ele reconhece texto com Google ML Kit, mas o módulo precisa estar compilado dentro da APK.

Se aparecer uma mensagem como “native module not found”, “not linked” ou semelhante:

```bash
npm run rebuild:android
```

Instale a APK gerada e depois volte a usar:

```bash
npm start
```

## Login Google

O login Google no Android é feito pelo Google Sign-In nativo, evitando o redirecionamento web que pode causar `400 invalid_request`.

O package Android do projeto é:

```text
com.maymay79p.cegonha
```

Se, mesmo após instalar uma APK nova, o Google mostrar `DEVELOPER_ERROR`, a causa mais provável é a impressão digital SHA-1 da chave da APK não estar cadastrada no cliente Android do Google/Firebase. Nesse caso, consulte a credencial Android do EAS com:

```bash
npx eas-cli@latest credentials -p android
```

e cadastre a SHA-1 exibida no aplicativo Android `com.maymay79p.cegonha` do Firebase/Google Cloud. Depois faça `npm run rebuild:android` novamente.

## Confirmação de chegada

A encomenda é o registro principal. A confirmação foi estruturada para que falhas auxiliares de foto, auditoria ou telemetria do OCR não cancelem a chegada inteira.

Se a encomenda for salva mas o aviso do morador for bloqueado por regras antigas do Firestore, a tela informa isso claramente. Publique as regras atuais com:

```bash
npm run firebase:deploy
```

## Push

A Central de Avisos interna funciona sem Cloud Functions. Para push remoto com o app fechado, o backend continua opcional e exige Firebase compatível com Functions:

```bash
npm install --prefix functions
npm run firebase:deploy:push
```

## Comandos principais

```bash
npm run setup             # instala dependências e valida TypeScript
npm run rebuild:android   # gera uma APK nativa limpa quando necessário
npm start                 # modo completo após instalar a APK
npm run go                # Expo Go limitado
npm run firebase:deploy   # publica somente regras do Firestore
npm run typecheck         # valida TypeScript
npm run check             # valida TypeScript, bundle Expo Go e Expo Doctor
```

## Regra prática

**Mudou só tela/TypeScript/Firestore? → `npm start`.**

**Mudou biblioteca/configuração nativa ou apareceu “native module not found”? → `npm run rebuild:android` uma vez, instale a APK e depois volte para `npm start`.**
