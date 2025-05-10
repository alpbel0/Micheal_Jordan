package com.webapp.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.webapp.backend.model.Address;
import com.webapp.backend.model.Cart;
import com.webapp.backend.model.CartItem;
import com.webapp.backend.model.Coupon;
import com.webapp.backend.model.Order;
import com.webapp.backend.model.OrderItem;
import com.webapp.backend.model.OrderStatus;
import com.webapp.backend.model.PaymentStatus;
import com.webapp.backend.model.Product;
import com.webapp.backend.model.User;
import com.webapp.backend.repository.OrderItemRepository;
import com.webapp.backend.repository.OrderRepository;
import com.webapp.backend.repository.ProductRepository;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CartService cartService;

    @Autowired
    private AddressService addressService;

    public List<Order> getUserOrders(User user) {
        return orderRepository.findByUserOrderByOrderDateDesc(user);
    }

    public Optional<Order> getOrderById(Long id) {
        return orderRepository.findById(id);
    }

    public Order getOrderByIdAndUser(Long id, User user) {
        return orderRepository.findByIdAndUser(id, user);
    }

    public List<Order> getOrdersByStatus(OrderStatus status) {
        return orderRepository.findByStatus(status);
    }

    /**
     * Satıcının ürünlerinin bulunduğu tüm siparişleri getir
     */
    public List<Order> getOrdersContainingSellerProducts(User seller) {
        List<Product> sellerProducts = productRepository.findBySeller(seller);
        
        // Satıcının ürünlerinin satıldığı benzersiz siparişleri bul
        return orderRepository.findAll().stream()
            .filter(order -> order.getOrderItems().stream()
                .anyMatch(item -> sellerProducts.contains(item.getProduct())))
            .collect(Collectors.toList());
    }

    @Transactional
    public Order createOrderFromCart(User user, Cart cart, Address shippingAddress, Address billingAddress, 
            String paymentMethod, Coupon coupon) {
        // Sepet boşsa sipariş oluşturma
        if (cart.getCartItems().isEmpty()) {
            throw new IllegalStateException("Sepet boş, sipariş oluşturulamaz");
        }

        // Ürünlerin stok kontrolü
        for (CartItem cartItem : cart.getCartItems()) {
            Product product = cartItem.getProduct();
            if (product.getStock_quantity() < cartItem.getQuantity()) {
                throw new IllegalStateException("Ürün stokta yeterli sayıda yok: " + product.getName());
            }
        }

        // Yeni sipariş oluştur
        Order order = new Order();
        order.setUser(user);
        order.setOrderDate(LocalDateTime.now());
        order.setStatus(OrderStatus.PENDING);
        order.setShippingAddress(shippingAddress);
        order.setBillingAddress(billingAddress != null ? billingAddress : shippingAddress);
        order.setPaymentMethod(paymentMethod);
        order.setPaymentStatus(PaymentStatus.PENDING);
        
        // Kupon uygulanacaksa
        if (coupon != null) {
            order.setCoupon(coupon);
        }

        // Toplam tutarı hesapla (kupon indirimi henüz hesaplanmadan)
        BigDecimal totalAmount = cart.getCartItems().stream()
            .map(item -> BigDecimal.valueOf(item.getQuantity()).multiply(BigDecimal.valueOf(item.getProduct().getPrice())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
            
        // Kupon indirimi uygula
        if (coupon != null && coupon.isValid(LocalDateTime.now(), totalAmount)) {
            BigDecimal discount = coupon.calculateDiscount(totalAmount);
            totalAmount = totalAmount.subtract(discount);
        }
        
        order.setTotalAmount(totalAmount);
        orderRepository.save(order);

        // Sipariş ürünlerini oluştur
        for (CartItem cartItem : cart.getCartItems()) {
            Product product = cartItem.getProduct();
            
            OrderItem orderItem = new OrderItem();
            orderItem.setOrder(order);
            orderItem.setProduct(product);
            orderItem.setQuantity(cartItem.getQuantity());
            orderItem.setPrice(BigDecimal.valueOf(product.getPrice()));
            orderItemRepository.save(orderItem);
            
            // Ürün stoğunu güncelle
            product.setStock_quantity(product.getStock_quantity() - cartItem.getQuantity());
            productRepository.save(product);
        }

        // Siparişi oluşturduktan sonra sepeti temizle
        cartService.clearCart(user);

        return order;
    }

    @Transactional
    public Order updateOrderStatus(Order order, OrderStatus newStatus) {
        order.setStatus(newStatus);
        return orderRepository.save(order);
    }

    @Transactional
    public Order updatePaymentStatus(Order order, PaymentStatus newStatus) {
        order.setPaymentStatus(newStatus);
        return orderRepository.save(order);
    }
    
    @Transactional
    public void cancelOrder(Order order) {
        // Sipariş durumunu iptal olarak güncelle
        order.setStatus(OrderStatus.CANCELLED);
        
        // Ürünleri stoka geri ekle
        List<OrderItem> orderItems = orderItemRepository.findByOrder(order);
        for (OrderItem item : orderItems) {
            Product product = item.getProduct();
            product.setStock_quantity(product.getStock_quantity() + item.getQuantity());
            productRepository.save(product);
        }
        
        orderRepository.save(order);
    }

    /**
     * Siparişi güncelle
     */
    public Order updateOrder(Order order) {
        return orderRepository.save(order);
    }
} 