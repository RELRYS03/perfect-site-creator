import { createFileRoute } from "@tanstack/react-router";
import StudioApp from "@/components/studio/StudioApp";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio 3D — ExpressArte" },
      {
        name: "description",
        content:
          "Personalize medalhas 3D com texto em relevo, formas e acabamentos e exporte STL e GLB.",
      },
      { property: "og:title", content: "Studio 3D — ExpressArte" },
      { property: "og:description", content: "Transforme ideias em medalhas 3D personalizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <StudioApp />,
});
