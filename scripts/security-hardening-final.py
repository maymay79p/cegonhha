from pathlib import Path

RULES = Path('firestore.rules')
TESTS = Path('scripts/test-comunidade-seguranca-emulator.mjs')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Padrao nao encontrado: {label}')
    return text.replace(old, new, 1)

rules = RULES.read_text(encoding='utf-8')

rules = replace_once(rules,
"""        && request.resource.data.remetenteId == request.auth.uid
        && request.resource.data.destinatarioId is string""",
"""        && request.resource.data.remetenteId == request.auth.uid
        && request.resource.data.remetenteNome == perfil().get('nome', '')
        && request.resource.data.destinatarioId is string""",
'aviso resposta: identidade do remetente')

rules = replace_once(rules,
"""    match /mural/{id} {
      allow read: if logado() && mesmoCondominio(resource.data.condominioId);
      allow create: if logado()
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.autorId == request.auth.uid
        && request.resource.data.autorNome is string
        && request.resource.data.autorNome.size() > 0
        && request.resource.data.autorNome.size() <= 120
        && request.resource.data.autorTipo == perfil().tipo""",
"""    match /mural/{id} {
      allow read: if logado() && mesmoCondominio(resource.data.condominioId);
      allow create: if logado()
        && request.resource.data.keys().hasOnly([
          'condominioId','autorId','autorNome','autorTipo','texto','criadoEm','criadoEmCliente',
          'respostaParaId','respostaParaAutorId','respostaParaAutorNome','respostaParaAutorTipo','respostaParaTexto'
        ])
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.autorId == request.auth.uid
        && request.resource.data.autorNome == perfil().get('nome', '')
        && request.resource.data.autorNome is string
        && request.resource.data.autorNome.size() > 0
        && request.resource.data.autorNome.size() <= 120
        && request.resource.data.autorTipo == perfil().tipo""",
'mural: campos e identidade')

rules = replace_once(rules,
"""            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.condominioId == request.resource.data.condominioId
            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.autorId == request.resource.data.respostaParaAutorId
          )""",
"""            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.condominioId == request.resource.data.condominioId
            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.autorId == request.resource.data.respostaParaAutorId
            && request.resource.data.respostaParaAutorNome == get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.autorNome
            && request.resource.data.respostaParaAutorTipo == get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.autorTipo
            && request.resource.data.respostaParaTexto is string
            && request.resource.data.respostaParaTexto.size() <= 180
          )""",
'mural: metadados da resposta')

rules = replace_once(rules,
"""    match /muralDenuncias/{id} {
      allow create: if logado()
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.denuncianteId == request.auth.uid""",
"""    match /muralDenuncias/{id} {
      allow create: if logado()
        && request.resource.data.keys().hasOnly([
          'condominioId','comentarioId','comentarioTexto','autorId','autorNome','autorTipo',
          'denuncianteId','denuncianteNome','motivo','detalhes','criadoEm','status'
        ])
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.denuncianteId == request.auth.uid
        && request.resource.data.denuncianteNome == perfil().get('nome', '')""",
'denuncia: campos e denunciante')

rules = replace_once(rules,
"""        && get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.condominioId == request.resource.data.condominioId
        && get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.autorId == request.resource.data.autorId
        && request.resource.data.comentarioTexto == get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.texto;""",
"""        && get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.condominioId == request.resource.data.condominioId
        && get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.autorId == request.resource.data.autorId
        && request.resource.data.autorNome == get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.autorNome
        && request.resource.data.autorTipo == get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.autorTipo
        && request.resource.data.comentarioTexto == get(/databases/$(database)/documents/mural/$(request.resource.data.comentarioId)).data.texto;""",
'denuncia: autor real')

rules = replace_once(rules,
"""      allow create, update: if porteiro()
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.usuarioId is string
        && usuarioNoCondominio(request.resource.data.usuarioId, request.resource.data.condominioId)
        && id == request.resource.data.condominioId + '_' + request.resource.data.usuarioId;""",
"""      allow create, update: if porteiro()
        && request.resource.data.keys().hasOnly([
          'usuarioId','usuarioNome','condominioId','ativo','banidoPorId','banidoPorNome','atualizadoEm',
          'banidoEm','desbanidoEm','desbanidoPorId','desbanidoPorNome'
        ])
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.usuarioId is string
        && usuarioNoCondominio(request.resource.data.usuarioId, request.resource.data.condominioId)
        && request.resource.data.usuarioNome == get(/databases/$(database)/documents/usuarios/$(request.resource.data.usuarioId)).data.get('nome', '')
        && request.resource.data.ativo is bool
        && (
          (request.resource.data.ativo == true
            && request.resource.data.banidoPorId == request.auth.uid
            && request.resource.data.banidoPorNome == perfil().get('nome', '')) ||
          (request.resource.data.ativo == false
            && request.resource.data.desbanidoPorId == request.auth.uid
            && request.resource.data.desbanidoPorNome == perfil().get('nome', ''))
        )
        && id == request.resource.data.condominioId + '_' + request.resource.data.usuarioId;""",
'banimento privado: integridade')

