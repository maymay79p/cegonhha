# Rodar, testar e publicar o Cegonha

## Desenvolvimento rápido

Depois de baixar/atualizar o projeto:

```bash
git pull origin main
npm run setup
npm start
```

`npm run setup` instala as dependências, confere as versões esperadas pelo Expo e valida o TypeScript. O `postinstall` prepara os assets oficiais da marca do Cegonha.

`npm start` abre o modo Expo Go com cache limpo.

## O que funciona no Expo Go

- login por e-mail e senha;
- cadastro e perfil;
- condomínio e vínculos;
- encomendas e histórico;
- OCR.Space por câmera/galeria;
- Mural e denúncias;
- relatórios;
- previsões;
- Central de Avisos;
- Firestore em tempo real;
- temas e acessibilidade.

Google Sign-In nativo e push remoto com o app fechado exigem development build/APK.

A exclusão de conta aparece na interface, mas depende da Cloud Function `excluirMinhaConta` estar publicada.

## Identidade visual

Antes de start/build, os arquivos de ícone/splash são preparados por:

```bash
npm run prepare:brand
```

Os comandos normais já chamam essa preparação automaticamente. A configuração final está em `app.json`.

## Checagem local

```bash
npm run check
```

Para validar também regras e fluxo completo com emuladores:

```bash
npm run test:emulator
```

O fluxo inclui Morador + Portaria, vínculo, chegada, aviso, solicitação e confirmação de retirada, Mural e testes de autorização.

## APK de demonstração

### Via EAS

```bash
npm run build:preview:android
```

O perfil `preview` produz APK de distribuição interna.

### Via CI

O workflow `Validar Cegonha` também executa `expo prebuild` e `./gradlew assembleRelease`. Quando a execução termina com sucesso, a APK fica disponível nos **Artifacts** da execução do GitHub Actions com nome `Cegonha-Android-<sha>`.

Esse artefato é útil para congelar exatamente a versão usada na banca.

## Development build

Para Google Sign-In nativo e testes locais de push:

```bash
npm run rebuild:android
```

Instale a APK gerada e depois:

```bash
npm run dev
```

## Firebase Rules

Publicar apenas as regras do Firestore:

```bash
npm run firebase:deploy
```

Esse é o mínimo necessário sempre que `firestore.rules` mudar.

## Backend completo

A versão final possui três funções:

- `enviarPushDaNotificacao`;
- `processarLembretes3Dias`;
- `excluirMinhaConta`.

Para publicar regras + Functions:

```bash
npm install --prefix functions
npm run firebase:deploy:backend
```

A função agendada roda diariamente às 09:00 no fuso de São Paulo e envia o lembrete quando uma encomenda permanece pendente por três dias ou mais. O painel da Portaria continua com o mecanismo antigo como fallback.

Cloud Functions/Cloud Scheduler podem exigir projeto Firebase com faturamento habilitado.

## OCR.Space

Sem variável de ambiente, o app usa a chave pública `helloworld`, adequada apenas a testes rápidos e com limite baixo.

Para uso mais estável, crie `.env.local`:

```env
EXPO_PUBLIC_OCR_SPACE_API_KEY=sua_chave_aqui
```

A imagem é comprimida antes do envio. O Cegonha não salva a fotografia nem o texto bruto do OCR no Firestore.

## Login Google

O package Android é:

```text
com.maymay79p.cegonha
```

Se a APK retornar `DEVELOPER_ERROR`, confira a SHA-1 da credencial usada pelo EAS:

```bash
npx eas-cli@latest credentials -p android
```

A SHA-1 precisa estar cadastrada no cliente Android correspondente no Firebase/Google Cloud.

## Checklist antes da banca

```text
[ ] git pull origin main
[ ] npm ci
[ ] npm run check
[ ] npm run test:emulator
[ ] npm test --prefix functions
[ ] GitHub Actions verde
[ ] APK do mesmo commit instalada no celular
[ ] regras/Functions publicadas no Firebase usado na demonstração
[ ] login Portaria testado
[ ] login Morador testado
[ ] câmera/OCR testado em aparelho real
[ ] chegada e retirada testadas ponta a ponta
```
