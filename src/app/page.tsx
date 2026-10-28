import Link from "next/link";
import { BriefForm } from "@/client/components/BriefForm";
import { getBrief, listFeaturedIds } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let featured: { id: string; headline: string; destination: string }[] = [];
  try {
    const ids = await listFeaturedIds();
    for (const id of ids.slice(0, 4)) {
      const brief = await getBrief(id);
      if (brief) {
        featured.push({
          id: brief.id,
          headline: brief.copy.headline,
          destination: brief.input.destination,
        });
      }
    }
  } catch {
    featured = [];
  }

  return (
    <main>
      <BriefForm />
      {featured.length > 0 && (
        <section className="mx-auto max-w-lg space-y-3 px-4 pb-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Featured briefs
          </h2>
          <ul className="space-y-2">
            {featured.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/brief/${f.id}`}
                  className="block rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm hover:border-zinc-400"
                >
                  <span className="font-medium text-zinc-900">{f.headline}</span>
                  <span className="mt-1 block text-zinc-500">{f.destination}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="mx-auto max-w-lg px-4 pb-10 text-xs text-zinc-500">
        Powered by Qloo Taste AI. Continuity scores are Carry&apos;s metric, not
        Qloo&apos;s.{" "}
        <a className="underline" href="https://docs.qloo.com">
          API docs
        </a>
      </footer>
    </main>
  );
}
