import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, LineChart, PencilRuler, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MockModeBadge } from "@/components/shared/MockModeBadge";
import { aiMode } from "@/lib/ai/mode";
import { currentTeacherId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Landing({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const params = await searchParams;
  const signedIn = await currentTeacherId();
  if (signedIn && !params.reset) redirect(params.next ?? "/dashboard");
  const steps = [
    { icon: PencilRuler, title: "Grade", text: "Upload photos of answer sheets. RedPen grades each answer step by step, with a confidence score. You review and decide." },
    { icon: LineChart, title: "Diagnose", text: "Every reviewed answer becomes a concept-level data point: class heatmaps, weak concepts and alerts that explain themselves." },
    { icon: BookOpenCheck, title: "Act", text: "Plan a reteach from your class's actual mistakes, or send targeted remedial sheets to the students who need them." },
    { icon: Repeat, title: "Track", text: "Exit tickets and remedial work come back through the same grading flow, so you see whether it worked." },
  ];
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12 sm:py-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary font-bold text-primary-foreground">R</span>
            RedPen
          </div>
          <MockModeBadge mode={aiMode()} />
        </div>
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Grading already is the data entry.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            RedPen grades handwritten tests with you, then turns every reviewed answer into a picture of what each student — and the whole
            class — is struggling with. Walk into the next class, and the next parent meeting, with specifics.
          </p>
          <form action="/api/session" method="post" className="mt-8 flex flex-wrap items-center gap-3">
            <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
            <Button size="lg" type="submit" data-demo-id="continue-demo-teacher">
              Continue as demo teacher
              <ArrowRight />
            </Button>
            <span className="text-sm text-muted-foreground">Signs in as Anjali Verma · Mathematics · 8A, 8B, 9A</span>
          </form>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-5">
              <s.icon className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </section>
        <p className="text-xs text-muted-foreground">
          No grade is final until the teacher accepts it. Student names in this demo are fictional; no student photos are stored.
        </p>
      </div>
    </main>
  );
}
