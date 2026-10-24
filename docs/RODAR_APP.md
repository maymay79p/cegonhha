# Rodar o Cegonha

## Desenvolvimento cotidiano

```bash
git pull origin main
npm run setup
npm start
```

`npm start` abre o Expo Go com cache limpo. Nesse modo funcionam cadastro, e-mail/senha, perfil, condomínio, encomendas, histórico, OCR.Space, Mural, denúncias, relatórios, previsões e Central de Avisos.

## OCR.Space

O OCR precisa de internet. Sem configuração, o app usa a chave pública `helloworld`, apenas para testes rápidos. Para uso mais estável, crie `.env.local`:

```env
EXPO_PUBLIC_OCR_SPACE_API_KEY=sua_chave_aqui
```

A imagem da etiqueta é comprimida antes do envio e não fica salva no Firestore.

## Development Build

Google Sign-In nativo e push remoto exigem build nativa:

```bash
npm run rebuild:android
npm run dev
```

## APK final/preview

Para gerar uma APK preview assinada pelo EAS:

```bash
npm run build:final:android
```

O GitHub Actions também compila uma APK debug de validação em cada pipeline bem-sucedida. Ela serve para instalação/teste técnico, mas não substitui um build de produção assinado para publicação em loja.

## Firebase

Somente Firestore Rules:

```bash
npm run firebase:deploy
```

Somente backend (push, lembrete e exclusão de conta):

```bash
npm run firebase:deploy:backend
```

Regras + backend:

```bash
npm run firebase:deploy:prod
```

A funcionalidade de exclusão de conta e o lembrete automático independente do aparelho só ficam ativos no projeto real depois que as Cloud Functions forem publicadas.

## Validação local

```bash
npm run check
```

Para repetir os testes de regras com emuladores, use o comando documentado em `docs/TESTES.md`.

## Regra prática

- Desenvolvimento normal/OCR: `npm start`.
- Google Sign-In e push remoto: Development Build.
- Versão para banca: APK instalada em aparelho físico + Firebase de produção com regras/backend publicados.
