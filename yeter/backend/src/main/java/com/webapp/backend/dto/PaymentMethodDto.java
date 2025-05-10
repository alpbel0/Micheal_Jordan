package com.webapp.backend.dto;

import lombok.Data;

@Data
public class PaymentMethodDto {
    // Ödeme yöntemi ekleme isteği
    @Data
    public static class Request {
        private String cardNumber;
        private String cardHolderName;
        private Integer expiryMonth;
        private Integer expiryYear;
        private String cvc;
        private Boolean makeDefault;
        private Long billingAddressId; // İsteğe bağlı fatura adresi
    }
    
    // Ödeme yöntemi cevabı
    @Data
    public static class Response {
        private Long id;
        private String cardBrand;      // Visa, Mastercard vb.
        private String cardLastFour;   // Kartın son 4 hanesi
        private Integer expiryMonth;
        private Integer expiryYear;
        private Boolean isDefault;
        private AddressDto billingAddress;  // İsteğe bağlı fatura adresi
    }
} 