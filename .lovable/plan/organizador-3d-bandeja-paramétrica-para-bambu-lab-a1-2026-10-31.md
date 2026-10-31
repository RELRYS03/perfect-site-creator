# Organizador 3D — bandeja paramétrica para Bambu Lab A1

## Objetivo
Nova página "Organizador 3D" (rota `/organizador`) para gerar uma bandeja com divisórias que encaixa na metade vazia da caixa. O editor de medalhas, as outras páginas, `buildModel` e as exportações atuais ficam como estão.

## Premissa (corrija se estiver errada)
A medida interna 275 × 200 × 40 mm é a da **metade vazia**. A bandeja é feita só para essa metade, e nada é gerado para a outra metade, que já está organizada.

## Valores padrão
- Espaço interno da metade: 275 × 200 × 40 mm (editável)
- Folga por lado: 2 mm, ajustável de 0 a 5 mm. Tamanho externo da bandeja = 271 × 196 mm
- Altura externa: 37 mm, ajustável de 10 mm até (profundidade − 3 mm). Sobram 3 mm para a tampa fechar sem encostar
- Parede externa 2 mm, base 2 mm, divisórias 1,6 mm (todas editáveis, mínimo 1,2 mm)
- Divisórias: grade de N colunas × M linhas (padrão 3 × 2), com altura própria (padrão = altura da bandeja) e cantos internos opcionalmente arredondados
- Mesa da A1: 256 × 256 × 256 mm. **Atenção: 271 mm de comprimento não cabe na mesa.** O plano é mostrar um aviso claro e oferecer duas saídas: (a) dividir a bandeja em 2 peças pelo comprimento, exportando um STL por peça, ou (b) imprimir na diagonal, que aceita até ~362 mm se a largura for pequena. O mais confiável é a divisão em 2 peças, que será o padrão quando a bandeja não couber.

## Interface
- Item "Organizador 3D" no menu principal
- Painel com campos: espaço interno, folga, altura, espessuras, colunas/linhas de divisórias, altura das divisórias e divisão em peças
- Visualização 3D com a mesma cena (giro, zoom, vista de cima), a caixa vazia mostrada em linhas transparentes e a bandeja dentro dela
- Resumo: medidas externas, volume interno de cada compartimento, filamento estimado (g) e avisos (não cabe na mesa, parede fina, altura demais)
- Botão "Exportar STL" (um arquivo, ou um por peça se dividida)

## Exportação 3MF
A versão instalada do Three.js (0.186.1) **não tem 3MFExporter**: só DRACO, EXR, GLTF, KTX2, OBJ, PLY, STL e USDZ. O plano não inclui 3MF. O Bambu Studio abre STL normalmente. Um 3MF próprio (zip + XML) daria para fazer depois, mas fica fora deste plano.

## Detalhes técnicos
Arquivos novos:
- `src/lib/organizer/organizer.ts`: TypeScript puro, sem React. Tipo `OrganizerConfig`, `defaultOrganizerConfig`, `validateOrganizer(cfg)` (corrige valores e gera avisos), `organizerLayout(cfg)` (caixas em mm: base, 4 paredes, divisórias e compartimentos) e `splitParts(cfg)`
- `src/lib/organizer/buildOrganizer.ts`: transforma o layout em `THREE.Group` com `BoxGeometry`. As peças se sobrepõem 0,01 mm para o fatiador fundir as partes (sem operação booleana). Eixo Z para cima, origem no canto, unidades em mm
- `src/components/organizer/OrganizerApp.tsx`: página e painel
- `src/routes/organizador.tsx`: rota com `head()` próprio
- `src/test/organizer.test.ts`

Arquivos alterados (só acréscimos):
- `StudioProvider.tsx`: estado `organizer` separado, sem tocar em `config`
- `ModelScene.tsx`: prop opcional `buildObject?: () => THREE.Object3D`. Sem ela, continua usando `buildModel(config)` como hoje. A rotação da medalha só é aplicada no modo medalha
- `StudioApp.tsx`: só uma entrada a mais no array `nav`
- `styles.css`: poucas classes novas, usando os tokens que já existem
- `AGENTS.md`: regra sobre manter a geometria do organizador em TS puro, separada da medalha

Testes (vitest):
1. Limites: externo = interno − 2 × folga, altura ≤ profundidade − 3, espessuras mínimas são respeitadas e entradas inválidas são corrigidas
2. Divisórias ligadas à base: cada divisória começa em z = base, encosta nas paredes ou em outra divisória e tem altura > base
3. Envelope: a caixa delimitadora (bounding box) de todos os objetos fica dentro do espaço interno menos a folga, inclusive com valores extremos
4. Compartimentos: soma das larguras + divisórias + paredes = medida externa, sem largura ≤ 0
5. Mesa A1: 271 mm gera aviso de "não cabe", e cada peça dividida fica ≤ 256 mm
6. Exportação: o STL binário tem 84 + 50 × triângulos bytes, número de triângulos > 0, e a caixa delimitadora relida pelo STLLoader bate com as medidas
7. Rotas: `/organizador` existe e as rotas atuais (`/`, `/formas` etc.) continuam funcionando
8. Teste manual com Playwright: a página renderiza, os controles mudam o modelo, o STL baixa e o Studio de medalhas segue igual

## Riscos
- O comprimento passa da mesa da A1. Isso está tratado com o aviso e a divisão em peças, que precisam de uma junta de encaixe simples ou de alinhamento lado a lado na caixa
- Caixas sobrepostas não formam uma malha única. Bambu e Orca fundem sem problema, mas outros programas podem acusar "não-manifold". O Mesh Doctor atual pode mostrar isso
- A folga real depende do filamento e da calibração. Ela fica ajustável e a recomendação é imprimir um teste de canto antes
- O sandbox não tem GPU, então a aparência fica validada só por captura de tela

## Fora do escopo
Publicar, mexer no catálogo, mexer em outros repositórios, 3MF, mudanças no editor de medalhas.
