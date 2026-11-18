import { createFileRoute } from "@tanstack/react-router";
import OrnamentWorkbench from "@/components/studio/OrnamentWorkbench";

export const Route = createFileRoute("/adornos")({
  head: () => ({
    meta: [
      { title: "Adornos de prensagem — ExpressArte" },
      {
        name: "description",
        content: "Modele malhas decorativas, moldes macho e fêmea e adornos de duas metades para impressão 3D.",
      },
    ],
  }),
  component: OrnamentWorkbench,
});
