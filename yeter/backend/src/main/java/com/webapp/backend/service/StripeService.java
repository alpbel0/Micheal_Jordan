package com.webapp.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.webapp.backend.model.Order;
import com.webapp.backend.model.PaymentStatus;
import com.webapp.backend.model.StripeCustomer;
import com.webapp.backend.model.StripePayment;
import com.webapp.backend.model.StripePaymentMethod;
import com.webapp.backend.model.User;
import com.webapp.backend.repository.StripeCustomerRepository;
import com.webapp.backend.repository.StripePaymentMethodRepository;
import com.webapp.backend.repository.StripePaymentRepository;

@Service
public class StripeService {
    
    @Value("${stripe.api.key}")
    private String stripeApiKey;
    
    @Autowired
    private StripeCustomerRepository stripeCustomerRepository;
    
    @Autowired
    private StripePaymentMethodRepository stripePaymentMethodRepository;
    
    @Autowired
    private StripePaymentRepository stripePaymentRepository;
    
    @Autowired
    private OrderService orderService;
    
    // Stripe müşterisi oluşturma veya getirme
    @Transactional
    public StripeCustomer getOrCreateStripeCustomer(User user) {
        StripeCustomer customer = stripeCustomerRepository.findByUser(user);
        
        if (customer == null) {
            // Gerçek bir Stripe entegrasyonunda burada Stripe API çağrısı yapılır
            // Bu örnek için sadece simüle ediyoruz
            String stripeCustomerId = "cus_" + generateRandomString(14);
            
            customer = new StripeCustomer();
            customer.setUser(user);
            customer.setStripeCustomerId(stripeCustomerId);
            customer.setCreatedAt(LocalDateTime.now());
            customer.setUpdatedAt(LocalDateTime.now());
            
            stripeCustomerRepository.save(customer);
        }
        
        return customer;
    }
    
    // Ödeme metodu ekleme
    @Transactional
    public StripePaymentMethod addPaymentMethod(User user, String cardNumber, int expiryMonth, 
            int expiryYear, String cvc, String cardHolderName, boolean makeDefault) {
        
        StripeCustomer customer = getOrCreateStripeCustomer(user);
        
        // Gerçek bir Stripe entegrasyonunda burada Stripe API çağrısı yapılır
        // Bu örnek için sadece simüle ediyoruz
        String paymentMethodId = "pm_" + generateRandomString(14);
        String cardBrand = determineCardBrand(cardNumber);
        String cardLastFour = cardNumber.substring(cardNumber.length() - 4);
        
        StripePaymentMethod paymentMethod = new StripePaymentMethod();
        paymentMethod.setUser(user);
        paymentMethod.setStripePaymentMethodId(paymentMethodId);
        paymentMethod.setCardBrand(cardBrand);
        paymentMethod.setCardLastFour(cardLastFour);
        paymentMethod.setCardExpiryMonth(expiryMonth);
        paymentMethod.setCardExpiryYear(expiryYear);
        paymentMethod.setCreatedAt(LocalDateTime.now());
        
        if (makeDefault) {
            // Eğer varsayılan olarak ayarlanacaksa, diğer varsayılan ödeme yöntemlerini kaldır
            clearDefaultPaymentMethods(user);
            paymentMethod.setIsDefault(true);
        }
        
        return stripePaymentMethodRepository.save(paymentMethod);
    }
    
    // Ödeme işlemi
    @Transactional
    public StripePayment processPayment(Order order, StripePaymentMethod paymentMethod) {
        // Sipariş kontrolü
        if (order == null) {
            throw new IllegalArgumentException("Sipariş bulunamadı");
        }
        
        // Ödeme yöntemi kontrolü
        if (paymentMethod == null) {
            throw new IllegalArgumentException("Ödeme yöntemi bulunamadı");
        }
        
        // Gerçek bir Stripe entegrasyonunda burada Stripe API çağrısı yapılır
        // Bu örnek için sadece simüle ediyoruz
        String paymentIntentId = "pi_" + generateRandomString(14);
        String stripePaymentId = "py_" + generateRandomString(14);
        
        StripePayment payment = new StripePayment();
        payment.setOrder(order);
        payment.setStripePaymentId(stripePaymentId);
        payment.setStripeCustomerId(stripeCustomerRepository.findByUser(order.getUser()).getStripeCustomerId());
        payment.setPaymentIntentId(paymentIntentId);
        payment.setPaymentMethodId(paymentMethod.getStripePaymentMethodId());
        payment.setAmount(order.getTotalAmount());
        payment.setCurrency("TRY");
        payment.setStatus(PaymentStatus.COMPLETED); // Gerçek entegrasyonda bu durum Stripe'tan gelir
        payment.setPaymentDate(LocalDateTime.now());
        payment.setReceiptUrl("https://stripe.com/receipts/" + stripePaymentId);
        
        // Siparişin ödeme durumunu güncelle
        orderService.updatePaymentStatus(order, PaymentStatus.COMPLETED);
        
        return stripePaymentRepository.save(payment);
    }
    
    // İade işlemi
    @Transactional
    public StripePayment refundPayment(StripePayment payment, BigDecimal refundAmount) {
        // Ödeme kontrolü
        if (payment == null || payment.getStatus() != PaymentStatus.COMPLETED) {
            throw new IllegalArgumentException("Geçerli bir ödeme bulunamadı");
        }
        
        // Gerçek bir Stripe entegrasyonunda burada Stripe API çağrısı yapılır
        // Bu örnek için sadece simüle ediyoruz
        
        // Tam iade mi, kısmi iade mi?
        PaymentStatus newStatus = payment.getAmount().compareTo(refundAmount) == 0 
                ? PaymentStatus.REFUNDED 
                : PaymentStatus.PARTIALLY_REFUNDED;
        
        payment.setStatus(newStatus);
        payment.setLastError(null);
        
        // Siparişin ödeme durumunu güncelle
        orderService.updatePaymentStatus(payment.getOrder(), newStatus);
        
        return stripePaymentRepository.save(payment);
    }
    
    // Varsayılan ödeme yöntemini ayarlama
    @Transactional
    public StripePaymentMethod setDefaultPaymentMethod(StripePaymentMethod paymentMethod) {
        clearDefaultPaymentMethods(paymentMethod.getUser());
        paymentMethod.setIsDefault(true);
        return stripePaymentMethodRepository.save(paymentMethod);
    }
    
    // Yardımcı metodlar
    private void clearDefaultPaymentMethods(User user) {
        StripePaymentMethod defaultMethod = stripePaymentMethodRepository.findByUserAndIsDefaultTrue(user);
        if (defaultMethod != null) {
            defaultMethod.setIsDefault(false);
            stripePaymentMethodRepository.save(defaultMethod);
        }
    }
    
    private String generateRandomString(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            int index = (int) (Math.random() * chars.length());
            sb.append(chars.charAt(index));
        }
        return sb.toString();
    }
    
    private String determineCardBrand(String cardNumber) {
        if (cardNumber.startsWith("4")) {
            return "Visa";
        } else if (cardNumber.startsWith("5")) {
            return "MasterCard";
        } else if (cardNumber.startsWith("3")) {
            return "American Express";
        } else if (cardNumber.startsWith("6")) {
            return "Discover";
        }
        return "Unknown";
    }
} 