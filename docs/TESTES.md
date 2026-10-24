# Testes e validação

O Cegonha possui validação automática no GitHub Actions e testes de regras executados contra os emuladores do Firebase.

## Matriz do fluxo principal

| Cenário | Cobertura automática |
|---|---|
| Criar conta da Portaria | ✅ Auth Emulator |
| Impedir gravações antes de verificar e-mail | ✅ |
| Criar condomínio | ✅ |
| Criar Morador | ✅ |
| Solicitar vínculo | ✅ |
| Portaria aprovar vínculo | ✅ |
| Morador concluir vínculo | ✅ |
| Isolamento de dados privados | ✅ |
| Registrar encomenda | ✅ |
| Persistir resultado de OCR confirmado | ✅ |
| Criar aviso de chegada | ✅ |
| Exibir código de retirada ao Morador | ✅ |
| Morador solicitar retirada | ✅ |
| Portaria confirmar retirada | ✅ |
| Criar aviso/auditoria da retirada | ✅ |
| Banir/desbanir no Mural | ✅ |
| Denunciar publicação | ✅ |
| Bloquear falsificação de autoria/metadados | ✅ |
| Bloquear acesso entre condomínios | ✅ |
| Parser OCR | ✅ testes locais |
| Busca/filtros | ✅ testes locais |
| Rotina lógica do lembrete de 3 dias | ✅ unitário em Functions |
| Regra de autenticação recente para exclusão | ✅ unitário em Functions |
| Anonimização de histórico | ✅ unitário em Functions |
| TypeScript | ✅ |
| Expo Doctor | ✅ |
| Bundle Expo Go | ✅ |
| Prebuild Android | ✅ |
| APK Android de validação | ✅ gerada pelo CI quando a pipeline passa |
| Auditoria de dependências | ✅ |
| Busca de padrões de credenciais privadas | ✅ |

## Teste de ponta a ponta no emulador

O script `scripts/test-vinculo-emulator.mjs` percorre o fluxo dos dois perfis desde o cadastro/vínculo até chegada e retirada de uma encomenda. O script `scripts/test-comunidade-seguranca-emulator.mjs` adiciona cenários ofensivos e de isolamento.

Comando equivalente ao CI:

```bash
npx firebase-tools@latest emulators:exec --only auth,firestore --project demo-cegonha \
  "node scripts/test-vinculo-emulator.mjs && node scripts/test-comunidade-seguranca-emulator.mjs"
```

## OCR

Os testes automatizados não enviam imagens reais para o OCR.Space. Eles validam o parser e a persistência posterior à confirmação. Para avaliação acadêmica com fotos reais, recomenda-se registrar uma amostra de etiquetas sob diferentes condições de iluminação e comparar os campos confirmados com o primeiro candidato sugerido.

## Teste físico antes da apresentação

Mesmo com CI aprovado, a versão apresentada deve ser instalada em pelo menos um aparelho Android e percorrer manualmente: login, vínculo, OCR/cadastro manual, aviso ao Morador, código de retirada e confirmação pela Portaria.
