import { Suspense } from "react";
import CreationPIN from "../../../components/CreationPIN";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreationPIN />
    </Suspense>
  );
}
