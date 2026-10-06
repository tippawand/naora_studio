/** Logotype texte : « Maison Art Stellaire » (police de marque) + « Studio » (sans-serif). */
export default function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2" style={{ color: "var(--brand)" }}>
      <span className={`font-brand tracking-[0.04em] ${lg ? "text-3xl" : "text-lg"}`}>Maison Art Stellaire</span>
      <span className={`font-light uppercase tracking-[0.25em] opacity-80 ${lg ? "text-sm" : "text-[11px]"}`}>Studio</span>
    </span>
  );
}
