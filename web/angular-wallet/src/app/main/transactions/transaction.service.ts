import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {
  TransactionApi,
  TransactionId,
  AttachmentEncryptedMessage,
  AttachmentMessage,
  Attachment,
  MultioutRecipientAmount, Transaction
} from '@signumjs/core';
import {Keys, encryptMessage, encryptData, EncryptedMessage, EncryptedData} from '@signumjs/crypto';
import {ApiService} from '../../api.service';
import {AccountService} from 'app/setup/account/account.service';
import {convertHexStringToByteArray} from '@signumjs/util';
import {StoreService} from 'app/store/store.service';
import {Settings} from 'app/settings';
import {getPrivateSigningKey} from '../../util/security/getPrivateSigningKey';
import {getPrivateEncryptionKey} from '../../util/security/getPrivateEncryptionKey';

interface SendSignaMultipleSameRequest {
  amountNQT: string;
  fee: string;
  deadline?: number;
  keys: Keys;
  pin: string;
  recipientIds: string[];
}

interface SendSignaMultipleRequest {
  fee: string;
  deadline?: number;
  recipientAmounts: MultioutRecipientAmount[];
  pin: string;
  keys: Keys;
}

interface SendSignaRequest {
  amount: string;
  deadline?: number;
  fee: string;
  keys: Keys;
  message?: string;
  pin: string;
  recipientId: string;
  recipientPublicKey: string;
  messageIsText: boolean;
  shouldEncryptMessage?: boolean;
}

interface SetAliasOnSaleRequest {
  price: string;
  fee: string;
  keys: Keys;
  message?: string;
  pin: string;
  recipientId: string;
  recipientPublicKey: string;
  messageIsText: boolean;
  shouldEncryptMessage?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private transactionApi: TransactionApi;

  public currentAccount: BehaviorSubject<any> = new BehaviorSubject(undefined);

  constructor(apiService: ApiService, private accountService: AccountService, private storeService: StoreService) {
    this.transactionApi = apiService.api.transaction;
    this.storeService.settings.subscribe((settings: Settings) => {
      this.transactionApi = apiService.api.transaction;
    });
  }

  public getTransaction(id: string): Promise<Transaction> {
    return this.transactionApi.getTransaction(id);
  }

  public sendAmountToMultipleRecipients(request: SendSignaMultipleRequest): Promise<TransactionId> {
    const {fee, keys, pin, recipientAmounts} = request;
    return this.transactionApi.sendAmountToMultipleRecipients({
      senderPublicKey: keys.publicKey,
      senderPrivateKey: getPrivateSigningKey(pin, keys),
      recipientAmounts,
      feePlanck: fee
    }) as Promise<TransactionId>;
  }

  public sendSameAmountToMultipleRecipients(request: SendSignaMultipleSameRequest): Promise<TransactionId> {
    const {amountNQT, fee, keys, pin, recipientIds} = request;
    return this.transactionApi.sendSameAmountToMultipleRecipients({
      amountPlanck: amountNQT,
      feePlanck: fee,
      recipientIds,
      senderPrivateKey: getPrivateSigningKey(pin, keys),
      senderPublicKey: keys.publicKey
    }) as Promise<TransactionId>;
  }

  public async sendAmount(request: SendSignaRequest): Promise<TransactionId> {

    const {pin, amount, fee, recipientId, message, messageIsText, shouldEncryptMessage, keys, recipientPublicKey} = request;

    let attachment: Attachment;
    if (message && shouldEncryptMessage) {
      const recipient = await this.accountService.getAccount(recipientId);
      const agreementPrivateKey = getPrivateEncryptionKey(pin, keys);
      let encryptedMessage: EncryptedMessage | EncryptedData;
      if (messageIsText) {
        encryptedMessage = encryptMessage(
          message,
          // @ts-ignore
          recipient.publicKey,
          agreementPrivateKey
        );
      } else {
        encryptedMessage = encryptData(
          new Uint8Array(convertHexStringToByteArray(message)),
          // @ts-ignore
          recipient.publicKey,
          agreementPrivateKey
        );
      }

      attachment = new AttachmentEncryptedMessage(encryptedMessage);
    } else if (message) {
      attachment = new AttachmentMessage({message, messageIsText});
    }

    // @ts-ignore
    return this.transactionApi.sendAmountToSingleRecipient({
      amountPlanck: amount,
      feePlanck: fee,
      recipientId,
      // FIXME: this is only temporary
      // recipientPublicKey,
      senderPrivateKey: getPrivateSigningKey(pin, keys),
      senderPublicKey: keys.publicKey,
      attachment
    });

  }
}
