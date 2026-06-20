import { Link } from 'react-router-dom'

const cards = [
  {
    to: '/calculator',
    emoji: '📐',
    title: 'Size Calculator',
    desc: 'Turn yarn weight, hook size, and gauge into finished dimensions — or work backwards from the size you want.',
  },
  {
    to: '/designer',
    emoji: '🎨',
    title: 'Grid Designer',
    desc: 'Paint your own color chart on a grid. Fill, undo, palettes, live stitch counts, and PNG/PDF export.',
  },
  {
    to: '/image',
    emoji: '🖼️',
    title: 'Image → Pattern',
    desc: 'Upload a photo, lay an adjustable grid over it with the original colors kept, then follow it row by row.',
  },
]

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 px-6 py-10 text-white shadow-sm">
        <h1 className="text-3xl font-bold sm:text-4xl">Design & visualize crochet patterns</h1>
        <p className="mt-3 max-w-2xl text-rose-50">
          A little studio for flat color work: size your project, draw a chart from
          scratch, or turn a photo into a pixel pattern you can crochet stitch by stitch.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
          >
            <div className="text-3xl">{c.emoji}</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-800 group-hover:text-rose-600">
              {c.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-800">New to gauge?</h3>
        <p className="mt-1">
          Gauge is how many stitches and rows fit in 4 inches (10 cm) of your fabric. It
          depends on your yarn, hook, and tension — so the most accurate results come from
          crocheting a small swatch and measuring it. Every tool here lets you enter your
          own measured gauge, or estimate from a standard yarn weight.
        </p>
      </section>
    </div>
  )
}
