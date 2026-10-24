from pathlib import Path


def patch(path, old, new, count=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    found = text.count(old)
    if found < count:
        raise SystemExit(f'{path}: padrao nao encontrado ({found} < {count})\n{old[:180]}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')


# VINCULO: novas contas da portaria entram somente apos aprovacao de uma portaria existente.
patch('services/vinculo.ts',
"""  codigo,\n}: {\n  moradorId: string;\n  moradorNome: string;\n  email: string;\n  bloco?: string;\n  apartamento?: string;\n  codigo: string;\n}) {""",
"""  codigo,\n  solicitanteTipo = 'morador',\n}: {\n  moradorId: string;\n  moradorNome: string;\n  email: string;\n  bloco?: string;\n  apartamento?: string;\n  codigo: string;\n  solicitanteTipo?: 'morador' | 'porteiro';\n}) {""")
patch('services/vinculo.ts',
"""    status: 'pendente',\n    criadoEm: atual ? (dadosAtuais?.criadoEm || serverTimestamp()) : serverTimestamp(),""",
"""    status: 'pendente',\n    solicitanteTipo,\n    criadoEm: atual ? (dadosAtuais?.criadoEm || serverTimestamp()) : serverTimestamp(),""")
patch('services/vinculo.ts',
"""    mensagem: `${moradorNome} solicitou entrada no condomínio${bloco || apartamento ? ` · Bloco ${bloco || '-'} · Ap. ${apartamento || '-'}` : ''}.`,""",
"""    mensagem: solicitanteTipo === 'porteiro'\n      ? `${moradorNome} solicitou acesso como Portaria ao condomínio.`\n      : `${moradorNome} solicitou entrada no condomínio${bloco || apartamento ? ` · Bloco ${bloco || '-'} · Ap. ${apartamento || '-'}` : ''}.`,""")

# CADASTRO: porteiro entrando em condominio existente fica pendente, sem privilegios.
patch('Screens/Register.tsx',
"""      condominioId: pendente.tipo === 'porteiro' ? (pendente.condominioPorteiro?.id || '') : '',\n      condominioNome: pendente.tipo === 'porteiro' ? (pendente.condominioPorteiro?.nome || '') : '',\n      condominioCodigo: pendente.tipo === 'porteiro' ? (pendente.condominioPorteiro?.codigoExibicao || '') : '',""",
"""      condominioId: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' ? (pendente.condominioPorteiro?.id || '') : '',\n      condominioNome: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' ? (pendente.condominioPorteiro?.nome || '') : '',\n      condominioCodigo: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' ? (pendente.condominioPorteiro?.codigoExibicao || '') : '',""")
patch('Screens/Register.tsx',
"""  async function criarSolicitacaoMorador(perfilCriado: PerfilUsuario, pendente: CadastroPendente) {\n    if (pendente.tipo !== 'morador' || !pendente.codigoCondominio.trim()) return null;\n    return solicitarVinculoPorCodigo({\n      moradorId: perfilCriado.id,\n      moradorNome: perfilCriado.nome,\n      email: perfilCriado.email,\n      bloco: perfilCriado.bloco,\n      apartamento: perfilCriado.apartamento,\n      codigo: pendente.codigoCondominio,\n    });\n  }""",
"""  async function criarSolicitacaoMorador(perfilCriado: PerfilUsuario, pendente: CadastroPendente) {\n    const precisaSolicitar = !!pendente.codigoCondominio.trim() && (\n      pendente.tipo === 'morador' ||\n      (pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'entrar')\n    );\n    if (!precisaSolicitar) return null;\n    return solicitarVinculoPorCodigo({\n      moradorId: perfilCriado.id,\n      moradorNome: perfilCriado.nome,\n      email: perfilCriado.email,\n      bloco: perfilCriado.bloco,\n      apartamento: perfilCriado.apartamento,\n      codigo: pendente.codigoCondominio,\n      solicitanteTipo: pendente.tipo,\n    });\n  }""")
patch('Screens/Register.tsx',
"""    if (pendente.modoPorteiro === 'entrar') return 'E-mail confirmado e cadastro da portaria concluído.';""",
"""    if (pendente.modoPorteiro === 'entrar') return solicitacaoErro\n      ? 'E-mail confirmado. Não foi possível enviar o pedido de acesso à portaria; tente novamente pelo Perfil.'\n      : 'E-mail confirmado. Seu pedido para entrar como Portaria foi enviado e aguarda aprovação de uma conta da portaria já vinculada.';""")

# PERFIL: qualquer conta ainda sem condominio acompanha e conclui o proprio vinculo.
patch('Screens/Perfil.tsx',
"""    if (!user || perfil?.tipo !== 'morador' || perfil?.condominioId) {""",
"""    if (!user || !perfil || perfil.condominioId) {""")
patch('Screens/Perfil.tsx',
"""      const resultado = await solicitarVinculoPorCodigo({ moradorId:user.uid, moradorNome:perfil.nome, email:perfil.email, bloco:perfil.bloco, apartamento:perfil.apartamento, codigo });""",
"""      const resultado = await solicitarVinculoPorCodigo({ moradorId:user.uid, moradorNome:perfil.nome, email:perfil.email, bloco:perfil.bloco, apartamento:perfil.apartamento, codigo, solicitanteTipo:perfil.tipo });""")
patch('Screens/Perfil.tsx',
"""    {isMorador && !perfil.condominioId && <View style={styles.card}>""",
"""    {!perfil.condominioId && <View style={styles.card}>""")
patch('Screens/Perfil.tsx',
"""      <Text style={styles.cardLabel}>VINCULAR CONDOMÍNIO</Text>""",
"""      <Text style={styles.cardLabel}>{isMorador ? 'VINCULAR CONDOMÍNIO' : 'SOLICITAR ACESSO À PORTARIA'}</Text>""")

# SOLICITACOES: mostram moradores e novas contas da portaria corretamente.
patch('Screens/SolicitacoesCondominio.tsx',
"""    tipo: 'morador',""",
"""    tipo: item.solicitanteTipo || 'morador',""")
patch('Screens/SolicitacoesCondominio.tsx',
"""<Text style={styles.title}>Solicitações de entrada</Text><Text style={styles.subtitle}>Aprove somente moradores que pertencem ao condomínio.</Text>""",
"""<Text style={styles.title}>Solicitações de entrada</Text><Text style={styles.subtitle}>Aprove moradores e novas contas da portaria somente quando reconhecer a pessoa solicitante.</Text>""")
patch('Screens/SolicitacoesCondominio.tsx',
"""        <Text style={styles.name}>{item.moradorNome}</Text><Text style={styles.meta}>Bloco {item.bloco || '-'} · Ap. {item.apartamento || '-'}</Text><Text style={styles.meta}>{item.email || ''}</Text>""",
"""        <Text style={styles.name}>{item.moradorNome}</Text><Text style={styles.meta}>{item.solicitanteTipo === 'porteiro' ? 'Acesso solicitado: Portaria' : `Bloco ${item.bloco || '-'} · Ap. ${item.apartamento || '-'}`}</Text><Text style={styles.meta}>{item.email || ''}</Text>""")
patch('Screens/SolicitacoesCondominio.tsx',
"""          ? 'Sua solicitação para entrar no condomínio foi aprovada. Abra o Perfil para concluir o vínculo.'\n          : 'Sua solicitação de vínculo com o condomínio foi recusada pela portaria.',""",
"""          ? (item.solicitanteTipo === 'porteiro' ? 'Seu acesso como Portaria foi aprovado. Abra o Perfil para concluir o vínculo.' : 'Sua solicitação para entrar no condomínio foi aprovada. Abra o Perfil para concluir o vínculo.')\n          : (item.solicitanteTipo === 'porteiro' ? 'Seu pedido de acesso como Portaria foi recusado.' : 'Sua solicitação de vínculo com o condomínio foi recusada pela portaria.'),""")
patch('Screens/PorteiroHome.tsx',
"""<Text style={styles.requestText}>Solicitações de moradores</Text>""",
"""<Text style={styles.requestText}>Solicitações de entrada</Text>""")

# REGRAS: portaria pendente nao tem privilegios; vinculos exigem aprovacao e role correspondente.
patch('firestore.rules',
"""    function porteiro() { return logado() && perfil().tipo == 'porteiro'; }""",
"""    function porteiro() {\n      return logado()\n        && perfil().tipo == 'porteiro'\n        && perfil().get('condominioId', '') is string\n        && perfil().get('condominioId', '').size() > 0;\n    }""")
patch('firestore.rules',
"""        && get(/databases/$(database)/documents/solicitacoesCondominio/$(solicitacaoId)).data.status == 'aprovada';""",
"""        && get(/databases/$(database)/documents/solicitacoesCondominio/$(solicitacaoId)).data.status == 'aprovada'\n        && get(/databases/$(database)/documents/solicitacoesCondominio/$(solicitacaoId)).data.get('solicitanteTipo', 'morador') == perfil().tipo;""")
patch('firestore.rules',
"""    function avisoSolicitacaoValidoParaPortaria() {\n      return morador()\n        && request.resource.data.tipo == 'solicitacao_vinculo'""",
"""    function avisoSolicitacaoValidoParaPortaria() {\n      return logado()\n        && perfil().tipo in ['morador', 'porteiro']\n        && perfil().get('condominioId', '') == ''\n        && request.resource.data.tipo == 'solicitacao_vinculo'""")
patch('firestore.rules',
"""        && getAfter(/databases/$(database)/documents/solicitacoesCondominio/$(request.resource.data.referenciaId)).data.status == 'pendente';""",
"""        && getAfter(/databases/$(database)/documents/solicitacoesCondominio/$(request.resource.data.referenciaId)).data.status == 'pendente'\n        && getAfter(/databases/$(database)/documents/solicitacoesCondominio/$(request.resource.data.referenciaId)).data.get('solicitanteTipo', 'morador') == perfil().tipo;""", 1)
patch('firestore.rules',
"""          (request.resource.data.tipo == 'porteiro'\n            && request.resource.data.condominioId.size() == 7\n            && existsAfter(/databases/$(database)/documents/condominios/$(request.resource.data.condominioId)))""",
"""          (request.resource.data.tipo == 'porteiro'\n            && (\n              request.resource.data.condominioId == '' ||\n              (request.resource.data.condominioId.size() == 7\n                && existsAfter(/databases/$(database)/documents/condominios/$(request.resource.data.condominioId))\n                && getAfter(/databases/$(database)/documents/condominios/$(request.resource.data.condominioId)).data.criadoPor == request.auth.uid)\n            ))""")
patch('firestore.rules',
"""            resource.data.tipo == 'morador'\n            && resource.data.get('condominioId', '') == ''""",
"""            resource.data.tipo in ['morador', 'porteiro']\n            && resource.data.get('condominioId', '') == ''""")
patch('firestore.rules',
"""    match /solicitacoesCondominio/{id} {\n      allow create: if morador()\n        && request.resource.data.moradorId == request.auth.uid\n        && request.resource.data.status == 'pendente'""",
"""    match /solicitacoesCondominio/{id} {\n      allow create: if logado()\n        && perfil().tipo in ['morador', 'porteiro']\n        && perfil().get('condominioId', '') == ''\n        && request.resource.data.moradorId == request.auth.uid\n        && request.resource.data.status == 'pendente'\n        && request.resource.data.get('solicitanteTipo', 'morador') == perfil().tipo""")
patch('firestore.rules',
"""        (morador()\n          && resource.data.moradorId == request.auth.uid\n          && request.resource.data.moradorId == resource.data.moradorId\n          && request.resource.data.condominioId == resource.data.condominioId\n          && ((resource.data.status in ['pendente', 'rejeitada'] && request.resource.data.status == 'pendente') ||\n              (resource.data.status == 'aprovada' && request.resource.data.status == 'concluida')))""",
"""        (logado()\n          && perfil().tipo == resource.data.get('solicitanteTipo', 'morador')\n          && resource.data.moradorId == request.auth.uid\n          && request.resource.data.moradorId == resource.data.moradorId\n          && request.resource.data.condominioId == resource.data.condominioId\n          && request.resource.data.get('solicitanteTipo', 'morador') == resource.data.get('solicitanteTipo', 'morador')\n          && ((resource.data.status in ['pendente', 'rejeitada'] && request.resource.data.status == 'pendente') ||\n              (resource.data.status == 'aprovada' && request.resource.data.status == 'concluida')))""")
patch('firestore.rules',
"""            && request.resource.data.moradorId is string\n            && moradorExiste(request.resource.data.moradorId)""",
"""            && request.resource.data.moradorId is string\n            && usuarioExiste(request.resource.data.moradorId)""")

# CONDOMINIO: campos de identidade nao podem ser tomados por outro porteiro.
patch('firestore.rules',
"""      allow update: if logado() && (\n        resource.data.criadoPor == request.auth.uid ||\n        (porteiro() && mesmoCondominio(condominioId))\n      );""",
"""      allow update: if logado()\n        && (resource.data.criadoPor == request.auth.uid || (porteiro() && mesmoCondominio(condominioId)))\n        && request.resource.data.criadoPor == resource.data.criadoPor\n        && request.resource.data.codigo == resource.data.codigo\n        && request.resource.data.get('codigoExibicao', '') == resource.data.get('codigoExibicao', '')\n        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nome', 'endereco', 'atualizadoEm']);""")

# MURAL: respostas e denuncias precisam refletir uma publicacao real.
patch('firestore.rules',
"""            request.resource.data.respostaParaAutorId is string\n            && request.resource.data.respostaParaAutorId.size() > 0\n            && request.resource.data.respostaParaAutorId != request.auth.uid\n          )""",
"""            request.resource.data.respostaParaAutorId is string\n            && request.resource.data.respostaParaAutorId.size() > 0\n            && request.resource.data.respostaParaAutorId != request.auth.uid\n            && exists(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId))\n            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.condominioId == request.resource.data.condominioId\n            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.autorId == request.resource.data.respostaParaAutorId\n          )""")
patch('firestore.rules',
"""    match /muralDenuncias/{id} {\n      allow create: if logado()\n        && mesmoCondominio(request.resource.data.condominioId)\n        && request.resource.data.denuncianteId == request.auth.uid\n        && request.resource.data.autorId != request.auth.uid\n        && request.resource.data.comentarioId is string\n        && request.resource.data.comentarioId.size() > 0;""",
"""    match /muralDenuncias/{id} {\n      allow create: if logado()\n        && mesmoCondominio(request.resource.data.condominioId)\n        && request.resource.data.denuncianteId == request.auth.uid\n        && request.resource.data.autorId != request.auth.uid\n        && request.resource.data.comentarioId is string\n        && request.resource.data.comentarioId.size() > 0\n        && request.resource.data.status == 'pendente'\n        && request.resource.data.motivo is string\n        && request.resource.data.motivo.size() > 0\n        && request.resource.data.motivo.size() <= 120\n        && request.resource.data.get('detalhes', '') is string\n        && request.resource.data.get('detalhes', '').size() <= 1000\n        && exists(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId))\n        && get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.condominioId == request.resource.data.condominioId\n        && get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.autorId == request.resource.data.autorId\n        && request.resource.data.comentarioTexto == get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.texto;""")
patch('firestore.rules',
"""      allow update: if porteiro()\n        && mesmoCondominio(resource.data.condominioId)\n        && request.resource.data.condominioId == resource.data.condominioId\n        && request.resource.data.denuncianteId == resource.data.denuncianteId\n        && request.resource.data.autorId == resource.data.autorId\n        && request.resource.data.comentarioId == resource.data.comentarioId;""",
"""      allow update: if porteiro()\n        && mesmoCondominio(resource.data.condominioId)\n        && request.resource.data.condominioId == resource.data.condominioId\n        && request.resource.data.denuncianteId == resource.data.denuncianteId\n        && request.resource.data.autorId == resource.data.autorId\n        && request.resource.data.comentarioId == resource.data.comentarioId\n        && request.resource.data.status in ['ignorada', 'publicacao_excluida', 'autor_banido', 'autor_desbanido']\n        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','resolvidaEm','resolvidoPorId','resolvidoPorNome']);""")
patch('firestore.rules',
"""      allow create, update: if porteiro() && mesmoCondominio(request.resource.data.condominioId);""",
"""      allow create, update: if porteiro()\n        && mesmoCondominio(request.resource.data.condominioId)\n        && request.resource.data.usuarioId is string\n        && usuarioNoCondominio(request.resource.data.usuarioId, request.resource.data.condominioId)\n        && id == request.resource.data.condominioId + '_' + request.resource.data.usuarioId;""", 1)
patch('firestore.rules',
"""        && request.resource.data.usuarioId.size() > 0\n        && request.resource.data.usuarioNome is string""",
"""        && request.resource.data.usuarioId.size() > 0\n        && usuarioNoCondominio(request.resource.data.usuarioId, request.resource.data.condominioId)\n        && request.resource.data.usuarioNome is string""")

# Moderacao local e titulo de push.
patch('utils/moderacao.ts',
"""  const compacto = normalizado.replace(/[^a-z0-9]/g, '');\n  return ['fdp', 'vsf', 'fodase'].some(abreviacao => compacto === abreviacao);""",
"""  const compacto = normalizado.replace(/[^a-z0-9]/g, '');\n  return ['fdp', 'vsf', 'fodase'].some(abreviacao => compacto === abreviacao);""")
patch('functions/push.js',
"""  denuncia: 'Nova denúncia no mural',""",
"""  denuncia: 'Nova denúncia no mural',\n  resposta_mural: 'Nova resposta no mural',""")
patch('functions/test/push.test.js',
"""test('usa titulos claros para retirada solicitada e contestacao', () => {\n  assert.equal(tituloParaTipo('retirada_solicitada'), 'Morador informou retirada');\n  assert.equal(tituloParaTipo('contestacao_encomenda'), 'Encomenda contestada');\n});""",
"""test('usa titulos claros para retirada solicitada, contestacao e resposta do mural', () => {\n  assert.equal(tituloParaTipo('retirada_solicitada'), 'Morador informou retirada');\n  assert.equal(tituloParaTipo('contestacao_encomenda'), 'Encomenda contestada');\n  assert.equal(tituloParaTipo('resposta_mural'), 'Nova resposta no mural');\n});""")

# Testes contra referencias adulteradas no mural.
patch('scripts/test-comunidade-seguranca-emulator.mjs',
"""  const respostaSalva = await getDoc(respostaRef);\n  assert.equal(respostaSalva.data()?.respostaParaId, originalRef.id, 'Resposta deve preservar a referência da mensagem respondida.');""",
"""  const respostaSalva = await getDoc(respostaRef);\n  assert.equal(respostaSalva.data()?.respostaParaId, originalRef.id, 'Resposta deve preservar a referência da mensagem respondida.');\n\n  const respostaForjadaRef = doc(collection(db, 'mural'));\n  await assert.rejects(\n    setDoc(respostaForjadaRef, {\n      condominioId: CONDOMINIO_ID,\n      autorId: moradorUid,\n      autorNome: 'Morador Teste',\n      autorTipo: 'morador',\n      texto: 'Tentativa de resposta com autor de destino adulterado.',\n      respostaParaId: originalRef.id,\n      respostaParaAutorId: moradorUid,\n      criadoEm: serverTimestamp(),\n      criadoEmCliente: Date.now(),\n    }),\n    erro => String(erro?.code || '').includes('permission-denied'),\n    'Nao deve ser possivel fabricar uma resposta para um autor diferente do autor da publicacao original.',\n  );\n\n  const denunciaForjadaRef = doc(collection(db, 'muralDenuncias'));\n  await assert.rejects(\n    setDoc(denunciaForjadaRef, {\n      condominioId: CONDOMINIO_ID,\n      comentarioId: originalRef.id,\n      comentarioTexto: 'Texto adulterado',\n      autorId: portariaUid,\n      autorNome: 'Portaria Teste',\n      autorTipo: 'porteiro',\n      denuncianteId: moradorUid,\n      denuncianteNome: 'Morador Teste',\n      motivo: 'Outro motivo',\n      detalhes: '',\n      criadoEm: serverTimestamp(),\n      status: 'pendente',\n    }),\n    erro => String(erro?.code || '').includes('permission-denied'),\n    'A denuncia precisa refletir a publicacao real e nao pode carregar texto adulterado.',\n  );""")

# Arquivos temporarios nunca ficam no resultado final.
for temp in ['.github/workflows/repair-cegonha.yml', 'scripts/repair-cegonha.py']:
    Path(temp).unlink(missing_ok=True)
