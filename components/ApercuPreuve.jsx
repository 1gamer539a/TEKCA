"use client";

import React, { useEffect, useState } from "react";
import { urlSigneePreuve } from "../lib/preuves";

/*
  Affiche un document du bucket privé "preuves" (miniature cliquable ou
  simple lien) en demandant une URL signée à l'ouverture.
  mode "image" → miniature ; mode "lien" → lien texte (children).
*/
export default function ApercuPreuve({ url, mode = "image", alt = "Document", className, style, children }) {
  const [signee, setSignee] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    setSignee(null);
    setErreur(false);
    urlSigneePreuve(url).then((u) => {
      if (annule) return;
      if (u) setSignee(u);
      else setErreur(true);
    });
    return () => {
      annule = true;
    };
  }, [url]);

  if (erreur) return <span className="text-[10px]">Document inaccessible</span>;
  if (!signee) return <span className="text-[10px] opacity-60">Chargement…</span>;

  if (mode === "lien") {
    return (
      <a href={signee} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <a href={signee} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={signee} alt={alt} className={className} style={style} />
    </a>
  );
}
