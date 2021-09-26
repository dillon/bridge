import { signTransactionHash } from 'lib/authToken';
import { Invite } from 'lib/types/Invite';
import { Just, Nothing } from 'folktale/maybe';
import { randomHex } from 'web3-utils';
import {
  attemptNetworkSeedDerivation,
  deriveNetworkKeys,
  CRYPTO_SUITE_VERSION,
} from 'lib/keys';
import { addHexPrefix } from 'lib/utils/address';
import { makeDeterministicTicket, generateWallet } from 'lib/walletgen';

export const SECOND = 1000;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;

export const padZero = (amount: number) =>
  `${amount < 10 && amount > 0 ? '0' : ''}${amount}`;

export const getTimeToNextBatch = (nextBatch: number, now: number) => {
  const toNext = nextBatch - now;
  const hours = Math.floor(toNext / HOUR);
  const minutes = Math.floor((toNext - hours * HOUR) / MINUTE);
  const seconds = Math.floor(
    (toNext - hours * HOUR - minutes * MINUTE) / SECOND
  );

  return `${padZero(hours)}h ${padZero(minutes)}m ${padZero(seconds)}s`;
};

export const isL2 = (dom?: string) => dom === 'l2' || dom === 'spawn';

export const generateInviteWallet = async (point: number, seed: string) => {
  const ticket = makeDeterministicTicket(point, seed);
  const inviteWallet = await generateWallet(point, ticket, true);

  return { ticket, inviteWallet };
};

export const spawn = async (
  api: any,
  _wallet: any,
  _point: number,
  proxy: string,
  nonce: number,
  planet: number
) => {
  const from = {
    ship: _point, //ship that is spawning the planet
    proxy,
  };

  const data = {
    address: _wallet.address,
    ship: planet, // ship to spawn
  };

  const hash = await api.hashTransaction(nonce, from, 'spawn', data);
  const sSig = signTransactionHash(hash, _wallet.privateKey);
  return api.spawn(sSig, from, _wallet.address, data);
};

export const configureKeys = async (
  api: any,
  _wallet: any,
  _point: number,
  proxy: string,
  nonce: number,
  details: any,
  authToken: string,
  authMnemonic: string,
  wallet: any,
  urbitWallet: any
) => {
  const from = {
    ship: _point, //ship to configure keys
    proxy,
  };

  const networkSeed = await attemptNetworkSeedDerivation({
    urbitWallet,
    wallet,
    authMnemonic,
    details,
    point: _point,
    authToken,
    revision: 1,
  });
  // TODO: do something here?
  if (Nothing.hasInstance(networkSeed)) {
    console.log("Network key Error: couldn't derive network keys");
    // throw new Error("Network key Error: couldn't derive network keys");
  }

  const seed = Just.hasInstance(networkSeed)
    ? networkSeed.value
    : randomHex(32);

  const pair = deriveNetworkKeys(seed);

  const data = {
    encrypt: addHexPrefix(pair.crypt.public),
    auth: addHexPrefix(pair.auth.public),
    cryptoSuite: String(CRYPTO_SUITE_VERSION),
    breach: false,
  };

  const hash = await api.hashTransaction(nonce, from, 'configureKeys', data);
  const sig = signTransactionHash(hash, _wallet.privateKey);
  return api.configureKeys(sig, from, _wallet.address, data);
};

export const transferPoint = async (
  api: any,
  _wallet: any,
  _point: number,
  proxy: string,
  nonce: number,
  address: string
) => {
  const from = {
    ship: _point, // ship to transfer
    proxy,
  };

  const data = {
    address,
    reset: false,
  };

  const hash = await api.hashTransaction(nonce, from, 'transferPoint', data);
  const sig = signTransactionHash(hash, _wallet.privateKey);
  return api.transferPoint(sig, from, _wallet.address, data);
};

export const setSpawnProxy = async (
  api: any,
  _wallet: any,
  _point: number,
  proxy: string,
  nonce: number,
  address: string
) => {
  const from = {
    ship: _point,
    proxy,
  };
  const managementData = { address };
  const managementHash = await api.hashTransaction(
    nonce,
    from,
    'setManagementProxy',
    managementData
  );

  return api.setManagementProxy(
    signTransactionHash(managementHash, _wallet.privateKey),
    from,
    _wallet.address,
    managementData
  );
};

export const hasPoint = (point: number) => (invite: Invite) =>
  invite.planet === point;
