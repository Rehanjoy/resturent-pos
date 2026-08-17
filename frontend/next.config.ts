import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't auto-generate AGENTS.md/CLAUDE.md on every `next dev` run — this
  // is a plain handover codebase, not tool-specific scaffolding.
  agentRules: false,
};

export default nextConfig;
