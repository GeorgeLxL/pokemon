import { Suspense } from "react";
import DeckSearch from "@/components/DeckSearch";

export default function DecksPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Suspense>
        <DeckSearch />
      </Suspense>
    </main>
  );
}