import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { OrderService, OrderRequest } from '../../../services/order.service';
import { AddressService, Address } from '../../../services/address.service';
import { CartItem } from '../../../models/cart-item.model';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Component({
  selector: 'app-checkout-confirmation',
  templateUrl: './checkout-confirmation.component.html',
  styleUrls: ['./checkout-confirmation.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink]
})
export class CheckoutConfirmationComponent implements OnInit {
  cartItems: CartItem[] = [];
  shippingAddress: Address | null = null;
  billingAddress: Address | null = null;
  paymentMethod: string = '';
  cardData: any = null;

  totalPrice: number = 0;
  shippingPrice: number = 0;

  loading = true;
  orderLoading = false;
  error: string | null = null;

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private addressService: AddressService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Adres ve ödeme bilgilerinin session storage'da olup olmadığını kontrol et
    const shippingAddressId = sessionStorage.getItem('shippingAddressId');
    const billingAddressId = sessionStorage.getItem('billingAddressId');
    const paymentMethod = sessionStorage.getItem('paymentMethod');

    if (!shippingAddressId || !paymentMethod) {
      // Eğer adres veya ödeme bilgileri yoksa uygun sayfaya yönlendir
      if (!shippingAddressId) {
        this.router.navigate(['/checkout/address']);
      } else {
        this.router.navigate(['/checkout/payment']);
      }
      return;
    }

    this.paymentMethod = paymentMethod;

    // Kart bilgilerini al (kredi kartı seçildiyse)
    if (this.paymentMethod === 'CREDIT_CARD') {
      const cardDataStr = sessionStorage.getItem('cardData');
      if (cardDataStr) {
        this.cardData = JSON.parse(cardDataStr);
      } else {
        // Kart bilgileri yoksa ödeme sayfasına geri yönlendir
        this.router.navigate(['/checkout/payment']);
        return;
      }
    }

    // Adresleri ve sepet içeriğini yükle
    const getShippingAddress$ = this.addressService.getAddressById(Number(shippingAddressId))
      .pipe(
        tap(address => this.shippingAddress = address),
        catchError(err => {
          this.error = 'Teslimat adresi bilgileri yüklenemedi';
          return of(null);
        })
      );

    let getBillingAddress$: Observable<Address | null> = of(null);
    if (billingAddressId) {
      getBillingAddress$ = this.addressService.getAddressById(Number(billingAddressId))
        .pipe(
          tap(address => this.billingAddress = address),
          catchError(err => {
            this.error = 'Fatura adresi bilgileri yüklenemedi';
            return of(null);
          })
        );
    }

    // Sepet içeriğini yükle
    this.cartService.getCartItems().subscribe(items => {
      this.cartItems = items;
      this.totalPrice = this.cartService.getTotalPrice();

      // Kapıda ödeme seçildiyse ek ücret ekle
      if (this.paymentMethod === 'CASH_ON_DELIVERY') {
        this.shippingPrice = 5.0; // Kapıda ödeme ücreti
      }

      // Adres bilgilerini yükle
      forkJoin([getShippingAddress$, getBillingAddress$]).subscribe(
        () => {
          this.loading = false;
        },
        (err) => {
          this.error = 'Sipariş bilgileri yüklenirken bir hata oluştu';
          this.loading = false;
        }
      );
    });
  }

  getPaymentMethodLabel(): string {
    switch (this.paymentMethod) {
      case 'CREDIT_CARD':
        return 'Kredi Kartı';
      case 'CASH_ON_DELIVERY':
        return 'Kapıda Ödeme';
      case 'BANK_TRANSFER':
        return 'Banka Transferi';
      default:
        return this.paymentMethod;
    }
  }

  getCardInfo(): string {
    if (this.paymentMethod !== 'CREDIT_CARD' || !this.cardData) {
      return '';
    }

    const cardNumber = this.cardData.cardNumber;
    if (!cardNumber) return '';

    // Sadece son 4 haneyi göster
    const lastFour = cardNumber.substring(cardNumber.length - 4);
    return `**** **** **** ${lastFour}`;
  }

  placeOrder(): void {
    if (!this.shippingAddress) {
      this.error = 'Teslimat adresi seçilmedi';
      return;
    }

    if (this.orderLoading) {
      return;
    }

    this.orderLoading = true;
    this.error = null;

    // Sipariş isteği oluştur
    const orderRequest: OrderRequest = {
      shippingAddressId: this.shippingAddress.id!,
      paymentMethod: this.paymentMethod
    };

    // Fatura adresi varsa ekle
    if (this.billingAddress) {
      orderRequest.billingAddressId = this.billingAddress.id;
    }

    // Siparişi oluştur
    this.orderService.createOrder(orderRequest).subscribe(
      (response) => {
        this.orderLoading = false;

        // Sipariş numarasını session storage'a kaydet
        sessionStorage.setItem('orderId', response.id.toString());
        sessionStorage.setItem('orderNumber', response.orderNumber);

        // Session storage'dan adres ve ödeme bilgilerini temizle
        sessionStorage.removeItem('shippingAddressId');
        sessionStorage.removeItem('billingAddressId');
        sessionStorage.removeItem('paymentMethod');
        sessionStorage.removeItem('cardData');

        // Sepeti temizle
        this.cartService.clearCart().subscribe();

        // Başarı sayfasına yönlendir
        this.router.navigate(['/checkout/success']);
      },
      (error) => {
        this.orderLoading = false;
        this.error = error.message || 'Sipariş oluşturulurken bir hata meydana geldi';
      }
    );
  }
}