rules = replace_once(rules,
"""      allow create, update: if porteiro()
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.usuarioId is string
        && request.resource.data.usuarioId.size() > 0
        && usuarioNoCondominio(request.resource.data.usuarioId, request.resource.data.condominioId)
        && request.resource.data.usuarioNome is string
        && request.resource.data.usuarioNome.size() > 0
        && request.resource.data.ativo is bool""",
"""      allow create, update: if porteiro()
        && request.resource.data.keys().hasOnly(['usuarioId','usuarioNome','condominioId','ativo','atualizadoEm'])
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.usuarioId is string
        && request.resource.data.usuarioId.size() > 0
        && usuarioNoCondominio(request.resource.data.usuarioId, request.resource.data.condominioId)
        && request.resource.data.usuarioNome == get(/databases/$(database)/documents/usuarios/$(request.resource.data.usuarioId)).data.get('nome', '')
        && request.resource.data.usuarioNome is string
        && request.resource.data.usuarioNome.size() > 0
        && request.resource.data.ativo is bool""",
'banimento publico: integridade')

rules = replace_once(rules,
"""    match /auditoria/{id} {
      allow create: if porteiro()
        && request.resource.data.atorId == request.auth.uid
        && mesmoCondominio(request.resource.data.condominioId);""",
"""    match /auditoria/{id} {
      allow create: if porteiro()
        && request.resource.data.atorId == request.auth.uid
        && request.resource.data.atorNome == perfil().get('nome', '')
        && request.resource.data.acao is string
        && request.resource.data.acao.size() > 0
        && request.resource.data.acao.size() <= 80
        && request.resource.data.get('detalhe', '') is string
        && request.resource.data.get('detalhe', '').size() <= 500
        && mesmoCondominio(request.resource.data.condominioId);""",
'auditoria: identidade do ator')

rules = replace_once(rules,
"""    match /ocrLeituras/{id} {
      allow create: if porteiro()
        && request.resource.data.porteiroId == request.auth.uid
        && mesmoCondominio(request.resource.data.condominioId);""",
"""    match /ocrLeituras/{id} {
      allow create: if porteiro()
        && request.resource.data.porteiroId == request.auth.uid
        && request.resource.data.porteiroNome == perfil().get('nome', '')
        && mesmoCondominio(request.resource.data.condominioId);""",
'ocr leituras: identidade')

rules = replace_once(rules,
"""    match /ocrTestes/{id} {
      allow create: if porteiro()
        && request.resource.data.porteiroId == request.auth.uid
        && mesmoCondominio(request.resource.data.condominioId);""",
"""    match /ocrTestes/{id} {
      allow create: if porteiro()
        && request.resource.data.porteiroId == request.auth.uid
        && request.resource.data.porteiroNome == perfil().get('nome', '')
        && mesmoCondominio(request.resource.data.condominioId);""",
'ocr testes: identidade')

rules = replace_once(rules,
"""      allow create: if porteiro()
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.porteiroId == request.auth.uid
        && request.resource.data.moradorId is string""",
"""      allow create: if porteiro()
        && mesmoCondominio(request.resource.data.condominioId)
        && request.resource.data.porteiroId == request.auth.uid
        && request.resource.data.porteiroNome == perfil().get('nome', '')
        && request.resource.data.moradorId is string""",
'encomenda: identidade da portaria')

rules = replace_once(rules,
"""        && request.resource.data.moradorId is string
        && moradorNoCondominio(request.resource.data.moradorId, request.resource.data.condominioId)
        && request.resource.data.status == 'pendente'""",
"""        && request.resource.data.moradorId is string
        && moradorNoCondominio(request.resource.data.moradorId, request.resource.data.condominioId)
        && request.resource.data.moradorNome == get(/databases/$(database)/documents/usuarios/$(request.resource.data.moradorId)).data.get('nome', '')
        && request.resource.data.get('bloco', '') == get(/databases/$(database)/documents/usuarios/$(request.resource.data.moradorId)).data.get('bloco', '')
        && request.resource.data.get('apartamento', '') == get(/databases/$(database)/documents/usuarios/$(request.resource.data.moradorId)).data.get('apartamento', '')
        && request.resource.data.origem in ['manual','ocr']
        && request.resource.data.get('ocrScore', 0) is number
        && request.resource.data.status == 'pendente'""",
'encomenda: identidade do morador')

