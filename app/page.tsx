import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-xl">
        <h1 className="text-5xl font-bold text-orange-600 mb-4">OrderKing</h1>
        <p className="text-xl text-gray-600 mb-2">
          Free QR code ordering for your restaurant
        </p>
        <p className="text-gray-400 mb-8">No app needed. Set up in minutes.</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold text-lg hover:bg-orange-600 transition"
          >
            Get Started Free
          </Link>
          <Link
            href="/auth/login"
            className="border-2 border-orange-500 text-orange-500 px-8 py-3 rounded-xl font-semibold text-lg hover:bg-orange-50 transition"
          >
            Login
          </Link>
        </div>
        <p className="mt-6 text-gray-400 text-sm">No credit card required</p>
      </div>
    </main>
  )
}
