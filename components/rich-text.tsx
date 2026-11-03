import type { ReactNode } from "react";
import { safeHref, type LexicalNode, type LexicalState } from "@/lib/rich-text";

// Pinta el texto de una noticia con el diseño público. Solo los elementos permitidos en el CMS; el resto se ignora.
// Un párrafo de texto simple sale como <p>texto</p>, igual que antes del texto enriquecido.
const BOLD = 1, ITALIC = 2;

function renderChildren(nodes: LexicalNode[] = []): ReactNode[] { return nodes.map((node, i) => renderNode(node, i)); }
function renderNode(node: LexicalNode, key: number): ReactNode {
  switch (node.type) {
    case "text": {
      const format = Number(node.format) || 0;
      let out: ReactNode = node.text ?? "";
      if (format & ITALIC) out = <em key={`i${key}`}>{out}</em>;
      if (format & BOLD) out = <strong key={`b${key}`}>{out}</strong>;
      return format ? <span key={key}>{out}</span> : out;
    }
    case "linebreak": return <br key={key} />;
    case "paragraph": return (node.children ?? []).length ? <p key={key}>{renderChildren(node.children)}</p> : null;
    case "heading": {
      const content = renderChildren(node.children);
      return node.tag === "h3"
        ? <h3 key={key} className="pt-2 font-sans text-xl font-black leading-7 text-coal-950">{content}</h3>
        : <h2 key={key} className="pt-4 font-sans text-2xl font-black leading-8 text-coal-950">{content}</h2>;
    }
    case "quote": return <blockquote key={key} className="border-l-4 border-copper pl-5 italic text-coal-800">{renderChildren(node.children)}</blockquote>;
    case "list": return node.listType === "number"
      ? <ol key={key} className="list-decimal space-y-2 pl-7">{renderChildren(node.children)}</ol>
      : <ul key={key} className="list-disc space-y-2 pl-7">{renderChildren(node.children)}</ul>;
    case "listitem": return <li key={key}>{renderChildren(node.children)}</li>;
    case "link": case "autolink": {
      const href = safeHref(node.fields?.url ?? node.url);
      if (!href) return <span key={key}>{renderChildren(node.children)}</span>;
      const external = /^https?:/i.test(href) && node.fields?.newTab;
      return <a key={key} href={href} className="text-copper underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{renderChildren(node.children)}</a>;
    }
    default: return node.children ? <span key={key}>{renderChildren(node.children)}</span> : null;
  }
}

export function RichText({ value }: { value: LexicalState }) {
  return <>{renderChildren(value.root.children)}</>;
}
