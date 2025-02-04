import { Account, Address, Alias } from "@signumjs/core";
import { encryptAES, generateMasterKeys, hashSHA256 } from "@signumjs/crypto";
import { some } from "lodash";
import { i18n } from "../../../core/i18n";
import { createAction, createActionFn } from "../../../core/utils/store";
import { auth } from "../translations";
import { actionTypes } from "./actionTypes";
import {
  restoreAccounts,
  getPasscode,
  isBlacklistedAccount,
  resetKeychain,
  savePasscode,
  storeAccounts,
} from "./utils";
import { selectChainApi } from "../../../core/store/app/selectors";

interface UnstoppableDomainResponse {
  addresses: {
    BURST: string;
  };
  meta: {
    owner: string;
    ttl: number;
  };
}

const actions = {
  addAccount: createAction<Account>(actionTypes.addAccount),
  getAccount: createAction<string>(actionTypes.getAccount),
  loadAccounts: createAction<Account[]>(actionTypes.loadAccounts),
  loadAgreeToTerms: createAction<boolean>(actionTypes.loadAgreeToTerms),
  loadPasscode: createAction<string>(actionTypes.loadPasscode),
  loadPasscodeEnteredTime: createAction<number>(
    actionTypes.loadPasscodeEnteredTime
  ),
  removeAccount: createAction<Account>(actionTypes.removeAccount),
  resetAuthState: createAction<void>(actionTypes.resetAuthState),
  setAgreeToTerms: createAction<boolean>(actionTypes.setAgreeToTerms),
  setPasscode: createAction<string>(actionTypes.setPasscode),
  setPasscodeEnteredTime: createAction<number>(
    actionTypes.setPasscodeEnteredTime
  ),
  setPasscodeModalVisible: createAction<boolean>(
    actionTypes.setPasscodeModalVisible
  ),
  updateAccount: createAction<Account>(actionTypes.updateAccount),
};

export const createActiveAccount = createActionFn<string, Account>(
  // @ts-ignore
  async (_dispatch, getState, phrase): Promise<Account> => {
    const pin = getState().auth.passcode;
    const keys = generateMasterKeys(phrase);

    const encryptedKeys = {
      publicKey: keys.publicKey,
      agreementPrivateKey: encryptAES(
        keys.agreementPrivateKey,
        hashSHA256(pin)
      ),
      signPrivateKey: encryptAES(keys.signPrivateKey, hashSHA256(pin)),
    };

    const address = Address.fromPublicKey(keys.publicKey);
    const hasAccount = some(
      getState().auth.accounts,
      (item) => item.account === address.getNumericId()
    );

    if (hasAccount) {
      throw new Error(i18n.t(auth.errors.accountExist));
    }

    const pinHash = hashSHA256(pin + keys.publicKey);
    const account = new Account({
      type: "active",
      account: address.getNumericId(),
      accountRS: address.getReedSolomonAddress(),
      keys: encryptedKeys,
      pinHash,
    });
    if (isBlacklistedAccount(account)) {
      throw new Error("This is a blacklisted account. Creation aborted");
    }
    return account;
  }
);

export const createOfflineAccount = createActionFn<string, Account>(
  (_dispatch, getState, accountRS): Account => {
    let address: Address;
    try {
      address = Address.fromReedSolomonAddress(accountRS);
    } catch (e) {
      throw new Error(i18n.t(auth.errors.incorrectAddress));
    }

    const hasAccount = some(
      getState().auth.accounts,
      (item) => item.account === address.getNumericId()
    );
    if (hasAccount) {
      throw new Error(i18n.t(auth.errors.accountExist));
    }
    const account = new Account({
      type: "offline",
      account: address.getNumericId(),
      accountRS: address.getReedSolomonAddress(),
    });
    if (isBlacklistedAccount(account)) {
      throw new Error("This is a blacklisted account. Creation aborted");
    }
    return account;
  }
);

export const hydrateAccount = createActionFn<
  { account: Account; withTransactions?: boolean },
  Promise<Account>
