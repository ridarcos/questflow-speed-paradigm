import { ConfigNotice } from "@/components/ConfigNotice";

const stats = [
  { label: "Misiones", value: "0" },
  { label: "Completadas", value: "0" },
  { label: "XP ganada", value: "0" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
            QuestFlow
          </h1>
          <p className="hidden text-sm text-slate-600 sm:block dark:text-slate-400">
            Misiones personales con XP
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <ConfigNotice />

        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Estadísticas
          </h2>
          <dl className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="quests-heading"
          className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 id="quests-heading" className="text-lg font-semibold">
            Tus misiones
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Aún no hay misiones. Pronto podrás crear, completar, editar y eliminar misiones aquí.
          </p>
        </section>
      </main>
    </div>
  );
}
