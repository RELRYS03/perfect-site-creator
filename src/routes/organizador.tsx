import { createFileRoute } from "@tanstack/react-router";
import OrganizerApp from "@/components/organizer/OrganizerApp";
export const Route = createFileRoute("/organizador")({
  head: () => ({
    meta: [
      { title: "Organizador 3D — bandeja para Bambu Lab A1 | ExpressArte" },
      {
        name: "description",
        content: "Crie uma bandeja organizadora com divisórias sob medida e exporte STL para a Bambu Lab A1.",
      },
      { property: "og:title", content: "Organizador 3D — ExpressArte" },
      {
        property: "og:description",
        content: "Bandeja organizadora paramétrica com divisórias, pronta para imprimir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrganizerApp,
});
