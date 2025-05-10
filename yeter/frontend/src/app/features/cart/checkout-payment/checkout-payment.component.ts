import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-checkout-payment',
  templateUrl: './checkout-payment.component.html',
  styleUrls: ['./checkout-payment.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink]
})
export class CheckoutPaymentComponent implements OnInit {
  selectedPaymentMethod: string = 'CREDIT_CARD';
  paymentMethods: string[] = [];
  loading = false;
  error: string | null = null;

  // Kredi kartı formu
  cardForm: FormGroup;

  constructor(
    private orderService: OrderService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.cardForm = this.fb.group({
      cardNumber: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
      cardHolderName: ['', [Validators.required]],
      expiryMonth: ['', [Validators.required, Validators.min(1), Validators.max(12)]],
      expiryYear: ['', [Validators.required, Validators.min(new Date().getFullYear()), Validators.max(new Date().getFullYear() + 10)]],
      cvc: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
    });
  }

  ngOnInit(): void {
    // Adres seçimi yapılmış mı kontrol et
    const shippingAddressId = sessionStorage.getItem('shippingAddressId');
    if (!shippingAddressId) {
      this.router.navigate(['/checkout/address']);
      return;
    }

    // Ödeme yöntemlerini al
    this.paymentMethods = this.orderService.getPaymentMethods();
  }

  selectPaymentMethod(method: string): void {
    this.selectedPaymentMethod = method;
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'CREDIT_CARD':
        return 'Kredi Kartı';
      case 'CASH_ON_DELIVERY':
        return 'Kapıda Ödeme';
      case 'BANK_TRANSFER':
        return 'Banka Transferi';
      default:
        return method;
    }
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'CREDIT_CARD':
        return 'fa-credit-card';
      case 'CASH_ON_DELIVERY':
        return 'fa-money-bill';
      case 'BANK_TRANSFER':
        return 'fa-university';
      default:
        return 'fa-credit-card';
    }
  }

  validateCardForm(): boolean {
    if (this.selectedPaymentMethod !== 'CREDIT_CARD') {
      return true;
    }

    if (this.cardForm.invalid) {
      Object.keys(this.cardForm.controls).forEach(key => {
        const control = this.cardForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return false;
    }

    return true;
  }

  getCardErrorMessage(controlName: string): string {
    const control = this.cardForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return 'Bu alan gereklidir';
    }

    switch (controlName) {
      case 'cardNumber':
        return 'Geçerli bir kart numarası giriniz (16 haneli)';
      case 'expiryMonth':
        return 'Geçerli bir ay giriniz (1-12)';
      case 'expiryYear':
        return 'Geçerli bir yıl giriniz';
      case 'cvc':
        return 'Geçerli bir CVC kodu giriniz (3-4 haneli)';
      default:
        return 'Geçersiz değer';
    }
  }

  confirmPayment(): void {
    if (this.selectedPaymentMethod === 'CREDIT_CARD' && this.cardForm) {
      if (this.cardForm.invalid) {
        this.error = 'Lütfen kart bilgilerini doğru formatta giriniz';
        return;
      }

      // Kart bilgilerini kaydet
      const cardData = {
        cardNumber: this.cardForm.get('cardNumber')?.value,
        cardHolderName: this.cardForm.get('cardHolderName')?.value,
        expiryMonth: this.cardForm.get('expiryMonth')?.value,
        expiryYear: this.cardForm.get('expiryYear')?.value,
        cvv: this.cardForm.get('cvc')?.value
      };

      sessionStorage.setItem('cardData', JSON.stringify(cardData));
    }

    // Ödeme yöntemini kaydet ve onay sayfasına yönlendir
    sessionStorage.setItem('paymentMethod', this.selectedPaymentMethod);
    this.router.navigate(['/checkout/confirm']);
  }

  proceedToConfirmation(): void {
    this.confirmPayment();
  }
}
