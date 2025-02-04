import {
  Component,
  Input,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import {
  Transaction,
  isMultiOutSameTransaction,
  isMultiOutTransaction,
  getRecipientsAmount,
  TransactionMiningSubtype,
  TransactionType, TransactionAssetSubtype, TransactionArbitrarySubtype, TransactionPaymentSubtype
} from '@signumjs/core';
import { Amount, ChainTime } from '@signumjs/util';
import { UtilService } from 'app/util.service';
import { takeUntil } from 'rxjs/operators';
import { UnsubscribeOnDestroy } from '../../../util/UnsubscribeOnDestroy';
import { StoreService } from '../../../store/store.service';
import { formatDate } from '@angular/common';
import { WalletAccount } from '../../../util/WalletAccount';


@Component({
  selector: 'app-transaction-table',
  styleUrls: ['./transaction-table.component.scss'],
  templateUrl: './transaction-table.component.html'
})
export class TransactionTableComponent extends UnsubscribeOnDestroy implements AfterViewInit {
  @Input() dataSource: MatTableDataSource<Transaction>;
  @Input() displayedColumns = ['transaction_id', 'timestamp', 'type', 'amount', 'account', 'confirmations'];
  @Input() paginationEnabled = true;
  @Input() account: WalletAccount;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  public locale: string;

  constructor(private utilService: UtilService,
              private storeService: StoreService) {
    super();
    this.storeService.settings
      .pipe(
        takeUntil(this.unsubscribeAll)
      )
      .subscribe(({ language }) => {
        this.locale = language;
      });
  }

  private isTokenHolderDistribution(transaction: Transaction): boolean {
    return transaction.type === TransactionType.Asset && transaction.subtype === TransactionAssetSubtype.AssetDistributeToHolders;
  }

  public isMultiOutPayment(transaction: Transaction): boolean {
    return isMultiOutSameTransaction(transaction) || isMultiOutTransaction(transaction) || this.isTokenHolderDistribution(transaction);
  }

  public ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  public convertTimestamp(timestamp: number): Date {
    return ChainTime.fromChainTimestamp(timestamp).getDate();
  }

  public getTransactionNameFromType(transaction: Transaction): string {
    return this.utilService.translateTransactionSubtype(transaction, this.account);
  }

  public isOwnAccount(accountId: string): boolean {
    return accountId && accountId === this.account.account;
  }

  public getAmount(transaction: Transaction): string {

    if (transaction.type === TransactionType.Arbitrary && transaction.subtype === TransactionArbitrarySubtype.AliasSale){
      return transaction.attachment.priceNQT ? Amount.fromPlanck(transaction.attachment.priceNQT).getSigna() : Amount.Zero().getSigna();
    }

    if (this.isOwnAccount(transaction.sender)) {
      return Amount.fromPlanck(transaction.amountNQT).multiply(-1).getSigna();
    }

    return this.isMultiOutPayment(transaction)
      ? getRecipientsAmount(this.account.account, transaction).toString(10)
      : Amount.fromPlanck(transaction.amountNQT).getSigna();
  }

  public isAmountNegative(transaction: Transaction): boolean {
    const isZero = parseFloat(transaction.amountNQT) === 0;
    return !isZero && this.isOwnAccount(transaction.sender);
  }

  public isCommitment(transaction: Transaction): boolean {
    return transaction.type === TransactionType.Mining && (
      transaction.subtype === TransactionMiningSubtype.AddCommitment ||
      transaction.subtype === TransactionMiningSubtype.RemoveCommitment
    );
  }

  getCommitmentAmount(transaction): string {
    return Amount.fromPlanck(transaction.attachment.amountNQT || '0').getSigna();
  }

  getDate(tx: Transaction): string {
    const time = ChainTime.fromChainTimestamp(tx.timestamp);
    return formatDate(time.getDate(), 'shortDate', this.locale);
  }

  getTime(tx: Transaction): string {
    const time = ChainTime.fromChainTimestamp(tx.timestamp);
    return formatDate(time.getDate(), 'shortTime', this.locale);
  }

  getRowClass(row: Transaction): string {

    const cx = className => row.confirmations === undefined ? `${className} unconfirmed` : className;

    const isNegative = this.isAmountNegative(row);

    if (this.isTokenHolderDistribution(row)) {
      return cx(row.sender === this.account.account ? 'outgoing' : 'incoming');
    }

    if (row.type === TransactionType.Arbitrary && row.subtype === TransactionArbitrarySubtype.AliasSale){
      return cx('incoming');
    }

    if (
      (!row.recipient && (row.type !== TransactionType.Payment)) ||
      (row.recipient === this.account.account && row.sender === this.account.account)
    ) {
      return cx('self');
    }

    if (
      (row.recipient === this.account.account && row.sender !== this.account.account) ||
      (!row.recipient && (row.type === TransactionType.Payment) && !isNegative) // multiout
    ) {
      return cx('incoming');
    }

    return cx('outgoing');
  }

  public chopPrefix(reedSolomonAddress: string): string {
    return reedSolomonAddress
      ? reedSolomonAddress.substr(reedSolomonAddress.indexOf('-') + 1)
      : '';
  }

  isSelf(transaction: Transaction): boolean {
    if (transaction.sender === transaction.recipient) {
      return true;
    }
    if (transaction.type === TransactionType.Arbitrary) {
      return transaction.subtype === TransactionArbitrarySubtype.AccountInfo ||
        transaction.subtype === TransactionArbitrarySubtype.AliasAssignment;
    }
    return transaction.type === TransactionType.Mining;
  }

  public isBurn(transaction: Transaction): boolean {
    return !transaction.recipient && (
      (transaction.type === TransactionType.Asset && transaction.subtype === TransactionAssetSubtype.AssetTransfer) ||
      (transaction.type === TransactionType.Payment && transaction.subtype === TransactionPaymentSubtype.Ordinary)
    );
  }
}