>(async (dispatch, getState, payload) => {
  const { account, withTransactions = true } = payload;
  const state = getState();
  const api = selectChainApi(state);
  try {
    const accountDetails = await api.account.getAccount({
      accountId: account.account,
      includeCommittedAmount: true,
    });
    console.log("Got account", accountDetails);
    dispatch(actions.updateAccount(accountDetails));
    if (withTransactions) {
      dispatch(updateAccountTransactions(accountDetails));
    }
  } catch (e) {
    console.error("Something failed", e);
  }

  await storeAccounts(state.auth.accounts);
  return account;
});

export const getAccount = createActionFn<string, Promise<Account | undefined>>(
  async (_dispatch, getState, account) => {
    const state = getState();
    const api = selectChainApi(state);
    try {
      return await api.account.getAccount({
        accountId: account,
        includeCommittedAmount: true,
      });
      // tslint:disable-next-line: no-empty
    } catch (e) {}
  }
);

export const getAlias = createActionFn<string, Promise<Alias | undefined>>(
  async (_dispatch, getState, account) => {
    const state = getState();
    const api = selectChainApi(state);
    return api.alias.getAliasByName(account);
  }
);

export const getUnstoppableAddress = createActionFn<
  string,
  Promise<string | null>
>(async (_dispatch, _getState, address) => {
  return fetch(`https://unstoppabledomains.com/api/v1/${address.toLowerCase()}`)
    .then((response) => response.json())
    .then((response: UnstoppableDomainResponse) => {
      return response.addresses.BURST;
    });
});

export const updateAccountTransactions = createActionFn<
  Account,
  Promise<Account>
>(async (dispatch, getState, account) => {
  const state = getState();
  const api = selectChainApi(state);
  const updatedAccount: Account = {
    ...account,
  };
  try {
    console.log("updating transactions...", account.accountRS);
    const { transactions } = await api.account.getAccountTransactions({
      accountId: account.account,
      firstIndex: 0,
      lastIndex: 200,
      includeIndirect: true,
    });
    const { unconfirmedTransactions } =
      await api.account.getUnconfirmedAccountTransactions(
        account.account,
        true
      );
    updatedAccount.transactions = unconfirmedTransactions.concat(transactions);
    dispatch(actions.updateAccount(updatedAccount));
  } catch (e) {}

  return updatedAccount;
});

export const addAccount = createActionFn<Account, Promise<Account>>(
  async (dispatch, getState, account) => {
    dispatch(actions.addAccount(account));
    await storeAccounts(getState().auth.accounts);
    return account;
  }
);

export const removeAccount = createActionFn<Account, Promise<void>>(
  async (dispatch, getState, account) => {
    // tslint:disable-next-line: max-line-length
    // fetch(`https://burstalerts.com/api/v1/unsubscribe/${removeAccountPayload.deviceId}/${removeAccountPayload.account.accountRS}`);
    dispatch(actions.removeAccount(account));
    await storeAccounts(getState().auth.accounts);
    return;
  }
);

export const loadAccounts = createActionFn<void, Promise<void>>(
  async (dispatch, _getState) => {
    let accounts: Account[] = await restoreAccounts();
    accounts = accounts.filter((account) => {
      const isBlacklisted = isBlacklistedAccount(account);
      if (isBlacklisted) {
        // tslint:disable-next-line:no-console
        console.info(
          "Found black listed account - Ignoring: ",
          account.accountRS,
          account.account
        );
      }
      return !isBlacklisted;
    });
    accounts.forEach((account) => hydrateAccount({ account }));
    dispatch(actions.loadAccounts(accounts));
  }
);

export const resetAuthState = createActionFn<void, Promise<void>>(
  async (dispatch, _getState) => {
    resetKeychain();
    dispatch(actions.resetAuthState());
  }
);

export const setPasscode = createActionFn<string, Promise<void>>(
  async (dispatch, _getState, passcode) => {
    dispatch(actions.setPasscode(passcode));
    await savePasscode(passcode);

    // reset the redux store
    dispatch(loadPasscode());
  }
);

export const loadPasscode = createActionFn<void, Promise<void>>(
  async (dispatch, _getState) => {
    const passcode = await getPasscode();
    dispatch(actions.loadPasscode(passcode));
  }
);

export const setPasscodeModalVisible = actions.setPasscodeModalVisible;
