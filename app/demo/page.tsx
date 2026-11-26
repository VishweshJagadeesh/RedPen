import type { Metadata } from "next";
import { DemoClient } from "@/src/demo/DemoClient";

export const metadata: Metadata = {
  title: "Walkthrough",
  description: "A scripted walkthrough of RedPen: grade, diagnose, act and track, with the real product UI.",
};

/** The scripted walkthrough. Public, static, and rendered client-side only (three.js + device frames). */
export default function DemoPage() {
  return <DemoClient />;
}
