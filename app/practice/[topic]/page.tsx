import WorkspaceLinks from "@/components/WorkspaceLinks";
import Link from "next/link";
import TrainingHub from "@/components/TrainingHub";
import { REVIEW_TOPICS } from "@/lib/review/model";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  if (!Object.hasOwn(REVIEW_TOPICS, topic)) notFound();
  return (
    <div className="review-page">
      <header className="studio-header">
        <Link className="brand" href="/">
          ♧ <span>PokerLab</span>
        </Link>
        <nav>
          <Link href="/review">Review Studio</Link>
          <Link href="/">Practice room</Link>
        </nav>
      </header>
      <main className="studio-main" id="main-content" tabIndex={-1}>
        <WorkspaceLinks current="Train" />
        <h1>{REVIEW_TOPICS[topic as keyof typeof REVIEW_TOPICS]} practice</h1>
        <TrainingHub initialPractice={topic} />
      </main>
    </div>
  );
}
