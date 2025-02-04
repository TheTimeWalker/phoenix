import { Injectable } from '@angular/core';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/timeout';

import {
  Api,
  Block,
  BlockchainStatus,
  SuggestedFees,
  Peer,
  PeerAddressList,
  BlockList, Address
} from '@signumjs/core';

import { ApiService } from '../api.service';
import { StoreService } from 'app/store/store.service';
import { BehaviorSubject } from 'rxjs';
import { constants } from '../constants';

export interface MiningInfo {
  height: string;
  generationSignature: string;
  baseTarget: string;
  averageCommitmentNQT: string;
  lastBlockReward: string;
  timestamp: string;
}


@Injectable()
export class NetworkService {
  private api: Api;
  private _isMainNet = true;
  public blocks: BehaviorSubject<any> = new BehaviorSubject([]);
  public isMainNet$: BehaviorSubject<boolean> = new BehaviorSubject(true);

  constructor(apiService: ApiService, private storeService: StoreService) {

    this.storeService.settings.subscribe(async (ready) => {
      if (!ready) {
        return;
      }
      this.api = apiService.api;

      const isMainNet = await this.fetchIsMainNet();
      if (this._isMainNet !== isMainNet){
          this.storeService.invalidateAccountTransactions();
      }
      this.isMainNet$.next(isMainNet);
      this._isMainNet = isMainNet;
    });
  }

  public suggestFee(): Promise<SuggestedFees> {
    return this.api.network.getSuggestedFees();
  }

  public getBlockchainStatus(): Promise<BlockchainStatus> {
    return this.api.network.getBlockchainStatus();
  }

  public getBlockById(id?: string): Promise<Block> {
    return this.api.block.getBlockById(id, false);
  }

  public getBlocks(firstIndex?: number, lastIndex?: number, includeTransactions?: boolean): Promise<BlockList> {
    return this.api.block.getBlocks(firstIndex, lastIndex, includeTransactions);
  }

  public getMiningInfo(): Promise<MiningInfo> {
    return this.api.service.query('getMiningInfo');
  }

  public getPeer(address: string): Promise<Peer> {
    return this.api.network.getPeer(address);
  }

  public getPeers(): Promise<PeerAddressList> {
    return this.api.network.getPeers();
  }

  public setBlocks(blocks: Block[]): void {
    this.blocks.next(blocks);
  }

  public addBlock(block: Block): void {
    this.setBlocks([block].concat(this.blocks.value));
  }

  private async fetchIsMainNet(): Promise<boolean> {
    try {
      const { networkName } = await this.api.service.query('getConstants');
      return networkName === constants.mainnetNetworkName;
    } catch (e) {
      return false;
    }
  }

  public getBurnAddress(): Address {
    const prefix = this.isMainNet() ? 'S' : 'TS';
    return Address.fromReedSolomonAddress(`${prefix}-2222-2222-2222-22222`);
  }

  public isMainNet(): boolean {
    return this._isMainNet;
  }

  public getChainExplorerHost(): string {
    return this._isMainNet ? constants.explorerHost.main : constants.explorerHost.test;
  }


  public getIpfsCidUrl(cid: string): string {
    return `${constants.ipfsGateway}/${cid}`;
  }
}
