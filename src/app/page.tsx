import DeckSearch from "@/components/DeckSearch";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-20">
          <h1 className="text-4xl font-bold mb-8">ポケカブック</h1>
          <p className="text-gray-600 mb-8">ポケモンカードゲーム デッキ検索・カード採用率サイト</p>
          <div className="flex justify-center gap-4">
            <a 
              href="/decks"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              デッキ検索
            </a>
            <a 
              href="/card-adoption-rate"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              カード採用率
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
