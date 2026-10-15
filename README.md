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
- OCR de etiquetas com **Google ML Kit**, executado no próprio aparelho, com tentativa de leitura de nome, CPF, bloco e apartamento;
- cruzamento dos dados lidos na etiqueta com os moradores do condomínio;
- histórico das leituras OCR da portaria;
- mural do condomínio em tempo real com nome e data da publicação, exclusão pelo autor, denúncia por outros usuários e moderação pela portaria;
- localização/endereço do condomínio com abertura no aplicativo de mapas;
- código do condomínio em tela de destaque com opção de copiar;
- pesquisa e filtros nas áreas de encomendas;
- atualização em tempo real com listeners do Firestore;
- tema claro, escuro ou conforme o sistema;
- login por e-mail/senha e opção de autenticação com Google.

## Instalação e validação

```bash
npm install
npm run typecheck
npm run doctor
```

O GitHub Actions instala as dependências e executa `npm run typecheck` nas alterações da `main`.

## Firebase

Depois de alterar `firestore.rules`, publique as regras no projeto Firebase antes de testar os novos recursos:

```bash
npm run firebase:rules
```

Isso é especialmente importante para o mural, pois as permissões de publicação, denúncia e exclusão são verificadas pelo Firestore.

## OCR com Google ML Kit

O Cegonha usa `@react-native-ml-kit/text-recognition` para reconhecer o texto das etiquetas localmente no Android/iOS. A imagem não precisa ser enviada para um serviço externo de OCR e não existe chave de API de OCR para configurar.

Depois de instalar ou atualizar a dependência nativa, é necessário gerar uma nova build do aplicativo. Para Android:

```bash
npm install
eas build --profile development -p android
```

Depois de instalar a development build no celular, inicie o Metro com:

```bash
npm run start:dev
```

O Expo Go não contém o módulo nativo do ML Kit e, por isso, não deve ser usado para testar o OCR.

## Login com Google

O código do aplicativo já possui o botão **Continuar com Google**, troca do token do Google por uma credencial do Firebase e fluxo de primeiro acesso para completar o cadastro de Morador ou Portaria.

Para ativar a integração no ambiente real:

1. No Firebase Console, abra **Authentication > Sign-in method** e habilite o provedor **Google**.
2. No projeto Google Cloud/Firebase, crie os Client IDs OAuth necessários para Web, Android e/ou iOS.
3. Para Android, use o package `com.maymay79p.cegonha` e configure a impressão digital SHA exigida pelo Google.
4. Para iOS, use o bundle identifier `com.maymay79p.cegonha`.
5. Os Client IDs Web e Android atuais já estão definidos no projeto; `.env` pode sobrescrevê-los quando necessário.
6. Reinicie o Metro limpando o cache após alterações de ambiente.

Em Android/iOS, OAuth não deve ser validado pelo Expo Go. Use uma development build ou uma compilação do aplicativo para que o scheme `cegonha://` possa retornar corretamente ao app.

No primeiro login com Google, se ainda não existir um documento do usuário no Firestore, o Cegonha mantém a sessão autenticada e abre a tela **Concluir cadastro**. O usuário escolhe Morador ou Portaria, informa os campos obrigatórios e o sistema cria o perfil sem solicitar uma nova senha.

## Mural do condomínio

Moradores e portaria vinculados ao mesmo condomínio podem publicar mensagens no mural. Cada publicação registra o ID e o nome do autor, o tipo de perfil e a data/hora. O autor pode excluir a própria publicação; outros usuários podem denunciá-la; e a portaria mantém os recursos de moderação e banimento já existentes.

## Limites atuais

As notificações desta etapa são internas ao aplicativo, armazenadas no Firestore e exibidas em tempo real. Push do sistema operacional com o aplicativo totalmente fechado exigirá tokens de dispositivo e um serviço de envio.

A localização do condomínio é cadastrada como endereço e aberta no aplicativo de mapas do dispositivo. Um mapa incorporado no Cegonha exigirá uma biblioteca/SDK de mapas e configuração adicional.
