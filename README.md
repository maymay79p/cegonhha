# Cegonha

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.

## Perfis atuais

- Morador
- Portaria

O perfil de síndico não faz parte do sistema atual. Também não existe chat privado Morador ↔ Portaria: a comunicação do projeto é feita por avisos operacionais e pelo Mural coletivo.

## Jeito mais simples de rodar

O modo recomendado é o **Expo Go**. O OCR usa OCR.Space por HTTP e, portanto, não exige mais uma APK nativa para funcionar.

Depois de atualizar o projeto:

```bash
git pull origin main
npm run setup
npm start
```

`npm run setup` instala as dependências, confere as versões esperadas pelo Expo SDK 57 e valida o TypeScript. `npm start` limpa o cache e abre o Expo Go.

### O que funciona no Expo Go

- login por e-mail e senha;
- cadastro e perfil;
- condomínio;
- encomendas e histórico;
- confirmação de chegada;
- OCR.Space pela câmera ou galeria;
- Mural e denúncias;
- relatórios;
- previsões;
- Central de Avisos;
- Firestore em tempo real.

Google Sign-In nativo e push remoto continuam sendo recursos de development build.

## Comandos úteis

```bash
npm run setup                 # instala dependências e valida versões/TypeScript
npm start                     # Expo Go, modo recomendado
npm run check                 # versões + TypeScript + bundle Expo Go + Expo Doctor
npm run typecheck             # verifica TypeScript
npm run firebase:deploy       # publica somente regras do Firestore
npm run rebuild:android       # gera APK para Google Sign-In nativo/push remoto
npm run dev                   # abre a development build instalada
npm run build:preview:android # gera APK de demonstração/preview
```

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

## Segurança e integridade dos dados

As regras do Firestore são a barreira de autorização do Cegonha e não confiam apenas nas validações das telas. Entre as proteções atuais estão:

- acesso aos dados operacionais somente por usuários autenticados com e-mail verificado;
- isolamento por condomínio e separação de permissões entre Morador e Portaria;
- novas contas da Portaria em condomínio existente dependem de aprovação de uma Portaria já vinculada;
- nomes, perfis e metadados de autoria são conferidos com o perfil autenticado para impedir impersonação por clientes modificados;
- encomendas conferem Portaria, Morador, bloco e apartamento contra os registros reais do condomínio;
- respostas, denúncias e banimentos do Mural são vinculados aos registros reais que originaram a ação;
- endereço do condomínio fica em documento privado acessível apenas a contas vinculadas;
- CPF, telefone e e-mail usam reservas de unicidade sem permitir leitura pública da coleção de identificadores;
- o perfil completo não é persistido em cache local do aplicativo;
- o CI usa instalações reproduzíveis, auditoria de dependências, testes com emuladores do Firebase e busca por assinaturas comuns de credenciais privadas.

As regras versionadas no GitHub só passam a valer no projeto Firebase real depois de executar `npm run firebase:deploy` com uma conta autorizada. Chaves privadas, contas de serviço e outros segredos nunca devem ser versionados.

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
- OCR de etiquetas via OCR.Space;
- tentativa de leitura de nome, CPF, bloco e apartamento;
- histórico das leituras OCR confirmadas;
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

A encomenda é o registro principal da confirmação. O fluxo foi estruturado para que falhas auxiliares de auditoria ou telemetria do OCR não cancelem a chegada inteira.

O aviso ao Morador é criado logo após a encomenda. Se regras antigas do Firestore bloquearem esse aviso, a tela informa que a chegada foi registrada e orienta a publicar as regras atuais:

```bash
npm run firebase:deploy
```

## OCR.Space

O OCR não usa mais biblioteca nativa. A tela comprime a imagem e envia uma cópia temporária ao endpoint HTTPS do OCR.Space. O texto retornado é analisado para tentar extrair nome, CPF, bloco e apartamento e então cruzado com os moradores do condomínio.

A foto da etiqueta **não é salva no Firestore nem anexada à encomenda**. O texto bruto reconhecido também não é persistido. Quando uma encomenda é confirmada, ficam somente os principais campos extraídos e métricas da leitura.

Depois da leitura, a Portaria pode:

- remover somente a foto da tela e manter os dados reconhecidos;
- descartar a leitura inteira;
- escolher um morador sugerido;
- corrigir/buscar o morador manualmente.

Para facilitar o primeiro teste, se nenhuma chave estiver configurada o app usa a chave pública `helloworld` do OCR.Space. Ela é apenas para testes rápidos e possui limite baixo. Para uso mais estável, crie `.env.local`:

```env
EXPO_PUBLIC_OCR_SPACE_API_KEY=sua_chave_aqui
```

O plano gratuito do OCR.Space possui limite de tamanho; por isso o Cegonha reduz e comprime automaticamente a foto antes do envio.

## Login Google

No Android, o login Google continua usando `@react-native-google-signin/google-signin`. Ele é um recurso nativo e não roda no Expo Go. Para testar especificamente esse login:

```bash
npm run rebuild:android
```

Instale a APK e rode:

```bash
npm run dev
```

O package Android é:

```text
com.maymay79p.cegonha
```

Se a APK retornar `DEVELOPER_ERROR`, confira a SHA-1 da chave Android usada pelo EAS:

```bash
npx eas-cli@latest credentials -p android
```

Essa SHA-1 precisa estar cadastrada no cliente Android `com.maymay79p.cegonha` no Firebase/Google Cloud.

## Push notifications

A Central de Avisos interna funciona no Expo Go porque usa Firestore. O push remoto com o aplicativo fechado continua opcional e depende de `expo-notifications`, FCM/EAS e do backend configurado.

No Expo Go o módulo de push remoto é substituído por um stub seguro. Para Android real, ainda é necessário configurar FCM V1/EAS. Não coloque chaves privadas ou arquivos de conta de serviço no repositório público. Veja `docs/PUSH_SETUP.md`.

## Validação automática

O GitHub Actions:

- instala as dependências do app de forma reproduzível;
- audita dependências de produção;
- verifica se as versões são compatíveis com o Expo;
- verifica TypeScript;
- testa OCR e pesquisas do aplicativo;
- executa os emuladores do Firebase para validar vínculo, autorização e ataques de integridade;
- executa Expo Doctor;
- gera o bundle do modo Expo Go;
- executa `expo prebuild` para validar os recursos nativos opcionais;
- instala, audita e testa o backend de push;
- procura padrões comuns de credenciais privadas versionadas.

## Observações

O lembrete de encomenda com mais de 3 dias ainda é identificado quando a Portaria abre o aplicativo e o painel encontra a pendência. Para executar essa verificação sem nenhum aparelho aberto seria necessário um processo agendado no backend.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo.

Para o passo a passo de execução, veja `docs/RODAR_APP.md`.