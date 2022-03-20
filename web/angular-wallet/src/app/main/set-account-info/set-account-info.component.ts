import { Component, OnInit, ViewChild } from '@angular/core';
import { Account, TransactionType, TransactionArbitrarySubtype } from '@signumjs/core';
import { Amount } from '@signumjs/util';
import { NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AccountService } from 'app/setup/account/account.service';
import { StoreService } from 'app/store/store.service';
import { NotifierService } from 'angular-notifier';
import { I18nService } from 'app/layout/components/i18n/i18n.service';
import { AddressPattern } from 'app/util/addressPattern';
import { isKeyDecryptionError } from '../../util/exceptions/isKeyDecryptionError';

@Component({
  selector: 'app-set-account-info',
  templateUrl: './set-account-info.component.html',
  styleUrls: ['./set-account-info.component.scss']
})
export class SetAccountInfoComponent implements OnInit {
  @ViewChild('setAccountInfoForm', { static: false }) public setAccountInfoForm: NgForm;
  @ViewChild('name', { static: false }) public name: string;
  @ViewChild('description', { static: false }) public description : string;

  showMessage = false;
  isSending = false;
  immutable = false;
  burstAddressPatternRef = AddressPattern;
  deadline = '24';
  pin = '';
  fee: string;

  account: Account;
  txType = TransactionType.Arbitrary;
  txSubtype = TransactionArbitrarySubtype.AccountInfo;

  constructor(private route: ActivatedRoute,
              private accountService: AccountService,
              private storeService: StoreService,
              private notifierService: NotifierService,
              private i18nService: I18nService) {
  }

  ngOnInit(): void {
    this.account = this.route.snapshot.data.account as Account;
    this.immutable = this.account.type === 'offline';
    setTimeout(() => {
      this.name = this.account.name || '';
      this.description = this.account.description || '';
    }, 0);
  }

  async onSubmit(event): Promise<void> {
    event.stopImmediatePropagation();
    this.isSending = true;
    try {
      await this.accountService.setAccountInfo({
        name: this.name,
        description: this.description,
        feePlanck: Amount.fromSigna(this.fee).getPlanck(),
        deadline: parseFloat(this.deadline) * 60,
        pin: this.pin,
        keys: this.account.keys
      });
      this.notifierService.notify('success', this.i18nService.getTranslation('success_set_account_info'));
      this.setPin('');
    } catch (e) {
      if (isKeyDecryptionError(e)) {
        this.notifierService.notify('error', this.i18nService.getTranslation('wrong_pin'));
      } else {
        this.notifierService.notify('error', this.i18nService.getTranslation('error_unknown'));
      }
    } finally {
      this.isSending = false;
    }
  }


  canSubmit(): boolean {
    return this.pin.length > 0;
  }

  setPin(pin: string): void {
    this.pin = pin;
  }

  getPayloadLength(): number {
    return (this.name ? this.name.length : 0) +
      (this.description ? this.description.length : 0) + 32;
  }
}
