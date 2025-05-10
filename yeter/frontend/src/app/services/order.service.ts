import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface OrderRequest {
  shippingAddressId: number;
  billingAddressId?: number;
  paymentMethod: string;
  couponCode?: string;
  paymentMethodId?: number;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  subtotal: number;
  sellerId?: number;
}

export interface OrderResponse {
  id: number;
  userId: number;
  userFirstName?: string;
  userLastName?: string;
  orderNumber: string;
  totalPrice: number;
  shippingPrice: number;
  discountAmount?: number;
  paymentMethod: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  shippingAddress: any;
  billingAddress?: any;
  couponCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:8080/api/orders';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  createOrder(orderRequest: OrderRequest): Observable<OrderResponse> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('Kullanıcı ID bulunamadı'));
    }

    return this.http.post<OrderResponse>(`${this.apiUrl}/${userId}`, orderRequest)
      .pipe(catchError(this.handleError));
  }

  getUserOrders(): Observable<OrderResponse[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('Kullanıcı ID bulunamadı'));
    }

    return this.http.get<OrderResponse[]>(`${this.apiUrl}/${userId}`)
      .pipe(catchError(this.handleError));
  }

  getOrderById(orderId: number): Observable<OrderResponse> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('Kullanıcı ID bulunamadı'));
    }

    return this.http.get<OrderResponse>(`${this.apiUrl}/${userId}/order/${orderId}`)
      .pipe(catchError(this.handleError));
  }

  cancelOrder(orderId: number): Observable<OrderResponse> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('Kullanıcı ID bulunamadı'));
    }

    return this.http.put<OrderResponse>(`${this.apiUrl}/${userId}/order/${orderId}/cancel`, {})
      .pipe(catchError(this.handleError));
  }

  getOrderStatuses(): string[] {
    return [
      'PENDING',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'RETURNED'
    ];
  }

  getPaymentStatuses(): string[] {
    return [
      'PENDING',
      'PAID',
      'REFUNDED',
      'FAILED'
    ];
  }

  getPaymentMethods(): string[] {
    return [
      'CREDIT_CARD',
      'CASH_ON_DELIVERY',
      'BANK_TRANSFER'
    ];
  }

  /**
   * Satıcının siparişlerini getir
   */
  getSellerOrders(): Observable<OrderResponse[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('Kullanıcı ID bulunamadı'));
    }
    
    return this.http.get<OrderResponse[]>(`${this.apiUrl}/seller/${userId}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Bir hata oluştu';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Hata: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.message || error.error?.detail || `Hata kodu: ${error.status}, Mesaj: ${error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}
