# Rodar o Cegonha sem sofrimento

O modo recomendado voltou a ser o **Expo Go**. O OCR agora usa a API do OCR.Space e, por isso, não precisa mais de módulo nativo nem de uma APK nova para funcionar.

## Depois de baixar/atualizar o projeto

Na pasta do projeto:

```bash
git pull origin main
npm run setup
```

O `npm run setup` instala as dependências, confere se as versões são compatíveis com o Expo SDK 57 e valida o TypeScript.

Depois, para abrir o app:

```bash
npm start
```

O `npm start` abre o **Expo Go**, limpa o cache do Metro e é o caminho recomendado para testar o Cegonha no dia a dia.

## O que funciona no Expo Go

- login por e-mail e senha;
- cadastro e perfil;
- condomínio;
- encomendas e histórico;
- confirmação de chegada;
- OCR.Space por câmera ou galeria;
- Mural e denúncias;
- relatórios;
- previsões;
- Central de Avisos;
- Firestore em tempo real.

O OCR.Space precisa de internet porque a imagem comprimida é enviada à API para reconhecimento. O Cegonha não salva a foto da etiqueta nem o texto bruto no Firestore.

## OCR.Space

Não é obrigatório configurar uma chave só para abrir o app. Sem variável de ambiente, o Cegonha usa a chave pública de teste `helloworld`, que serve para testes rápidos e possui limite baixo.

Para uso mais estável, crie uma chave gratuita no OCR.Space e crie um arquivo `.env.local` na raiz do projeto:

```env
EXPO_PUBLIC_OCR_SPACE_API_KEY=sua_chave_aqui
```

Depois reinicie:

```bash
npm start
```

A foto é comprimida automaticamente para ficar abaixo do limite do plano gratuito. Depois da leitura, você pode remover apenas a foto da tela e manter os dados reconhecidos, ou descartar a leitura inteira.

## Quando ainda preciso de development build?

Somente para recursos nativos opcionais:

- Google Sign-In nativo;
- push notification remota com o app fechado.

Para isso:

```bash
npm run rebuild:android
```

Instale a APK e depois rode:

```bash
npm run dev
```

Não use development build para testar o OCR: ela não é mais necessária para isso.

## Firebase

Para publicar somente as regras do Firestore:

```bash
npm run firebase:deploy
```

Esse comando não publica Cloud Functions e não exige Blaze.

O backend opcional de push continua separado:

```bash
npm install --prefix functions
npm run firebase:deploy:push
```

## Se algo não abrir

Tente nesta ordem:

```bash
git pull origin main
npm run setup
npm start
```

Se quiser conferir tudo de uma vez:

```bash
npm run check
```

Esse comando verifica versões do Expo, TypeScript, bundle do Expo Go e Expo Doctor.

## Comandos principais

```bash
npm run setup             # instala e verifica dependências
npm start                 # Expo Go, modo recomendado
npm run check             # versões + TypeScript + bundle + Expo Doctor
npm run typecheck         # valida TypeScript
npm run firebase:deploy   # publica somente regras do Firestore
npm run rebuild:android   # somente para Google Sign-In nativo/push
npm run dev               # abre a development build já instalada
```

## Regra prática

**Quer desenvolver/testar o Cegonha e o OCR? → `npm start`.**

**Quer testar Google Sign-In nativo ou push remoto? → development build.**
