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
- tema claro, escuro ou conforme o sistema.

## Validação

```bash
npm ci
npm run typecheck
npm run doctor
```

## Firebase

Depois de alterar `firestore.rules`, publique as regras no projeto Firebase antes de testar os novos recursos:

```bash
npm run firebase:rules
```

As regras devem ser publicadas somente depois de revisão/testes da branch de desenvolvimento.

## Observações atuais

As notificações implementadas nesta etapa são notificações internas do aplicativo, armazenadas no Firestore e exibidas em tempo real para o morador. Push notification do sistema operacional com o aplicativo totalmente fechado exigirá uma etapa adicional com token de dispositivo e serviço de envio.

A localização do condomínio é cadastrada como endereço e pode ser aberta no aplicativo de mapas do dispositivo. Um mapa incorporado dentro do Cegonha exigirá a inclusão de uma biblioteca/SDK de mapas e configuração adicional.
