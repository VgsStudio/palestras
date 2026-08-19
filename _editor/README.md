# Editor visual (local)

Ferramenta local pra ajustar uma palestra sem editar HTML na mão: trocar
texto, subir/trocar imagem, ajustar o recorte de uma foto. Sem
build, sem `npm install`, sem backend — só abre no navegador.

## Requisito

**Chrome ou Edge** (usa a File System Access API, que só existe em
navegadores baseados em Chromium — não funciona no Firefox/Safari).

## Como rodar

```bash
cd _editor
python -m http.server 8090
```

Abre `http://localhost:8090` no Chrome. Não abre `index.html` direto
com duplo-clique — a API de acesso a arquivo exige `http://`, não
funciona em `file://`.

## Como usar

1. **"Abrir pasta de palestras…"** → escolhe a pasta `palestras/` (a
   raiz do repo, não uma subpasta). Autoriza o acesso quando o Chrome
   perguntar.
2. Escolhe a palestra no seletor (publicadas e as que estão em
   `_rascunhos/` aparecem, marcadas).
3. **Modo edição** (checkbox no topo): liga pra poder editar.
   - **Texto**: clica em qualquer título/parágrafo/label — vira editável
     na hora, direto no slide. Clica fora pra confirmar.
   - **Imagem já existente**: clica pra trocar o arquivo. Arrasta dentro
     dela pra ajustar o recorte (o quê da foto aparece no enquadramento).
   - **Slot vazio** (aquelas caixas tracejadas com "FOTO...jpg"): clica
     pra escolher um arquivo e preencher.
4. **Salvar**: grava direto no `index.html` da pasta. Não mexe em git —
   depois confere com `git diff`, e comita/publica do jeito de sempre (a
   mão ou via agente `palestra`).

## O que ainda não dá pra fazer aqui

- Mover um elemento de texto livremente pela tela (o layout é
  flex/grid estruturado, não posição livre).
- Reordenar itens de uma galeria por arraste.
- Editar o destino de um QR code (são gerados por URL externa, não
  arquivo local).
- Adicionar ou remover um slide inteiro.

Essas continuam sendo trabalho do agente `palestra` (ou peça direto no
chat) — ver `../CENTRAL.md`.

## Limitações conhecidas

- O preview mostra cada slide "parado" (sem a animação de entrada) —
  é assim de propósito, pra ver tudo de uma vez sem depender de scroll.
  Pra ver a animação de verdade, publica e olha no site.
- Salvar reserializa o HTML inteiro — pode mudar formatação invisível
  (aspas de atributo, `&amp;` etc.) mesmo em partes que você não editou.
  O conteúdo visual não muda; o `git diff` pode ficar um pouco mais
  "ruidoso" do que só a mudança real.
