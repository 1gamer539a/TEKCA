import { Suspense } from "react";
import LeMarche from "../../components/LeMarche";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LeMarche />
    </Suspense>
  );
}
