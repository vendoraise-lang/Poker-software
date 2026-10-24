import Link from "next/link";

export default function WorkspaceLinks({ current }: { current?: string }) {
  const groups = [
    { label: "Play", href: "/?workspace=Practice", selected: current === "Play" || current === "Practice" },
    { label: "Train", href: "/?workspace=Train", selected: current === "Train" || current === "Academy" || current === "Learn" },
    { label: "Analyze", href: "/review", selected: current === "Review" || current === "Equity" },
    { label: "Progress", href: "/?workspace=Dashboard", selected: current === "Dashboard" },
  ];
  return (
    <nav className="workspace-links workspace-simplified" aria-label="Main navigation">
      <div className="workspace-primary">
        {groups.map(({ label, href, selected }) => (
          <Link key={label} href={href} aria-current={selected ? "page" : undefined}>{label}</Link>
        ))}
      </div>
      <details className="workspace-more">
        <summary>More tools</summary>
        <div className="workspace-extra">
          <Link href="/academy">Academy</Link>
          <Link href="/?workspace=Equity">Equity calculator</Link>
          <Link href="/review">Hand review</Link>
          <Link href="/?workspace=Learn">Quick lessons</Link>
        </div>
      </details>
    </nav>
  );
}
