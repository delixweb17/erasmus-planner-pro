# Erasmus Planner Pro

App para quatro amigos gerirem o semestre de Erasmus em Pisa (setembro de 2027 a fevereiro de 2028):
viagens, despesas partilhadas, poupança privada, calendário com horário e exames, e chat do grupo.
Instala-se no telemóvel como app (PWA).

## Tecnologia

- **React 19 + TanStack Start/Router + Vite + TypeScript + Tailwind 4**, componentes shadcn/ui
- **Supabase**: login, base de dados partilhada e tempo real. As regras de acesso (RLS) estão em
  `supabase/migrations/` — a poupança de cada pessoa só é visível para ela.
- **Nitro** para o servidor: deteta sozinho onde está a ser publicado (Vercel, Netlify, Cloudflare…).
- Mapa com Leaflet + OpenStreetMap; pesquisa de lugares com Nominatim (sem chaves de API).

## Correr no computador

```bash
bun install        # ou npm install
bun run dev        # http://localhost:5173
bun run build      # versão de produção em .output/
node .output/server/index.mjs
```

## Publicar

O site é publicado a partir do ramo `main` do GitHub (ex.: Vercel ligada ao repositório).
Cada push para `main` publica uma versão nova.

Mudanças à base de dados: cada ficheiro novo em `supabase/migrations/` tem de ser corrido uma vez
no **SQL Editor** do Supabase (pela ordem dos nomes). Todos podem ser corridos mais do que uma vez.

## Estrutura

- `src/routes/` — páginas (Painel, Viagens, Despesas, Poupança, Chat, Calendário, Mapa, Definições)
- `src/data/` — tipos, ligação ao Supabase, sincronização, login e chat
- `src/lib/` — contas (ao cêntimo), semestre, menções, formatação
- `src/components/` — componentes partilhados
- `public/` — ícones, manifesto e service worker da PWA

## Briefing original

Constrói uma app web para quatro estudantes portugueses gerirem as viagens do
semestre de Erasmus em Pisa, de setembro de 2027 a fevereiro de 2028.

Interface em português de Portugal.

O que a app tem de resolver:

- planear e acompanhar cerca de 15 viagens pela Europa ao longo do semestre

- saber, a qualquer momento, quanto cada viagem custa contra o que foi orçamentado

- registar despesas partilhadas e dizer quem deve o quê a quem

- acompanhar a poupança de cada um até uma meta de 3000 € por pessoa,

  a atingir até 1 de setembro de 2027

- ver as viagens no mapa e no calendário do semestre

Datas do semestre que importam: aulas de 15 de setembro a 7 de dezembro,
pausa de 8 de dezembro a 6 de janeiro, exames de 7 de janeiro a 11 de fevereiro.

Uma viagem que caia em cima de aulas ou exames deve notar-se.

Decide tu a estrutura de ecrãs, a navegação e o desenho. Quero uma app
bonita e sóbria, com tema claro e escuro, e que dê gosto abrir todas as semanas.

Restrições técnicas: React + Vite + TypeScript + Tailwind. Dados em localStorage
nesta fase, mas com a camada de dados isolada para eu passar a Supabase depois.

Se puseres mapa, usa Leaflet com OpenStreetMap, que não precisa de chave de API —
não uses Mapbox nem Google Maps.

Semeia com estas viagens (orçamento por pessoa, em euros) e com quatro pessoas
de nome editável. Usa coordenadas fixas das cidades principais no seed.

4-9 set  Nice, Mónaco e Sanremo — 240

10-14 set Sardenha (Cagliari) — 350

19 set   Cinque Terre — 30

28 set-4 out Dolomitas (Ortisei) — 240

10 out   Florença e Siena — 45

14-18 out Nápoles, Pompeia, Amalfi, Positano e Capri — 370

24-27 out Malta — 240

4-8 nov  Bolonha, Modena, Verona, Veneza e San Marino — 260

13-15 nov Roma — 160

20-23 nov Barcelona — 220

28-29 nov Lucca, Pitigliano e Sorano — 90

8-16 dez Viena, Bratislava e Budapeste — 380

17-22 dez Cracóvia — 205

3-6 jan  Milão, Como e Turim — 285

10 jan   Génova e Portofino — 45
