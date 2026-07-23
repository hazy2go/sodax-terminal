import { ConnectButton } from "@/components/shell/ConnectButton";

export default function Home() {
  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "var(--font-geist-mono)", fontSize: 18 }}>SODAX TERMINAL</h1>
        <ConnectButton />
      </header>
      <p style={{ opacity: 0.6 }}>Phase 2 — wallet connectivity online. Shell + tabs coming next.</p>
    </main>
  );
}
