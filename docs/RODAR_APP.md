# Rodar o Cegonha sem sofrimento

## Caminho recomendado para desenvolvimento diário

### Primeira vez no computador

Abra o terminal na pasta do projeto e execute:

```bash
npm run setup
```

Esse comando:

1. confere se o Node é compatível;
2. executa `npm install` para ajustar as dependências/lockfile local;
3. executa o TypeScript para detectar erro de código.

### Testar telas e Firebase rapidamente

```bash
npm start
```

Esse comando abre o projeto em **Expo Go** (`--go`).

Use este modo para desenvolver praticamente todo o app:

- login/cadastro;
- perfil;
- condomínio;
- encomendas;
- histórico;
- Mural;
- denúncias;
- relatórios;
- previsões;
- Central de Avisos;
- Firestore em tempo real.

No Expo Go, o Cegonha ignora automaticamente o registro de push remoto para evitar erros de configuração nativa.

## Quando usar a development build

Somente use a development build quando for testar recursos nativos:

- Google ML Kit OCR;
- push notification remota;
- autenticação Google nativa.

Para gerar o APK:

```bash
npm run build:android
```

Instale o APK no celular. Depois disso, para alterações normais de código/telas:

```bash
npm run dev
```

Você não precisa fazer outra build até alterar dependências/configurações nativas.

## Firebase

Para atualizar somente as regras do Firestore:

```bash
npm run firebase:deploy
```

Isso funciona sem tentar publicar Cloud Functions.

Somente se quiser ativar o backend de push e o projeto Firebase estiver apto a usar Functions:

```bash
npm install --prefix functions
npm run firebase:deploy:push
```

## Se alguma coisa parar de abrir

Tente nesta ordem:

```bash
npm run setup
npm start
```

Se for development build:

```bash
npm run dev
```

Se uma dependência nativa tiver mudado, gere outra APK:

```bash
npm run build:android
```

## Regra prática

**Expo Go = desenvolvimento rápido.**

**Development build = OCR, push e recursos nativos.**

Assim o projeto não precisa depender de EAS/Firebase Functions para cada alteração simples de interface ou regra de negócio.
