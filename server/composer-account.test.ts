import { describe, expect, it } from "vitest";
import { chooseAccount } from "./routing";
import { emptyState, type StoredAccount, type StoredState } from "./state";

const NOW = Date.parse("2026-11-10T12:00:00Z");

function account(id: string, family: "claude" | "codex" = "claude", kind: "main" | "managed" = "managed"): StoredAccount {
  return {
    id, family, label: id, autoLabel: false, kind, home: kind === "main" ? null : `/homes/${id}`, email: null, plan: null,
    organization: null, identity: null, signedIn: true, disabled: false, limitedUntil: null, limitKind: null,
    limitedAt: null, createdAt: "2026-09-01T00:00:00Z",
  } as StoredAccount;
}

const main = account("claude-main", "claude", "main");
const work = account("work");
const codex = account("codex-2", "codex");
const base = { agentId: "a1", family: "claude" as const, now: NOW, autoSwitch: true, balanceNewAgents: true, portable: true, usageOf: () => null };
const state = (extra: Partial<StoredState> = {}): StoredState => ({ ...emptyState(), accounts: [main, work, codex], ...extra });

describe("account picked in a new agent's composer", () => {
  it("starts the new agent there, ahead of the next-agent pick and balancing", () => {
    const withPick = state({ nextAgent: { claude: { accountId: "claude-main", until: new Date(NOW + 60_000).toISOString() }, codex: null } });
    const d = chooseAccount(withPick, { ...base, reason: "create", allowNextPick: true, requestedAccountId: "work" });
    expect(d?.account.id).toBe("work");
    expect(d?.bind).toMatchObject({ accountId: "work", source: "user" });
    expect(d?.usedNextPick).toBe(false);
  });

  it("ignores the pick when resuming, for another provider, or for an unknown account", () => {
    expect(chooseAccount(state(), { ...base, balanceNewAgents: false, reason: "resume", requestedAccountId: "work" })?.account.id).toBe("claude-main");
    expect(chooseAccount(state(), { ...base, balanceNewAgents: false, reason: "create", requestedAccountId: "codex-2" })?.account.id).toBe("claude-main");
    expect(chooseAccount(state(), { ...base, balanceNewAgents: false, reason: "create", requestedAccountId: "gone" })?.account.id).toBe("claude-main");
  });

  it("still moves off a picked account that is out of usage", () => {
    const limited = { ...work, limitedUntil: new Date(NOW + 3_600_000).toISOString(), limitKind: "window" } as StoredAccount;
    const d = chooseAccount(state({ accounts: [main, limited, codex] }), { ...base, reason: "create", requestedAccountId: "work" });
    expect(d?.account.id).toBe("claude-main");
    expect(d?.skipped).toMatchObject({ why: "limited" });
  });
});
