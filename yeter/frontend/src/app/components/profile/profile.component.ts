import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserProfileService, Address } from '../../services/user-profile.service';
import { User, UserRole } from '../../models/user.model';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  // Kullanıcı ve profil bilgileri
  currentUser: User | null = null;
  user: User | null = null; // HTML şablonunda kullanılan yeni isim

  // UI durum değişkenleri
  editMode: boolean = false;
  loading: boolean = false;
  isLoading: boolean = false; // HTML şablonunda kullanılan isim

  // Formlar ve veri
  updatedUser: any = {};
  passwordChange: { currentPassword: string, newPassword: string, confirmPassword: string } = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  // Yeni şifre değiştirme veri modeli
  passwordData: { currentPassword: string, newPassword: string, confirmPassword: string } = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  showPasswordForm: boolean = false;

  // Aktif bölüm/sekme - HTML'de activeTab olarak kullanılıyor
  activeSection: string = 'profile';
  activeTab: string = 'profile'; // Yeni isim

  // Adres yönetimi için değişkenler
  addresses: Address[] = [];
  currentAddress: Address = this.createEmptyAddress();
  showingAddressForm: boolean = false;
  editingAddress: boolean = false;

  constructor(
    private authService: AuthService,
    private profileService: UserProfileService,
    private alertService: AlertService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // URL'deki bölüm parametresini kontrol et
    this.route.data.subscribe(data => {
      if (data['section']) {
        this.activeSection = data['section'];
        this.activeTab = data['section']; // Yeni sekme değişkenini güncelle
      }
    });

    this.loadUserProfile();
  }

  // Sekme değiştirme yöntemi - eski ve yeni adlar için
  setActiveSection(section: string): void {
    this.activeSection = section;
    this.activeTab = section; // Yeni sekme değişkenini güncelle
  }

  // Yeni sekme değiştirme yöntemi (HTML'de kullanılıyor)
  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.activeSection = tab; // Eski değişkeni de güncelle

    // Adresler sekmesi açıldığında adresleri yükle
    if (tab === 'addresses') {
      this.loadAddresses();
    }
  }

  // Rol adını döndüren yardımcı metot
  getRoleName(role?: UserRole): string {
    if (!role) return 'Kullanıcı';

    switch (role) {
      case UserRole.ADMIN:
        return 'Yönetici';
      case UserRole.SELLER:
        return 'Satıcı';
      case UserRole.USER:
      default:
        return 'Kullanıcı';
    }
  }

  loadUserProfile(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.user = user; // Yeni değişkeni güncelle

      if (this.currentUser && this.currentUser.id) {
        this.loading = true;
        this.isLoading = true; // Yeni değişkeni güncelle

        // Kullanıcı oturum açmışsa profil bilgilerini al
        this.profileService.getUserProfile(this.currentUser.id).subscribe({
          next: (profile) => {
            // Kullanıcı bilgilerini güncelle
            this.currentUser = {
              ...this.currentUser!,
              ...profile
            };
            this.user = this.currentUser; // Yeni değişkeni güncelle

            // Form için bilgileri hazırla
            this.prepareUserData();
            this.loading = false;
            this.isLoading = false; // Yeni değişkeni güncelle

            // Adresler sekmesi açıksa adresleri yükle
            if (this.activeTab === 'addresses') {
              this.loadAddresses();
            }
          },
          error: (err) => {
            console.error('Profil yüklenirken hata:', err);
            this.loading = false;
            this.isLoading = false; // Yeni değişkeni güncelle

            // Hata durumunda mevcut bilgilerle devam et
            this.prepareUserData();
          }
        });
      } else {
        // Kullanıcı bilgisi yoksa, formları sıfırla
        this.updatedUser = {};
      }
    });
  }

  prepareUserData(): void {
    if (this.currentUser) {
      this.updatedUser = {
        id: this.currentUser.id,
        username: this.currentUser.username,
        email: this.currentUser.email,
        firstName: this.currentUser.firstName || '',
        lastName: this.currentUser.lastName || ''
      };
    }
  }

  toggleEditMode(): void {
    this.editMode = !this.editMode;

    // Düzenleme iptal edilirse, değerleri sıfırla
    if (!this.editMode) {
      this.prepareUserData();
    }
  }

  // Profil Güncelleme - HTML'de updateProfile olarak çağrılıyor
  updateProfile(): void {
    if (!this.user || !this.user.id) return;

    this.loading = true;
    this.isLoading = true;

    this.profileService.updateProfile(this.user.id, this.user).subscribe({
      next: (updatedUser) => {
        this.alertService.success('Profil bilgileriniz başarıyla güncellendi.');
        this.loading = false;
        this.isLoading = false;

        // Kullanıcı bilgilerini güncelle
        const updatedCurrentUser = {
          ...this.user!,
          ...updatedUser
        };

        // Auth servisindeki yeni metodu kullanarak güncelleme yap
        this.authService.updateCurrentUser(updatedCurrentUser);
        this.currentUser = updatedCurrentUser;
        this.user = updatedCurrentUser;
      },
      error: (err) => {
        this.loading = false;
        this.isLoading = false;
        this.alertService.error('Profil güncellenemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    });
  }

  // saveProfile metodu - HTML'de kullanılan ad
  saveProfile(): void {
    // Varolan updateProfile metodunu çağır
    this.updateProfile();
    this.editMode = false; // Düzenleme modunu kapat
  }

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;

    // Form kapatılırsa değerleri sıfırla
    if (!this.showPasswordForm) {
      this.passwordChange = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      this.passwordData = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
    }
  }

  // HTML'de changePassword olarak çağrılıyor
  changePassword(): void {
    if (!this.user || !this.user.id) return;

    // Şifre doğrulama kontrolleri
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.alertService.error('Yeni şifreler eşleşmiyor.');
      return;
    }

    if (this.passwordData.newPassword.length < 6) {
      this.alertService.error('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    this.loading = true;
    this.isLoading = true;

    this.profileService.changePassword(this.user.id, {
      currentPassword: this.passwordData.currentPassword,
      newPassword: this.passwordData.newPassword
    }).subscribe({
      next: () => {
        this.alertService.success('Şifreniz başarıyla değiştirildi.');
        this.passwordData = {
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        };
        this.loading = false;
        this.isLoading = false;
      },
      error: (err) => {
        this.loading = false;
        this.isLoading = false;
        this.alertService.error('Şifre değiştirilemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    });
  }

  // Adres yönetimi metodları
  loadAddresses(): void {
    if (!this.user || !this.user.id) return;

    this.loading = true;
    this.isLoading = true;

    this.profileService.getUserAddresses(this.user.id).subscribe({
      next: (addresses) => {
        this.addresses = addresses;
        this.loading = false;
        this.isLoading = false;
      },
      error: (err) => {
        this.loading = false;
        this.isLoading = false;
        this.alertService.error('Adresler yüklenemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    });
  }

  // Boş adres nesnesi oluştur
  createEmptyAddress(): Address {
    return {
      title: '',
      fullName: '',
      phone: '',
      city: '',
      district: '',
      zipCode: '',
      addressLine: '',
      isDefault: false
    };
  }

  // Adres formu göster
  showAddressForm(): void {
    this.showingAddressForm = true;
    this.editingAddress = false;
    this.currentAddress = this.createEmptyAddress();
  }

  // Adres formu iptal
  cancelAddressForm(): void {
    this.showingAddressForm = false;
    this.editingAddress = false;
    this.currentAddress = this.createEmptyAddress();
  }

  // Adres kaydet (ekleme veya güncelleme)
  saveAddress(): void {
    if (!this.user || !this.user.id) return;

    this.loading = true;
    this.isLoading = true;

    if (this.editingAddress && this.currentAddress.id) {
      // Mevcut adres güncelleme
      this.profileService.updateAddress(this.user.id, this.currentAddress.id, this.currentAddress).subscribe({
        next: (address) => {
          this.alertService.success('Adres başarıyla güncellendi.');
          this.showingAddressForm = false;
          this.loadAddresses(); // Adresleri yeniden yükle
        },
        error: (err) => {
          this.loading = false;
          this.isLoading = false;
          this.alertService.error('Adres güncellenemedi: ' + (err.message || 'Bilinmeyen hata'));
        }
      });
    } else {
      // Yeni adres ekleme
      this.profileService.addAddress(this.user.id, this.currentAddress).subscribe({
        next: (address) => {
          this.alertService.success('Adres başarıyla eklendi.');
          this.showingAddressForm = false;
          this.loadAddresses(); // Adresleri yeniden yükle
        },
        error: (err) => {
          this.loading = false;
          this.isLoading = false;
          this.alertService.error('Adres eklenemedi: ' + (err.message || 'Bilinmeyen hata'));
        }
      });
    }
  }

  // Adres düzenleme
  editAddress(address: Address): void {
    this.currentAddress = {...address};
    this.showingAddressForm = true;
    this.editingAddress = true;
  }

  // Adres silme
  deleteAddress(addressId: number): void {
    if (!this.user || !this.user.id) return;

    if (confirm('Bu adresi silmek istediğinizden emin misiniz?')) {
      this.loading = true;
      this.isLoading = true;

      this.profileService.deleteAddress(this.user.id, addressId).subscribe({
        next: () => {
          this.alertService.success('Adres başarıyla silindi.');
          this.loadAddresses(); // Adresleri yeniden yükle
        },
        error: (err) => {
          this.loading = false;
          this.isLoading = false;
          this.alertService.error('Adres silinemedi: ' + (err.message || 'Bilinmeyen hata'));
        }
      });
    }
  }

  // Varsayılan adres yapma
  setDefaultAddress(addressId: number): void {
    if (!this.user || !this.user.id) return;

    this.loading = true;
    this.isLoading = true;

    this.profileService.setDefaultAddress(this.user.id, addressId).subscribe({
      next: () => {
        this.alertService.success('Varsayılan adres güncellendi.');
        this.loadAddresses(); // Adresleri yeniden yükle
      },
      error: (err) => {
        this.loading = false;
        this.isLoading = false;
        this.alertService.error('Varsayılan adres güncellenemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    });
  }
}
