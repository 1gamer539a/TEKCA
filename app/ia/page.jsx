"use client";
import IAAssistant from "../../components/IAAssistant";
export default function Page() {
  return <IAAssistant onFermer={() => window.history.back()} />;
}
