import { createFileRoute } from "@tanstack/react-router";
import StudioApp from "@/components/studio/StudioApp";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio 3D — ExpressArte" },
      {
        name: "description",
        content:
          "Crie medalhas e adornos 3D com padrões perfurados, encaixes ajustáveis e exportação STL e GLB.",
      },
      { property: "og:title", content: "Studio 3D — ExpressArte" },
      { property: "og:description", content: "Personalize medalhas e adornos 3D para fabricação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StudioApp />,
});
