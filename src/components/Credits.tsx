"use client";

import { useEffect, useState } from "react";
import { usd } from "@/lib/pricing";

export default function Credits() {
  const [c, setC] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const load = () =>
    fetch("/api/credits")
      .then((r) => r.json())
      .then((j) => (typeof j.credits === "number" ? (setC(j.credits), setErr("")) : setErr(j.error ?? "erreur")))
      .catch(() => setErr("réseau"));
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);
  if (err) return <span title={err} className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-300">Crédits Kie : indisponibles</span>;
  if (c === null) return null;
  return (
    <button onClick={load} title="Solde Kie.AI — cliquer pour rafraîchir" className="rounded-full bg-white/10 px-2.5 py-1 text-xs">
      {c.toLocaleString("fr-FR")} crédits · ≈ {usd(c)}
    </button>
  );
}
