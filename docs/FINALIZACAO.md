# Checklist de finalização do TCC

## Concluído no código/repositório

- [x] fluxo de exclusão de conta e anonimização no backend;
- [x] proteção para não excluir a última Portaria;
- [x] identidade visual oficial, ícone, splash, adaptive icon e favicon;
- [x] marca integrada ao login e onboarding;
- [x] documentação de arquitetura, dados, testes, privacidade e identidade;
- [x] lembrete automático de 3 dias implementado como Cloud Function agendada;
- [x] fallback do lembrete quando a Portaria abre o app mantido;
- [x] `eas.json` preparado para development, preview APK e production AAB;
- [x] CI com TypeScript, emuladores, segurança, prebuild e geração de APK debug;
- [x] teste automatizado dos dois perfis do vínculo até a retirada;

## Depende de ambiente externo

- [ ] publicar Firestore Rules no projeto real;
- [ ] publicar Cloud Functions no projeto real (push, lembrete e exclusão de conta);
- [ ] gerar uma APK preview assinada pelo EAS, se desejado para a banca;
- [ ] instalar a APK em aparelho físico e executar o roteiro manual final;
- [ ] renomear o repositório de `cegonhha` para `cegonha` nas configurações do GitHub e adicionar descrição/tópicos, caso o conector não ofereça essa permissão.

## Comandos de publicação

Somente regras:

```bash
npm run firebase:deploy
```

Regras + backend completo:

```bash
npm run firebase:deploy:prod
```

APK preview assinada via EAS:

```bash
npm run build:final:android
```

## Roteiro físico final

1. instalar a APK;
2. criar/entrar como Portaria e Morador;
3. verificar e-mail;
4. solicitar e aprovar vínculo;
5. registrar uma entrega prevista pelo Morador;
6. registrar a chegada pela Portaria (OCR e também fluxo manual);
7. conferir aviso no Morador;
8. conferir código de retirada;
9. solicitar/confirmar retirada;
10. verificar histórico e aviso final;
11. testar Mural/denúncia;
12. testar exclusão de uma conta que não seja a última Portaria.
