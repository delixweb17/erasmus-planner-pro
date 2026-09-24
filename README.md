# Erasmus Planner Pro

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

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/41b184e6-f8bf-4a47-a091-d81a9a654d35).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
