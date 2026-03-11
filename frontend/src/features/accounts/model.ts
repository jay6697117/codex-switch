import type { AccountsSnapshot } from "../../lib/contracts";

export interface AccountsView {
  activeAccount: AccountsSnapshot["accounts"][number] | null;
  otherAccounts: AccountsSnapshot["accounts"];
  allMasked: boolean;
  maskedAccountIds: Set<string>;
  isMasked: (accountId: string) => boolean;
}

export function deriveAccountsView(
  snapshot: AccountsSnapshot,
  maskedAccountIds = new Set<string>(),
  allMasked = false,
): AccountsView {
  const activeAccount =
    snapshot.accounts.find((account) => account.id === snapshot.activeAccountId) ?? null;
  const otherAccounts = snapshot.accounts.filter(
    (account) => account.id !== snapshot.activeAccountId,
  );

  return {
    activeAccount,
    otherAccounts,
    allMasked,
    maskedAccountIds,
    isMasked: (accountId: string) => allMasked || maskedAccountIds.has(accountId),
  };
}

export function toggleMaskedAccount(
  maskedAccountIds: Set<string>,
  accountId: string,
): Set<string> {
  const next = new Set(maskedAccountIds);

  if (next.has(accountId)) {
    next.delete(accountId);
    return next;
  }

  next.add(accountId);
  return next;
}
