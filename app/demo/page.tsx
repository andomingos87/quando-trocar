import type { Metadata } from "next";
import { DemoShell } from "@/components/demo/demo-shell";

export const metadata: Metadata = {
  title: "Demo comercial",
  description:
    "Demo guiada do Quando Trocar: cadastro, lembrete no WhatsApp e retorno em receita.",
};

export default function DemoPage() {
  return <DemoShell />;
}
