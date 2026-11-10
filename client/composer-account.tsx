import { useComposer, type PluginClientContext } from "@getpaseo/plugin/client";
import { Select } from "@getpaseo/plugin/client/ui";
import { formatPercent, peakUsage, shortLabel } from "../shared/format";
import { COMPOSER_ACCOUNT_KEY, type AccountView, type StateView } from "../shared/model";
import { useStore, type ZeroSubStore } from "./store";

const AUTO = "auto";

/**
 * An "Account" control in the composer of a new agent: a draft tab and the New workspace screen.
 * Paseo draws it beside the model picker, in the overflow sheet on a phone, and as a field on the
 * New workspace screen. The choice is stored on the new agent; the daemon reads it when the agent
 * starts. A running agent keeps the account pill, which can also move it and offer a way out of
 * a limit.
 */
export function contributeComposerAccount(client: PluginClientContext, store: ZeroSubStore): () => void {
  return client.addComposerItem({ id: "account", Component: () => <ComposerAccount store={store} /> });
}

function ComposerAccount({ store }: { store: ZeroSubStore }) {
  const composer = useComposer();
  const { state } = useStore(store);
  if (composer.context === "agent" || !state?.showComposerPill) return null;
  const family = composer.agent.provider ? state.providers[composer.agent.provider] : undefined;
  if (!family) return null;
  const accounts = state.accounts.filter(
    (account) => account.family === family && account.status !== "signed_out" && account.status !== "disabled",
  );
  if (accounts.length < 2) return null;

  const picked = composer.agent.metadata[COMPOSER_ACCOUNT_KEY];
  const value = typeof picked === "string" && accounts.some((account) => account.id === picked) ? picked : AUTO;
  const options = [
    { value: AUTO, label: "Auto", description: autoDescription(state, accounts) },
    ...accounts.map((account) => ({ value: account.id, label: shortLabel(account), description: describe(account) })),
  ];

  return (
    <Select
      title="Account"
      icon="CircleUserRound"
      value={value}
      options={options}
      onValueChange={({ value: next }) => composer.setMetadata({ [COMPOSER_ACCOUNT_KEY]: next === AUTO ? null : next })}
    />
  );
}

/** What "Auto" does right now: a one-time pick first, else the daemon's usual choice. */
function autoDescription(state: StateView, accounts: AccountView[]): string {
  const pick = accounts.find((account) => account.nextAgentUntil && Date.parse(account.nextAgentUntil) > Date.now());
  if (pick) return `Next new agent pick: ${pick.label}`;
  const fallback = accounts.find((account) => account.isDefault);
  return fallback ? `ZeroSub decides (default: ${fallback.label})` : "ZeroSub decides";
}

function describe(account: AccountView): string | undefined {
  if (account.status === "limited") return "Limit reached";
  const peak = account.usage ? peakUsage(account.usage.windows) : null;
  const usage = peak ? `${formatPercent(peak.usedPercent)} used` : null;
  const email = account.email && account.email !== account.label ? account.email : null;
  return [email, usage].filter(Boolean).join(" · ") || undefined;
}