rules = replace_once(rules,
"""        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'moradorNotificadoEm','historico','lembrete3dEnviado','status','retiradaEm',
          'retiradaPorId','retiradaPorNome','retiradaRecebedorNome','codigoRetiradaConfirmado'
        ])
        && (request.resource.data.status != 'retirada' || request.resource.data.retiradaPorId == request.auth.uid);""",
"""        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'moradorNotificadoEm','historico','lembrete3dEnviado','status','retiradaEm',
          'retiradaPorId','retiradaPorNome','retiradaRecebedorNome','codigoRetiradaConfirmado'
        ])
        && request.resource.data.get('retiradaRecebedorNome', '') is string
        && request.resource.data.get('retiradaRecebedorNome', '').size() <= 120
        && request.resource.data.get('codigoRetiradaConfirmado', false) is bool
        && (request.resource.data.status != 'retirada' || (
          request.resource.data.retiradaPorId == request.auth.uid
          && request.resource.data.retiradaPorNome == perfil().get('nome', '')
        ));""",
'encomenda: retirada atribuida')

RULES.write_text(rules, encoding='utf-8')

tests = TESTS.read_text(encoding='utf-8')
needle = """  const respostaForjadaRef = doc(collection(db, 'mural'));\n"""
if needle not in tests:
    raise SystemExit('Ponto de insercao dos testes nao encontrado')
extra = """  const autorForjadoRef = doc(collection(db, 'mural'));
  await assert.rejects(
    setDoc(autorForjadoRef, {
      condominioId: CONDOMINIO_ID,
      autorId: moradorUid,
      autorNome: 'Nome de Outra Pessoa',
      autorTipo: 'morador',
      texto: 'Tentativa de impersonar outro usuário no mural.',
      criadoEm: serverTimestamp(),
      criadoEmCliente: Date.now(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'O mural nao deve aceitar nome de autor diferente do perfil autenticado.',
  );

  const respostaMetadadosForjadosRef = doc(collection(db, 'mural'));
  await assert.rejects(
    setDoc(respostaMetadadosForjadosRef, {
      condominioId: CONDOMINIO_ID,
      autorId: moradorUid,
      autorNome: 'Morador Teste',
      autorTipo: 'morador',
      texto: 'Resposta com metadados adulterados.',
      respostaParaId: originalRef.id,
      respostaParaAutorId: portariaUid,
      respostaParaAutorNome: 'Nome adulterado',
      respostaParaAutorTipo: 'morador',
      respostaParaTexto: 'Texto exibido adulterado',
      criadoEm: serverTimestamp(),
      criadoEmCliente: Date.now(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'A resposta deve preservar nome e tipo reais do autor da publicacao original.',
  );

"""
tests = tests.replace(needle, extra + needle, 1)

needle2 = """  await entrar(PORTARIA_EMAIL);\n  const avisosPortaria = await getDocs(query(\n"""
if needle2 not in tests:
    raise SystemExit('Ponto de insercao do teste de denuncia nao encontrado')
extra2 = """  const denunciaIdentidadeForjadaRef = doc(collection(db, 'muralDenuncias'));
  await assert.rejects(
    setDoc(denunciaIdentidadeForjadaRef, {
      condominioId: CONDOMINIO_ID,
      comentarioId: originalRef.id,
      comentarioTexto: 'Mensagem original da Portaria para validar respostas específicas.',
      autorId: portariaUid,
      autorNome: 'Portaria Teste',
      autorTipo: 'porteiro',
      denuncianteId: moradorUid,
      denuncianteNome: 'Outra Pessoa',
      motivo: 'Outro motivo',
      detalhes: '',
      criadoEm: serverTimestamp(),
      status: 'pendente',
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'A denuncia nao deve permitir falsificar a identidade do denunciante.',
  );

"""
tests = tests.replace(needle2, extra2 + needle2, 1)
TESTS.write_text(tests, encoding='utf-8')

Path('scripts/security-hardening-final.py').unlink(missing_ok=True)
Path('.github/workflows/security-hardening-final.yml').unlink(missing_ok=True)
