from pathlib import Path

p = Path('scripts/repair-cegonha.py')
text = p.read_text(encoding='utf-8')
marker = '# MURAL: respostas e denuncias precisam refletir uma publicacao real.'
start_marker = text.index(marker)
first = text.index("patch('firestore.rules',", start_marker)
second = text.index("patch('firestore.rules',", first + 1)
replacement = '''patch('firestore.rules',
"""            && request.resource.data.respostaParaAutorId != request.auth.uid""",
"""            && request.resource.data.respostaParaAutorId != request.auth.uid
            && exists(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId))
            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.condominioId == request.resource.data.condominioId
            && get(/databases/$(database)/documents/mural/$(request.resource.data.respostaParaId)).data.autorId == request.resource.data.respostaParaAutorId""")
'''
text = text[:first] + replacement + text[second:]
p.write_text(text, encoding='utf-8')
