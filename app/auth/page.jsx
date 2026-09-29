import { Suspense } from "react";
import AuthCompte from "../../components/AuthCompte";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthCompte />
    </Suspense>
  );
}
