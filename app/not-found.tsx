import Link from "next/link";
import { EmptyState } from "@/components/shared/States";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-10">
      <EmptyState title="Not found" description="That page does not exist, or the demo data was reset." action={<Link className="text-primary underline" href="/dashboard">Go home</Link>} />
    </main>
  );
}
