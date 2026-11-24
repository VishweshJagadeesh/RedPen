import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** AI output is labelled until the teacher accepts it. */
export function AiSuggestedTag({ accepted = false, overridden = false }: { accepted?: boolean; overridden?: boolean }) {
  if (overridden) return <Badge variant="outline">Teacher-marked</Badge>;
  if (accepted) return <Badge variant="secondary">Accepted</Badge>;
  return (
    <Badge variant="ai" title="Suggested by AI. Not final until you accept it.">
      <Sparkles aria-hidden />
      AI-suggested
    </Badge>
  );
}
