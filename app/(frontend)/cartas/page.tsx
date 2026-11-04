import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LettersBlock } from "@/components/letters-block";
import { contentSource } from "@/lib/content-source";
import { getLetters } from "@/lib/letters";

export const metadata: Metadata = { title: "Cartas de los lectores", description: "Cartas de los lectores de Planta 14.", alternates: { canonical: "/cartas" } };

export default async function CartasPage() {
  if (contentSource() !== "payload") notFound();
  return <div className="container-p14 max-w-[760px] py-8"><LettersBlock letters={await getLetters()} heading="h1" /></div>;
}
