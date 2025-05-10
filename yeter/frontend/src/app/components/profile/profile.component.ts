import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserProfileService } from '../../services/user-profile.service';
import { User } from '../../models/user.model';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  currentUser: User | null = null;
  editMode: boolean = false;
  updatedUser: any = {};
  passwordChange: { currentPassword: string, newPassword: string, confirmPassword: string } = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  showPasswordForm: boolean = false;
  loading: boolean = false;

  // Aktif bölüm - profile, orders, addresses, payments
  activeSection: string = 'profile';

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
      }
    });

    this.loadUserProfile();
  }

  // Tab değiştirme yöntemi
  setActiveSection(section: string): void {
    this.activeSection = section;
  }

  loadUserProfile(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;

      if (this.currentUser && this.currentUser.id) {
        this.loading = true;

        // Kullanıcı oturum açmışsa profil bilgilerini al
        this.profileService.getUserProfile(this.currentUser.id).subscribe({
          next: (profile) => {
            // Kullanıcı bilgilerini güncelle
            this.currentUser = {
              ...this.currentUser!,
              ...profile
            };

            // Form için bilgileri hazırla
            this.prepareUserData();
            this.loading = false;
          },
          error: (err) => {
            console.error('Profil yüklenirken hata:', err);
            this.loading = false;

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

  saveProfile(): void {
    if (!this.currentUser || !this.currentUser.id) return;

    this.loading = true;

    this.profileService.updateProfile(this.currentUser.id, this.updatedUser).subscribe({
      next: (updatedUser) => {
        this.alertService.success('Profil bilgileriniz başarıyla güncellendi.');
        this.editMode = false;
        this.loading = false;

        // Kullanıcı bilgilerini güncelle
        const updatedCurrentUser = {
          ...this.currentUser!,
          username: updatedUser.username,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName
        };

        // Auth servisindeki yeni metodu kullanarak güncelleme yap
        this.authService.updateCurrentUser(updatedCurrentUser);
        this.currentUser = updatedCurrentUser;
      },
      error: (err) => {
        this.loading = false;
        this.alertService.error('Profil güncellenemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    });
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
    }
  }

  changePassword(): void {
    if (!this.currentUser || !this.currentUser.id) return;

    // Şifre doğrulama kontrolleri
    if (this.passwordChange.newPassword !== this.passwordChange.confirmPassword) {
      this.alertService.error('Yeni şifreler eşleşmiyor.');
      return;
    }

    if (this.passwordChange.newPassword.length < 6) {
      this.alertService.error('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    this.loading = true;

    this.profileService.changePassword(this.currentUser.id, {
      currentPassword: this.passwordChange.currentPassword,
      newPassword: this.passwordChange.newPassword
    }).subscribe({
      next: () => {
        this.alertService.success('Şifreniz başarıyla değiştirildi.');
        this.togglePasswordForm();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.alertService.error('Şifre değiştirilemedi: ' + (err.message || 'Bilinmeyen hata'));
      }
    });
  }
}
