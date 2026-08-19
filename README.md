# Palestras

Cada pasta aqui é uma palestra e vira `https://vsoller.com.br/materiais/<slug>/`
(ou um link externo) assim que o push chega na `main` — sem precisar
mexer no repo do portfólio nem rodar `npm run build`/`cdk deploy`.

## Como adicionar uma palestra

```bash
mkdir minha-palestra
cp -r caminho/da/apresentacao/* minha-palestra/   # precisa ter index.html na raiz
```

E crie `minha-palestra/meta.json`:

```json
{
  "title": "Título da palestra",
  "date": "2026-10-01",
  "description": "Resumo curto de uma ou duas frases.",
  "type": "html"
}
```

`date` é usado só para ordenar a lista (mais nova primeiro) — o formato
exibido no card é esse mesmo, a menos que você adicione `dateLabel` com um
texto diferente (ex.: `"nov/2025 · IMT Mauá"`).

Três tipos:

- **`"html"`** — pasta com `index.html` (+ imagens/css que ele referenciar).
  Fica em `/materiais/<slug>/`.
- **`"file"`** — pasta com um único arquivo pra download (PDF, PPTX). Fica
  em `/materiais/<slug>/<nome-do-arquivo>`.
- **`"link"`** — sem conteúdo aqui, só um artigo/post externo. `meta.json`
  precisa de um campo `href` com a URL completa.

Dê `git push` na `main` e pronto — a Action gera o manifesto
(`talks.json`), sincroniza tudo pro S3 e invalida o CloudFront. Leva uns
10-20 segundos.

## Testar localmente antes de publicar

```bash
node scripts/build-manifest.mjs
```

Gera `dist/` com o que seria publicado (inclusive o `talks.json`
agregado) — dá pra abrir `dist/<slug>/index.html` num servidor local
(`python -m http.server` dentro da pasta) pra conferir antes do push.
