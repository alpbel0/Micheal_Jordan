package com.webapp.backend.controller;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.webapp.backend.dto.OrderRequestDto;
import com.webapp.backend.dto.OrderResponseDto;
import com.webapp.backend.exception.ErrorCodes;
import com.webapp.backend.exception.OrderException;
import com.webapp.backend.exception.ResourceNotFoundException;
import com.webapp.backend.model.Address;
import com.webapp.backend.model.Cart;
import com.webapp.backend.model.Coupon;
import com.webapp.backend.model.Order;
import com.webapp.backend.model.OrderItem;
import com.webapp.backend.model.OrderStatus;
import com.webapp.backend.model.PaymentStatus;
import com.webapp.backend.model.User;
import com.webapp.backend.service.AddressService;
import com.webapp.backend.service.CartService;
import com.webapp.backend.service.CouponService;
import com.webapp.backend.service.OrderService;
import com.webapp.backend.service.UserService;

@CrossOrigin(origins = "http://localhost:4200")
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private CartService cartService;
    
    @Autowired
    private AddressService addressService;
    
    @Autowired
    private CouponService couponService;
    
    /**
     * Sipariş oluşturma endpoint'i
     */
    @PostMapping("/{userId}")
    public ResponseEntity<OrderResponseDto> createOrder(
            @PathVariable Long userId,
            @RequestBody OrderRequestDto orderRequest) {
        
        // Kullanıcıyı bul
        User user = userService.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        // Kullanıcı sepetini getir
        Cart cart = cartService.getCartByUser(user);
        if (cart.getCartItems() == null || cart.getCartItems().isEmpty()) {
            throw new OrderException("Sepet boş, sipariş oluşturulamaz", ErrorCodes.ORDER_EMPTY_CART);
        }
        
        // Teslimat ve fatura adreslerini bul
        Address shippingAddress = addressService.getUserAddressById(user, orderRequest.getShippingAddressId());
        if (shippingAddress == null) {
            throw new ResourceNotFoundException("Address", "id", orderRequest.getShippingAddressId());
        }
        
        Address billingAddress = null;
        if (orderRequest.getBillingAddressId() != null) {
            billingAddress = addressService.getUserAddressById(user, orderRequest.getBillingAddressId());
            if (billingAddress == null) {
                throw new ResourceNotFoundException("Address", "id", orderRequest.getBillingAddressId());
            }
        }
        
        // Kupon kodunu kontrol et (varsa)
        Coupon coupon = null;
        if (orderRequest.getCouponCode() != null && !orderRequest.getCouponCode().isEmpty()) {
            coupon = couponService.getCouponByCode(orderRequest.getCouponCode());
            // Kuponun geçerliliğini kontrol et
            if (coupon != null && !coupon.getIsActive()) {
                throw new OrderException("Bu kupon aktif değil", ErrorCodes.COUPON_INVALID);
            }
        }
        
        try {
            // Siparişi oluştur
            Order createdOrder = orderService.createOrderFromCart(
                    user, 
                    cart, 
                    shippingAddress, 
                    billingAddress, 
                    orderRequest.getPaymentMethod(), 
                    coupon);
            
            // OrderResponseDto'ya dönüştür ve yanıt ver
            OrderResponseDto responseDto = convertToDto(createdOrder);
            return ResponseEntity.status(HttpStatus.CREATED).body(responseDto);
        } catch (IllegalStateException e) {
            // OrderService'den gelen stok veya diğer hatalar
            if (e.getMessage().contains("stokta yeterli sayıda yok")) {
                throw new OrderException(e.getMessage(), ErrorCodes.ORDER_INSUFFICIENT_STOCK);
            } else {
                throw new OrderException(e.getMessage(), ErrorCodes.ORDER_EMPTY_CART);
            }
        }
    }
    
    /**
     * Kullanıcıya ait siparişleri getirme endpoint'i
     */
    @GetMapping("/{userId}")
    public ResponseEntity<List<OrderResponseDto>> getUserOrders(@PathVariable Long userId) {
        // Kullanıcıyı bul
        User user = userService.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        // Kullanıcı siparişlerini getir
        List<Order> orders = orderService.getUserOrders(user);
        
        // OrderResponseDto listesine dönüştür
        List<OrderResponseDto> orderDtos = orders.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(orderDtos);
    }
    
    /**
     * Belirli bir siparişi getirme endpoint'i
     */
    @GetMapping("/{userId}/order/{orderId}")
    public ResponseEntity<OrderResponseDto> getOrderById(
            @PathVariable Long userId,
            @PathVariable Long orderId) {
        
        // Kullanıcıyı bul
        User user = userService.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        // Siparişi bul
        Order order = orderService.getOrderByIdAndUser(orderId, user);
        if (order == null) {
            throw new ResourceNotFoundException("Order", "id", orderId);
        }
        
        // OrderResponseDto'ya dönüştür
        OrderResponseDto orderDto = convertToDto(order);
        return ResponseEntity.ok(orderDto);
    }
    
    /**
     * Sipariş durumunu güncelleme endpoint'i (Admin için)
     */
    @PutMapping("/{orderId}/status")
    public ResponseEntity<OrderResponseDto> updateOrderStatus(
            @PathVariable Long orderId,
            @RequestBody OrderStatus status) {
        
        // Siparişi bul
        Order order = orderService.getOrderById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", "id", orderId));
        
        // Durumu güncelle
        order.setStatus(status);
        order = orderService.updateOrder(order);
        
        // OrderResponseDto'ya dönüştür
        OrderResponseDto orderDto = convertToDto(order);
        return ResponseEntity.ok(orderDto);
    }
    
    /**
     * Ödeme durumunu güncelleme endpoint'i (Admin veya ödeme işlemi için)
     */
    @PutMapping("/{orderId}/payment")
    public ResponseEntity<OrderResponseDto> updatePaymentStatus(
            @PathVariable Long orderId,
            @RequestBody PaymentStatus newStatus) {
        
        // Siparişi bul
        Optional<Order> orderOpt = orderService.getOrderById(orderId);
        if (!orderOpt.isPresent()) {
            throw new ResourceNotFoundException("Order", "id", orderId);
        }
        
        Order order = orderOpt.get();
        
        // İptal edilmiş siparişlerde ödeme durumu değiştirilemez
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new OrderException(
                "İptal edilmiş siparişlerde ödeme durumu değiştirilemez", 
                ErrorCodes.ORDER_INVALID_STATUS
            );
        }
        
        // Ödeme durumunu güncelle
        Order updatedOrder = orderService.updatePaymentStatus(order, newStatus);
        
        // OrderResponseDto'ya dönüştür
        OrderResponseDto orderDto = convertToDto(updatedOrder);
        return ResponseEntity.ok(orderDto);
    }
    
    /**
     * Sipariş iptal etme endpoint'i
     */
    @PutMapping("/{userId}/order/{orderId}/cancel")
    public ResponseEntity<OrderResponseDto> cancelOrder(
            @PathVariable Long userId,
            @PathVariable Long orderId) {
        
        // Kullanıcıyı bul
        User user = userService.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        // Siparişi bul
        Order order = orderService.getOrderByIdAndUser(orderId, user);
        if (order == null) {
            throw new ResourceNotFoundException("Order", "id", orderId);
        }
        
        // Sadece belirli durumlardaki siparişler iptal edilebilir
        if (order.getStatus() != OrderStatus.PENDING && 
            order.getStatus() != OrderStatus.PROCESSING &&
            order.getStatus() != OrderStatus.CONFIRMED) {
            throw new OrderException(
                "Bu aşamadaki sipariş iptal edilemez. Lütfen müşteri hizmetleri ile iletişime geçin.", 
                ErrorCodes.ORDER_CANCEL_LIMIT
            );
        }
        
        // Siparişi iptal et
        orderService.cancelOrder(order);
        
        // OrderResponseDto'ya dönüştür
        OrderResponseDto orderDto = convertToDto(order);
        return ResponseEntity.ok(orderDto);
    }
    
    /**
     * Satıcının ürünlerini içeren siparişleri getirme endpoint'i
     */
    @GetMapping("/seller/{sellerId}")
    public ResponseEntity<List<OrderResponseDto>> getSellerOrders(@PathVariable Long sellerId) {
        // Satıcıyı bul
        User seller = userService.findById(sellerId)
                .orElseThrow(() -> new ResourceNotFoundException("Seller", "id", sellerId));
        
        // Satıcının siparişlerini getir
        List<Order> orders = orderService.getOrdersContainingSellerProducts(seller);
        
        // OrderResponseDto listesine dönüştür
        List<OrderResponseDto> orderDtos = orders.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(orderDtos);
    }
    
    /**
     * Order entity'sini OrderResponseDto'ya dönüştürür
     */
    private OrderResponseDto convertToDto(Order order) {
        OrderResponseDto dto = new OrderResponseDto();
        dto.setId(order.getId());
        dto.setOrderDate(order.getOrderDate());
        dto.setTotalAmount(order.getTotalAmount());
        dto.setStatus(order.getStatus());
        dto.setPaymentStatus(order.getPaymentStatus());
        dto.setPaymentMethod(order.getPaymentMethod());
        
        // Kullanıcı bilgilerini ekle
        if (order.getUser() != null) {
            dto.setUserId(order.getUser().getId());
            dto.setUserFirstName(order.getUser().getFirstName());
            dto.setUserLastName(order.getUser().getLastName());
        }
        
        // Kargo takip numarası (eğer kargo bilgisi varsa)
        String trackingNumber = null;
        if (order.getShipment() != null) {
            trackingNumber = order.getShipment().getTrackingNumber();
        }
        dto.setTrackingNumber(trackingNumber);
        
        dto.setHasCoupon(order.getCoupon() != null);
        
        // Teslimat adresi bilgilerini doldur
        OrderResponseDto.AddressDto addressDto = new OrderResponseDto.AddressDto();
        addressDto.setId(order.getShippingAddress().getId());
        addressDto.setRecipientName(order.getShippingAddress().getRecipientName());
        addressDto.setAddressLine1(order.getShippingAddress().getAddressLine1());
        addressDto.setAddressLine2(order.getShippingAddress().getAddressLine2());
        addressDto.setCity(order.getShippingAddress().getCity());
        addressDto.setPostalCode(order.getShippingAddress().getPostalCode());
        addressDto.setCountry(order.getShippingAddress().getCountry());
        addressDto.setPhoneNumber(order.getShippingAddress().getPhoneNumber());
        dto.setShippingAddress(addressDto);
        
        // Sipariş ürünlerini dönüştür
        List<OrderItem> orderItems = order.getOrderItems();
        List<OrderResponseDto.OrderItemDto> itemDtos = orderItems.stream()
                .map(item -> {
                    OrderResponseDto.OrderItemDto itemDto = new OrderResponseDto.OrderItemDto();
                    itemDto.setId(item.getId());
                    itemDto.setProductId(item.getProduct().getId());
                    itemDto.setProductName(item.getProduct().getName());
                    itemDto.setProductImage(item.getProduct().getImage_url());
                    itemDto.setQuantity(item.getQuantity());
                    itemDto.setPrice(item.getPrice());
                    itemDto.setSubtotal(item.getPrice().multiply(java.math.BigDecimal.valueOf(item.getQuantity())));
                    itemDto.setSellerId(item.getProduct().getSeller().getId());
                    return itemDto;
                })
                .collect(Collectors.toList());
        
        dto.setItems(itemDtos);
        
        return dto;
    }
} 