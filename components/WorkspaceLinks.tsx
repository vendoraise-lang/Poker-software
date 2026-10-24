import Link from "next/link";
export default function WorkspaceLinks({ current }: { current?: string }) {
  return (
    <nav className="workspace-links" aria-label="PokerLab workspaces">
      {[
        ["Play", "/?workspace=Practice"],
        ["Train", "/?workspace=Train"],
        ["Equity", "/?workspace=Equity"],
        ["Review", "/review"],
        ["Academy", "/academy"],
        ["Dashboard", "/?workspace=Dashboard"],
      ].map(([label, href]) => (
        <Link
          key={label}
          href={href}
          aria-label={`${label} workspace`}
          aria-current={current === label ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
