# CENTRAL de palestras

Hub único pra criar, revisar e publicar as palestras do Vitor. Se você
(humano ou agente) está prestes a começar uma palestra nova, comece por
aqui.

> Documentação técnica de "como o `meta.json` funciona" está no
> [`README.md`](README.md). Este arquivo aqui é sobre **processo, tom e
> o que a gente já aprendeu** — e deve crescer a cada palestra nova.

## Onde trabalhar

Esta pasta (`palestras/`) é o único lugar. Não existe mais pasta separada
fora do git pra rascunho — tudo acontece aqui:

```
palestras/
  _rascunhos/<slug>/     ← WIP. Gitignorada, nunca vai pro repo público.
  <slug>/                ← publicado. Tem meta.json, é sincronizado pro site.
    meta.json
    index.html
    images/
```

Fluxo normal:

1. Cria a pasta em `_rascunhos/<slug>/` e trabalha à vontade — pode ficar
   bagunçado, testar coisa, ter imagem de placeholder, não faz mal.
2. Quando estiver pronto: copia (ou move) `_rascunhos/<slug>/` pra
   `<slug>/` na raiz, adiciona o `meta.json` (ver formato no `README.md`),
   confere localmente (`node scripts/build-manifest.mjs` e abre
   `dist/<slug>/index.html` num servidor local).
3. `git add <slug>/ && git commit && git push`. ~15-20s depois está no ar
   em `vsoller.com.br/materiais/<slug>/`.

## Exemplos existentes (referência de estrutura e nível)

- **`certificado-antes-de-formado/`** — 17 slides, sobre a trilha de
  certificações AWS. Formato: motor de apresentação completo (chassis),
  scroll-snap, animações de entrada, QR codes.
- **`franscarmo-engenharia-computacao/`** — 26 slides, palestra de
  carreira pra colégio (Feira de Profissões). Mesmo motor. Boa referência
  de como estruturar uma narrativa: gancho → quem sou → trajetória →
  conteúdo técnico → carreira/mercado → fechamento com CTA.

Ambas usam o mesmo "motor de apresentação" (chassis): canvas fixo
1920×1080 escalado pro viewport, `.slide` vira slide cheio de tela via
scroll-snap, animações de entrada via Web Animations API, navegação por
teclado/scroll/swipe, QR codes gerados ao vivo via
`api.qrserver.com/v1/create-qr-code/`. Pra uma palestra nova nesse
formato, o jeito mais rápido é pedir pro ClickUp Brain gerar o HTML nesse
padrão (ou copiar a estrutura de uma existente) e ajustar conteúdo — não
reescrever o motor do zero.

## Tom de voz

- **Português direto, primeira pessoa.** "Eu mudei de área três vezes" >
  "O profissional pode mudar de área". Fala como quem já viveu aquilo, não
  como slide corporativo.
- **Frases curtas.** Uma ideia por frase. Quebra de linha (`<br>`) no meio
  de um título é mais forte que uma frase longa.
- **`<em>` pra destacar a palavra que importa** (fica laranja no tema
  padrão). Um por título/frase, no máximo dois — se tudo é destaque, nada
  é.
- **Dado real > adjetivo.** "5 anos, 26h de aula por semana" convence mais
  que "curso puxado".
- **Honestidade em vez de venda.** Bate de frente com a parte chata (2
  anos em que você vai querer desistir; 5 anos de aula) antes de vender o
  lado bom. Isso soa mais confiável que só elogiar.
