"use client";

import React, { useState } from "react";

/*
  Photo d'un produit, partout pareil : chargement différé, remplie (object-cover), et si l'image
  manque ou ne se charge pas, un bloc neutre à la place (jamais d'icône « image cassée »).
*/
export default function PhotoProduit({ src, alt = "", className = "", style = {}, fond = "#0A1220" }) {
  const [erreur, setErreur] = useState(false);
  if (!src || erreur) return <div className={className} style={{ background: fond, ...style }} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setErreur(true)}
      className={`${className} object-cover`}
      style={{ background: fond, ...style }}
    />
  );
}
