# Testes e validação do Cegonha

O projeto combina testes automatizados, emuladores do Firebase e geração real do bundle/build Android. O objetivo é validar tanto o funcionamento quanto tentativas de abuso que não aparecem na interface normal.

## Comandos locais

```bash
npm ci
npm run check
npm run test:emulator
npm test --prefix functions
```

## Matriz do fluxo principal

O script `scripts/test-vinculo-emulator.mjs` executa o fluxo completo em Firebase Auth + Firestore Emulator.

| Etapa | Evidência automatizada |
|---|---|
| conta não verificada tenta gravar | acesso negado |
| criação de Portaria/condomínio | permitida após verificação |
| cadastro de Morador sem vínculo | permitido |
| solicitação de entrada | criada e avisada à Portaria |
| aprovação pela Portaria | status e auditoria gravados |
| conclusão do vínculo | Morador passa a pertencer ao condomínio |
| leitura do diretório | apenas dados operacionais mínimos |
| leitura de perfil privado alheio | negada |
| criação de encomenda para usuário inexistente | negada |
| registro de chegada | encomenda + aviso + auditoria |
| código de retirada | visível ao Morador correto |
| alteração posterior do código/destinatário | negada |
| exclusão de encomenda pelo cliente | negada |
| persistência da confirmação OCR | validada sem chamar serviço externo |
| solicitação de retirada pelo Morador | interação + aviso à Portaria |
| confirmação de retirada | status, código confirmado e auditoria |
| aviso final ao Morador | criado |
| banimento/desbanimento no Mural | bloqueia e restaura publicação |
| denúncia de publicação | vinculada à publicação real |

## Testes ofensivos de segurança

`scripts/test-comunidade-seguranca-emulator.mjs` tenta falsificar dados diretamente no Firestore. Entre os cenários:

- autoria falsa no Mural;
- resposta apontando para autor/publicação incompatíveis;
- denúncia usando dados adulterados;
- acesso cruzado entre condomínios;
- escalada de privilégios de Portaria;
- alteração de campos críticos de registros;
- uso de identidade diferente da conta autenticada.

O resultado esperado nesses casos é `permission-denied`.

## OCR

`npm run test:ocr` testa o parser e a extração de campos sem depender de uma chamada real ao OCR.Space. A chamada externa deve ser validada também em teste manual com etiquetas de diferentes condições de luz, enquadramento e qualidade.

## Pesquisa e filtros

`npm run test:busca` valida a normalização e os critérios usados pelas pesquisas do aplicativo.

## Functions

`npm test --prefix functions` executa verificação sintática do backend e testes do módulo de push. O deploy final acrescenta:

- função acionada por nova notificação;
- função agendada de lembrete de três dias;
- função autenticada de exclusão/anomização de conta.

## CI do GitHub

O workflow `.github/workflows/validate.yml` executa:

1. `npm ci` com lockfile;
2. auditoria de vulnerabilidades críticas do app;
3. verificação de versão corrigida do gRPC;
4. compatibilidade com Expo;
5. TypeScript;
6. parser OCR;
7. pesquisas;
8. Auth/Firestore Emulator com fluxo completo e ataques;
9. Expo Doctor;
10. bundle Expo Go;
11. `expo prebuild` Android;
12. geração de APK release pelo Gradle;
13. upload da APK como artefato do workflow;
14. instalação/auditoria/testes das Functions;
15. busca por padrões comuns de credenciais privadas versionadas.

## Validação manual antes da banca

Mesmo com CI verde, a versão apresentada deve ser instalada em um aparelho Android e passar por um roteiro curto:

1. abrir a APK e conferir splash/ícone;
2. entrar como Portaria;
3. registrar ou localizar um Morador de teste;
4. fotografar uma etiqueta e conferir o OCR;
5. confirmar a encomenda;
6. abrir o app como Morador e conferir o aviso/código;
7. solicitar retirada;
8. voltar à Portaria e confirmar;
9. conferir histórico e relatório;
10. testar Mural/denúncia e configurações de privacidade.

Esse teste manual valida câmera, permissões, rede, renderização e comportamento do aparelho, que não podem ser completamente reproduzidos no emulador do Firestore.
