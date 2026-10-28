import { Suspense } from "react";
import NousContacter from "../../components/NousContacter";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <NousContacter />
    </Suspense>
  );
}
