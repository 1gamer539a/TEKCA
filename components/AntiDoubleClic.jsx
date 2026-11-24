"use client";

import { useEffect } from "react";
import { installerAntiDoublonGlobal } from "../lib/fetch-anti-doublon";

// Active, une seule fois, la protection contre le double clic sur les appels /api.
export default function AntiDoubleClic() {
  useEffect(() => {
    installerAntiDoublonGlobal();
  }, []);
  return null;
}
