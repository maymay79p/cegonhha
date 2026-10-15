# Ativação do push no Android

O código do Cegonha já usa `expo-notifications`, registra `ExpoPushToken` no Firestore e possui uma Cloud Function que envia os avisos pelo Expo Push Service.

Para o push remoto funcionar em uma build Android real, ainda é necessário configurar as credenciais nativas do projeto Firebase/EAS. Essas credenciais não devem ser inventadas nem copiadas de outro projeto.

## 1. Registrar/confirmar o app Android no Firebase

No projeto Firebase `cegonha-43403`, confirme que existe um aplicativo Android com o package:

```text
com.maymay79p.cegonha
```

Baixe o `google-services.json` desse aplicativo Android. Esse arquivo contém identificadores públicos do app Firebase e pode ser mantido na raiz do projeto se desejado.

Depois, adicione em `app.json`, dentro de `expo.android`:

```json
"googleServicesFile": "./google-services.json"
```

Não use um `google-services.json` de outro package ou de outro projeto Firebase.

## 2. Configurar FCM V1 no EAS

Gere/obtenha no Firebase uma chave de conta de serviço para FCM V1 e envie essa credencial ao EAS usando:

```bash
eas credentials
```

Caminho esperado no menu: Android → Google Service Account → Push Notifications (FCM V1).

A chave privada da conta de serviço **não deve ser commitada no GitHub**. O `.gitignore` do Cegonha já bloqueia nomes comuns desses arquivos.

## 3. Publicar backend e regras

```bash
npm install
npm install --prefix functions
npm run firebase:deploy
```

O deploy publica:

- as regras do Firestore, incluindo `pushDispositivos`;
- a Cloud Function `enviarPushDaNotificacao`.

Dependendo da configuração do projeto Firebase, a publicação de Cloud Functions pode exigir faturamento habilitado no projeto.

## 4. Gerar nova build

`expo-notifications` possui código nativo. Portanto, uma build antiga não passa a receber push apenas atualizando o JavaScript.

```bash
eas build --profile development -p android
```

Instale o novo APK no aparelho e depois rode:

```bash
npm run start:dev
```

## 5. Teste mínimo

Use dois logins vinculados ao mesmo condomínio.

1. Abra a nova build como Morador e aceite a permissão de notificações.
2. Confirme no Firestore que foi criado um documento em `pushDispositivos` para esse usuário.
3. Entre como Portaria em outro aparelho/instalação.
4. Registre uma encomenda para o Morador.
5. Confirme que o aviso aparece na Central de Avisos e como notificação do sistema.
6. Feche o Cegonha no aparelho do Morador e repita com uma nova encomenda para validar o recebimento em segundo plano.

Repita o sentido inverso cadastrando uma entrega prevista ou enviando uma denúncia pelo Morador; a Portaria deve receber o push correspondente.

## Escopo de comunicação

O Cegonha não propõe chat privado individual entre Morador e Portaria. A comunicação do projeto é composta por avisos operacionais automáticos e pelo Mural do condomínio como canal coletivo.
