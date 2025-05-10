import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private apiUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) { }

  // Kullanıcı profilini getir
  getUserProfile(userId: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Profil bilgilerini güncelle
  updateProfile(userId: number, userData: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${userId}`, userData).pipe(
      catchError(this.handleError)
    );
  }

  // Şifre değiştirme
  changePassword(userId: number, passwordData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${userId}/change-password`, passwordData).pipe(
      catchError(this.handleError)
    );
  }

  // Profil fotoğrafı yükleme
  uploadProfileImage(userId: number, image: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', image);

    return this.http.post<any>(`${this.apiUrl}/${userId}/upload-image`, formData).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any) {
    console.error('UserProfileService error:', error);
    let errorMessage = 'İşlem sırasında bir hata oluştu.';
    if (error.error instanceof ErrorEvent) {
      // İstemci taraflı hata
      errorMessage = `Hata: ${error.error.message}`;
    } else if (error.error && error.error.message) {
      // Sunucu taraflı hata mesajı
      errorMessage = error.error.message;
    } else if (error.status) {
      // Durum kodu ile ilgili hata
      switch (error.status) {
        case 400:
          errorMessage = 'Geçersiz istek';
          break;
        case 401:
          errorMessage = 'Yetkisiz erişim';
          break;
        case 403:
          errorMessage = 'Erişim reddedildi';
          break;
        case 404:
          errorMessage = 'Kullanıcı bulunamadı';
          break;
        case 500:
          errorMessage = 'Sunucu hatası';
          break;
      }
    }
    return throwError(() => ({ message: errorMessage }));
  }
}
