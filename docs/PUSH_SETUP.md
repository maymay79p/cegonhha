# Ativação do push e backend no Android

O Cegonha usa `expo-notifications`, registra `ExpoPushToken` no Firestore e possui Cloud Functions para enviar avisos, processar lembretes automáticos e excluir/anomizar contas.

Para push remoto funcionar em uma build Android real, é necessário configurar as credenciais nativas do projeto Firebase/EAS. Chaves privadas nunca devem ser versionadas.

## 1. Registrar/confirmar o app Android no Firebase

No projeto Firebase `cegonha-43403`, confirme um aplicativo Android com package:

```text
com.maymay79p.cegonha
```

Baixe o `google-services.json` correspondente e configure-o para a build usada na demonstração. Não reutilize arquivo de outro package ou projeto.

## 2. Configurar FCM V1 no EAS

Obtenha uma conta de serviço apropriada para FCM V1 e envie a credencial ao EAS por:

```bash
npx eas-cli@latest credentials -p android
```

A chave privada da conta de serviço deve ficar somente no gerenciador de credenciais, nunca no GitHub.

## 3. Publicar regras e backend

A versão final possui:

- `enviarPushDaNotificacao` — reage a novos documentos em `notificacoes`;
- `processarLembretes3Dias` — roda diariamente às 09:00 no fuso de São Paulo;
- `excluirMinhaConta` — exclusão/anomização autenticada e com sessão recente.

Instale e teste:

```bash
npm install --prefix functions
npm test --prefix functions
```

Publique regras + Functions:

```bash
npm run firebase:deploy:backend
```

Para publicar somente regras do Firestore:

```bash
npm run firebase:deploy
```

Cloud Functions e Cloud Scheduler podem exigir faturamento habilitado no projeto Firebase.

## 4. Gerar nova build

`expo-notifications` possui código nativo. Uma build antiga não passa a receber push remoto apenas atualizando JavaScript.

Para uma preview APK:

```bash
npm run build:preview:android
```

Para development build:

```bash
npm run rebuild:android
npm run dev
```

## 5. Teste mínimo em aparelho real

Use dois logins vinculados ao mesmo condomínio.

1. Abra a build como Morador e aceite notificações.
2. Confirme que foi criado um documento em `pushDispositivos`.
3. Entre como Portaria em outro aparelho/instalação.
4. Registre uma encomenda para o Morador.
5. Confirme o aviso na Central de Avisos e como notificação do sistema.
6. Feche o Cegonha no aparelho do Morador e repita para validar segundo plano.
7. Teste o sentido inverso registrando entrega prevista ou denúncia pelo Morador.
8. Valide também a exclusão de uma conta de teste e o bloqueio de exclusão da última Portaria.

## Escopo de comunicação

O Cegonha não propõe chat privado Morador ↔ Portaria. A comunicação do projeto é composta por avisos operacionais e pelo Mural coletivo.
