# Cegonha 🐦

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido como TCC com **React Native, Expo, TypeScript e Firebase**.

O sistema possui dois perfis: **Morador** e **Portaria**. A comunicação é operacional pela Central de Avisos e coletiva pelo Mural; chat privado e perfil de síndico não fazem parte do escopo atual.

## Recursos principais

- cadastro, perfil, recuperação de senha e verificação de e-mail;
- validação de CPF e telefone e controle de identificadores duplicados;
- login por e-mail/senha e Google;
- criação/vínculo de condomínio com aprovação de novas Portarias em condomínios existentes;
- registro manual e por OCR de encomendas;
- confirmação humana do morador sugerido pelo OCR;
- código e confirmação de retirada;
- histórico e auditoria de ações críticas;
- previsões de entregas informadas pelo Morador;
- Central de Avisos em tempo real;
- push remoto quando backend/FCM estiver configurado;
- lembrete automático de encomenda há mais de três dias via Cloud Function agendada, com fallback no painel da Portaria;
- Mural em tempo real, filtro de linguagem imprópria, respostas, denúncias e moderação;
- relatórios e indicadores para a Portaria;
- acessibilidade, tema claro/escuro/sistema e tela de privacidade;
- exclusão de conta com remoção de dados descartáveis e anonimização do histórico necessário;
- identidade visual própria com ícone, splash e marca oficial do Cegonha.

## Rodar o projeto

```bash
git pull origin main
npm run setup
npm start
```

O modo mais simples para desenvolvimento continua sendo o **Expo Go**. OCR.Space, cadastro, perfil, encomendas, Mural, relatórios, previsões, avisos e Firestore funcionam nesse modo.

Google Sign-In nativo e push remoto com o aplicativo fechado exigem development build/APK.

### Comandos principais

```bash
npm run setup                 # instala e confere dependências
npm start                     # Expo Go
npm run dev                   # development build já instalada
npm run check                 # versões + TS + testes locais + Expo Doctor
npm run test:emulator         # fluxo completo + regras/ataques no Firebase Emulator
npm run build:preview:android # APK preview via EAS
npm run firebase:deploy       # somente Firestore Rules
npm run firebase:deploy:backend # Rules + Cloud Functions
```

## Firebase e backend

O app básico funciona com Firestore sem depender das Functions. Entretanto, a versão final possui funções de backend para:

- push disparado por novas notificações;
- lembrete diário de três dias, executado às 09:00 no fuso `America/Sao_Paulo`;
- exclusão segura/anomização de conta.

Para publicar apenas as regras:

```bash
npm run firebase:deploy
```

Para publicar a versão completa do backend:

```bash
npm install --prefix functions
npm run firebase:deploy:backend
```

Cloud Functions e Cloud Scheduler podem exigir faturamento habilitado no projeto Firebase. Se as Functions não estiverem publicadas, a Central de Avisos continua funcionando e o painel da Portaria mantém o fallback de lembrete, mas exclusão de conta e agendamento independente de aparelho dependem do backend.

## OCR.Space

A Portaria pode fotografar ou escolher uma etiqueta. A imagem é reduzida/comprimida e enviada temporariamente ao OCR.Space por HTTPS. O Cegonha tenta extrair nome, CPF, bloco e apartamento e cruza os dados com os moradores do condomínio.

**A foto da etiqueta e o texto bruto do OCR não são persistidos no Firestore.** A Portaria sempre confirma/corrige o morador antes de salvar a encomenda.

Para teste rápido, a aplicação pode usar a chave pública `helloworld`. Para uso mais estável, crie `.env.local`:

```env
EXPO_PUBLIC_OCR_SPACE_API_KEY=sua_chave_aqui
```

## Segurança

As regras do Firestore são a barreira principal de autorização e não confiam apenas na interface. O projeto aplica autenticação/e-mail verificado, isolamento por condomínio, separação Morador/Portaria, integridade de identidade e testes de ataque nos emuladores. Veja [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

## Exclusão e privacidade

A tela **Privacidade e segurança** permite excluir a conta. A operação exige e-mail verificado, confirmação `EXCLUIR` e login recente. Dados descartáveis são apagados e registros históricos que precisam permanecer para rastreabilidade são anonimizados. Uma Portaria não pode excluir a própria conta se isso deixar o condomínio sem outra Portaria.

Veja [`docs/PRIVACIDADE.md`](docs/PRIVACIDADE.md).

## Identidade visual e APK

A marca oficial é a cegonha rosa em selo com efeito de impressão. `app.json` define ícone, splash, ícone adaptativo Android e favicon. O login e o onboarding usam a mesma marca por meio de `BrandLogo`.

O CI gera uma **APK Android release** e a armazena como artefato do workflow. Também é possível gerar uma preview via EAS:

```bash
npm run build:preview:android
```

Veja [`docs/IDENTIDADE_VISUAL.md`](docs/IDENTIDADE_VISUAL.md).

## Validação automática

O workflow do GitHub Actions executa instalação reproduzível, auditoria de dependências, TypeScript, testes do parser OCR e buscas, Firebase Auth/Firestore Emulator com fluxo completo e ataques, Expo Doctor, bundle Expo Go, prebuild Android, build release da APK, testes das Functions e busca por padrões de segredos privados.

O fluxo automatizado inclui cadastro/vínculo, chegada da encomenda, notificação, código, solicitação e confirmação de retirada, além de Mural e denúncias. Veja [`docs/TESTES.md`](docs/TESTES.md).

## Documentação técnica

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — arquitetura e fluxos;
- [`docs/MODELO_DE_DADOS.md`](docs/MODELO_DE_DADOS.md) — coleções e relações;
- [`docs/SEGURANCA.md`](docs/SEGURANCA.md) — controles de segurança;
- [`docs/PRIVACIDADE.md`](docs/PRIVACIDADE.md) — tratamento e exclusão de dados;
- [`docs/TESTES.md`](docs/TESTES.md) — matriz de testes e validação;
- [`docs/IDENTIDADE_VISUAL.md`](docs/IDENTIDADE_VISUAL.md) — marca e uso visual;
- [`docs/RODAR_APP.md`](docs/RODAR_APP.md) — execução e build;
- [`docs/PUSH_SETUP.md`](docs/PUSH_SETUP.md) — configuração de push.

## Escopo final do TCC

O Cegonha está estruturado como um sistema de gestão de encomendas, não como plataforma geral de administração condominial. Financeiro, visitantes, marketplace, chat privado e perfil de síndico são possíveis evoluções, mas não são necessárias ao objetivo atual do projeto.