- **Evite afirmação absoluta que você não consegue sustentar.** Já
  corrigimos "ninguém entra júnior em cyber" pra algo mais realista ("dá
  pra entrar júnior, com estudo extra") e tiramos "cinco caminhos" de um
  título porque a lista de 5 cards não esgotava as opções reais. Se uma
  frase de efeito não é 100% verdade, ela não entra.
- **Não force metáfora que não se sustenta até o fim.** O gancho do
  "restaurante" (frontend=salão, backend=cozinha) foi usado nos primeiros
  slides mas cortado do fechamento porque não estava mais carregando
  sentido ali — métafora serve enquanto ajuda, não precisa reaparecer o
  tempo todo.

## Timing

**Referência: ~45 min de palestra.** É a média das palestras do Vitor até
agora — use como alvo ao planejar quantos slides fazer.

Ponto de calibração conhecido: **Franscarmo tem 26 slides pra ~45 min**,
ou seja, **~1,7 min por slide** em média (varia — slides de estatística
passam rápido, slides de história/trajetória seguram mais tempo). Use
isso como estimativa inicial de quantos slides fazer pra um tempo alvo, e
**ajusta esse número depois de cada palestra real**, anotando abaixo o que
rolou de verdade (tempo real, se sobrou/faltou conteúdo, quais slides
prenderam ou perderam a atenção).

| Palestra | Slides | Tempo alvo | Tempo real | Nota |
|---|---|---|---|---|
| certificado-antes-de-formado | 17 | — | — | — |
| franscarmo-engenharia-computacao | 26 | 45 min | — | preencher depois de apresentar |

## Lições e correções recorrentes

Lista viva — todo agente/sessão que trabalhar numa palestra nova deve
adicionar aqui o que aprendeu, não só seguir o que já está escrito.

**Sobre exports do ClickUp Brain (se for esse o caminho pra gerar o HTML):**
o export "congelado no meio da sessão" costuma vir com 3 bugs sempre — dá
pra checar isso automaticamente antes de publicar:
1. `<section class="slide ...">` com `style="background: transparent"`
   inline → remove esse atributo de todos, senão o motor lê a cor errada
   dos slides ao recarregar.
2. `_setupReveals()` no `<script>` embutido esconde conteúdo de slides que
   já estavam marcados `reveals-played` no arquivo salvo → precisa da
   correção "só esconde se `!alreadyPlayed`" (ver diff em qualquer
   palestra já publicada pra copiar o patch exato).
3. `<base href="/">` deveria ser `<base href=".">`, e o `<head>` às vezes
   vem com um bloco gigante de CSS de ad-blocker injetado (lixo de
   extensão do navegador no "salvar como") — procura por seletores tipo
   `adstub.net` e remove o `<style>` inteiro.
4. Remove os `<script type="module" src="polyfills-*.js">` /
   `main-*.js"` / `importmap` no fim do arquivo — são o runtime Angular do
   próprio ClickUp, não servem pra nada aqui (o motor de slides já é
   autocontido).

**Sobre imagens:**
- Prioridade: foto real já existente (do portfólio, do LinkedIn, de
  artigos antigos) > imagem com licença clara e creditada (Wikimedia
  Commons CC, etc.) > logo oficial direto do site da instituição (mais
  confiável e com melhor resolução que print/thumbnail do Google Imagens)
  > placeholder deixado em aberto pra você mandar depois. Nunca inventa
  foto de gente/evento real.
- Imagem com licença externa (não sua, não do Vitor) **sempre leva
  crédito visível no slide** (usa a classe `.src` que os decks já têm).
- Diagrama/logo com fundo branco dentro de um slot que teria `object-fit:
  cover` por padrão → troca pra `object-fit: contain` com padding, senão
  corta texto.
- QR code: gerado ao vivo via `api.qrserver.com` (mesmo padrão nos dois
  decks existentes), não precisa baixar/hospedar. Cuidado com `#` dentro
  da URL de destino (precisa virar `%23`, senão quebra o parâmetro).

**Sobre layout:**
- Depois de colocar uma imagem grande do lado de texto (`split.p2`,
  800px + resto), conferir se o texto não estourou a borda direita —
  aconteceu no slide de datacenter da Franscarmo. Se tiver muito
  conteúdo textual ao lado (várias estatísticas grandes), a imagem
  provavelmente precisa ser mais estreita que 800px.
- Testar localmente (`python -m http.server` na pasta, ou o
  `dist/<slug>` gerado pelo script) antes do push é mais confiável do que
  confiar em print de navegador remoto — a ferramenta de screenshot
  automatizada é instável nesta configuração, não vale insistir nela.

**Sobre pedidos ambíguos do Vitor:**
- Quando um pedido de mudança tem duas leituras plausíveis (ex: "troca o
  link" pode significar substituir ou adicionar) e a decisão afeta algo
  já publicado, **confirma antes de aplicar** em vez de assumir — já
  aconteceu de eu (a IA) assumir errado uma vez (QR "adicionar" vs.
  "substituir") e precisar desfazer.

**Sobre infraestrutura:**
- `s3deploy.BucketDeployment` do CDK **não retém arquivos por padrão** ao
  remover o construct — isso já causou um apagão acidental de
  `materiais/` inteiro numa migração. Qualquer mudança em infra que toque
  bucket/CloudFront merece checagem de "o que acontece com o conteúdo já
  publicado" antes de aplicar, não depois.
