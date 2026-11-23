import { Suspense } from "react";
import PanierCheckout from "../../components/PanierCheckout";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PanierCheckout />
    </Suspense>
  );
}
