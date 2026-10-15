# Cegonha

Aplicativo de gerenciamento de encomendas para condomínios, desenvolvido com React Native, Expo, TypeScript e Firebase.

## Perfis atuais

- Morador
- Portaria

O perfil de síndico não faz mais parte do sistema.

## Recursos principais

- cadastro e atualização de dados pessoais do morador;
- registro de encomendas pela portaria;
- histórico geral da portaria e individual do morador;
- notificações internas automáticas de chegada, retirada e lembrete;
- OCR de etiquetas com tentativa de leitura de nome, CPF, bloco e apartamento;
- histórico das leituras OCR da portaria;
- mural do condomínio com pesquisa, denúncia, banimento e exclusão pela portaria;
- localização/endereço do condomínio com abertura no aplicativo de mapas;
- código do condomínio em tela de destaque com opção de copiar;
- pesquisa e filtros nas áreas de encomendas;
- atualização em tempo real com listeners do Firestore;
- tema claro, escuro ou conforme o sistema;
- login por e-mail/senha e opção de autenticação com Google.

## Validação

```bash
npm ci
npm run typecheck
npm run doctor
```

O pull request executa `npm run typecheck` no GitHub Actions.

## Firebase

Depois de alterar `firestore.rules`, publique as regras no projeto Firebase antes de testar os novos recursos:

```bash
npm run firebase:rules
```

## Login com Google

O código do aplicativo já possui o botão **Continuar com Google**, troca do token do Google por uma credencial do Firebase e fluxo de primeiro acesso para completar o cadastro de Morador ou Portaria.

Para ativar a integração no ambiente real:

1. No Firebase Console, abra **Authentication > Sign-in method** e habilite o provedor **Google**.
2. No projeto Google Cloud/Firebase, crie os Client IDs OAuth necessários para Web, Android e/ou iOS.
3. Para Android, use o package `com.maymay79p.cegonha` e configure a impressão digital SHA exigida pelo Google.
4. Para iOS, use o bundle identifier `com.maymay79p.cegonha`.
5. Copie `.env.example` para `.env` e preencha:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
```

6. Reinicie o Metro limpando o cache:

```bash
npx expo start -c
```

Em Android/iOS, OAuth não deve ser validado pelo Expo Go. Use uma development build ou uma compilação do aplicativo para que o scheme `cegonha://` possa retornar corretamente ao app.

No primeiro login com Google, se ainda não existir um documento do usuário no Firestore, o Cegonha mantém a sessão autenticada e abre a tela **Concluir cadastro**. O usuário escolhe Morador ou Portaria, informa os campos obrigatórios e o sistema cria o perfil sem solicitar uma nova senha.

## Limites atuais

As notificações desta etapa são internas ao aplicativo, armazenadas no Firestore e exibidas em tempo real. Push do sistema operacional com o aplicativo totalmente fechado exigirá tokens de dispositivo e um serviço de envio.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo. Um mapa incorporado no Cegonha exigirá uma biblioteca/SDK de mapas e configuração adicional.
