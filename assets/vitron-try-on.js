// Vitron Virtual Try-On Plugin - Redesigned
class VitronTryOn {
  constructor() {
    this.personImage = null;
    this.clothImage = null;
    this.resultImage = null;
    this.isProcessing = false;
    this.logs = '';
    this.currentUploadId = '';
    this.pollAttempts = 0;
    this.resultCheckTimer = null;
    this.currentScreen = 'upload';
    this.progressPercentage = 0;
    this.progressInterval = null;
    this.messageIndex = 0;
    this.isLiked = false;
    
    // Processing messages
    this.processingMessages = [
      "The virtual try-on is processing your images...",
      "Our AI is analyzing the fit and style for you...",
      "Usually, it doesn't take this much time, please wait...",
      "Creating the perfect virtual try-on experience...",
      "Almost done! Finalizing your personalized look..."
    ];
    
    // Product information
    this.productInfo = {
      title: '',
      price: '',
      originalPrice: '',
      description: '',
      rating: 0,
      reviews: 0,
      selectedSize: '',
      selectedColor: '',
      image: '',
      sizes: [],
      colors: [],
      productId: '',
      variantId: ''
    };
    
    // Get API configuration from Shopify settings
    this.serverUrl = window.vitronConfig?.apiUrl || 'https://66de5c69e455.ngrok.app';
    this.apiKey = window.vitronConfig?.apiKey || '';
    this.isEnabled = window.vitronConfig?.enabled !== false;
    this.buttonText = window.vitronConfig?.buttonText || 'Virtual Try-On';
    this.buttonStyle = window.vitronConfig?.buttonStyle || 'primary';
    this.showOnAllProducts = window.vitronConfig?.showOnAllProducts || false;
    this.productTags = window.vitronConfig?.productTags || ['try-on', 'virtual-try-on', 'clothing'];
    this.maxPollAttempts = window.vitronConfig?.maxPollAttempts || 30;
    this.pollInterval = window.vitronConfig?.pollInterval || 3000;
    this.aiModelUrl = window.vitronConfig?.aiModelUrl || 'https://7a096e507917.ngrok.app';
    this.aiModelEnabled = window.vitronConfig?.aiModelEnabled !== false;
    
    // Full Body Try-On Settings
    this.fullBodyApiUrl = window.vitronConfig?.fullBodyApiUrl || 'https://524198ca9ab3.ngrok.app';
    this.fullBodyEnabled = window.vitronConfig?.fullBodyEnabled !== false;
    this.fullBodyButtonText = window.vitronConfig?.fullBodyButtonText || 'Try Full Body';
    this.fullBodyTimeout = window.vitronConfig?.fullBodyTimeout || 120;
    this.debugMode = window.vitronConfig?.debugMode || false;
    this.enableAnalytics = window.vitronConfig?.enableAnalytics !== false;
    
    // Store AI recommendations
    this.aiRecommendations = [];
    
    // Debug log the three endpoints
    console.log('🔧 NGROK Configuration:');
    console.log('   📍 Half Body Try-On API (Ngrok #1):', this.serverUrl);
    console.log('   🤖 AI Recommendation API (Ngrok #2):', this.aiModelUrl);
    console.log('   👤 Full Body Try-On API (Ngrok #3):', this.fullBodyApiUrl);
    console.log('   ✅ AI Enabled:', this.aiModelEnabled);
    console.log('   ✅ Full Body Enabled:', this.fullBodyEnabled);
    console.log('   🔍 Config Source:', window.vitronConfig ? 'Shopify Settings' : 'Hardcoded Fallback');
    console.log('   📋 Full Config:', window.vitronConfig);
    
    this.init();
  }

  init() {
    this.extractProductInfo();
    this.createTryOnInterface();
    this.bindEvents();
    this.testConnection();
    this.autoSelectClothImage();
  }

  extractProductInfo() {
    try {
      // Extract product information from the current page
      const productForm = document.querySelector('form[action*="/cart/add"]');
      const productTitle = document.querySelector('.product__title, h1[class*="product"], .product-title');
      const productPrice = document.querySelector('.price__current, .product__price, [class*="price"]:not([class*="compare"])');
      const productComparePrice = document.querySelector('.price__compare, .product__compare-price, [class*="compare-price"]');
      const productDescription = document.querySelector('.product__description, .product-description, [class*="description"]');
      const productImage = document.querySelector('.product__media img, .product-image img, .featured-image img');
      
      // Get product ID and variant ID
      if (productForm) {
        const productIdInput = productForm.querySelector('[name="id"]');
        const productIdFromForm = productForm.querySelector('[name="product-id"]');
        this.productInfo.variantId = productIdInput ? productIdInput.value : '';
        this.productInfo.productId = productIdFromForm ? productIdFromForm.value : '';
      }
      
      // Extract title
      if (productTitle) {
        this.productInfo.title = productTitle.textContent.trim();
      }
      
      // Extract prices
      if (productPrice) {
        this.productInfo.price = productPrice.textContent.trim();
      }
      if (productComparePrice) {
        this.productInfo.originalPrice = productComparePrice.textContent.trim();
      }
      
      // Extract description
      if (productDescription) {
        const descText = productDescription.textContent.trim();
        this.productInfo.description = descText.length > 200 ? descText.substring(0, 200) + '...' : descText;
      }
      
      // Extract image
      if (productImage) {
        this.productInfo.image = productImage.src;
      }
      
      // Extract variant options
      this.extractVariantOptions();
      
      // Extract rating (if available)
      this.extractRating();
      
      console.log('✅ Product info extracted:', this.productInfo);
    } catch (error) {
      console.error('❌ Error extracting product info:', error);
      // Fallback values
      this.productInfo.title = 'Selected Product';
      this.productInfo.description = 'Perfect for everyday wear. Features classic design.';
    }
  }

  extractVariantOptions() {
    // Extract size options
    const sizeSelectors = document.querySelectorAll('[data-option-position="1"] .swatch-input, .size-selector input, [name*="size"] option');
    this.productInfo.sizes = [];
    
    sizeSelectors.forEach(selector => {
      let sizeValue = '';
      if (selector.tagName === 'INPUT') {
        sizeValue = selector.value;
      } else if (selector.tagName === 'OPTION') {
        sizeValue = selector.value;
      }
      if (sizeValue && !this.productInfo.sizes.includes(sizeValue)) {
        this.productInfo.sizes.push(sizeValue);
      }
    });
    
    // Default sizes if none found
    if (this.productInfo.sizes.length === 0) {
      this.productInfo.sizes = ['36', '38', '40', '42', '44'];
    }
    
    // Extract color options
    const colorSelectors = document.querySelectorAll('[data-option-position="2"] .swatch-input, .color-selector input, [name*="color"] option');
    this.productInfo.colors = [];
    
    colorSelectors.forEach(selector => {
      let colorValue = '';
      if (selector.tagName === 'INPUT') {
        colorValue = selector.value;
      } else if (selector.tagName === 'OPTION') {
        colorValue = selector.value;
      }
      if (colorValue && !this.productInfo.colors.includes(colorValue)) {
        this.productInfo.colors.push({
          name: colorValue,
          class: this.getColorClass(colorValue)
        });
      }
    });
    
    // Default colors if none found
    if (this.productInfo.colors.length === 0) {
      this.productInfo.colors = [
        { name: 'Black', class: 'vitron-color-black' },
        { name: 'Blue', class: 'vitron-color-blue' },
        { name: 'Pink', class: 'vitron-color-pink' },
        { name: 'Purple', class: 'vitron-color-purple' }
      ];
    }
    
    // Set default selections
    this.productInfo.selectedSize = this.productInfo.sizes[2] || this.productInfo.sizes[0] || '40';
    this.productInfo.selectedColor = this.productInfo.colors[0].name || 'Green';
  }

  getColorClass(colorName) {
    const colorMap = {
      'black': 'vitron-color-black',
      'blue': 'vitron-color-blue',
      'pink': 'vitron-color-pink',
      'purple': 'vitron-color-purple',
      'green': 'vitron-color-green',
      'red': 'vitron-color-red',
      'white': 'vitron-color-white'
    };
    
    const lowerColor = colorName.toLowerCase();
    for (const [key, className] of Object.entries(colorMap)) {
      if (lowerColor.includes(key)) {
        return className;
      }
    }
    return 'vitron-color-black'; // default
  }

  extractRating() {
    const ratingElement = document.querySelector('.rating, .product-rating, [class*="rating"]');
    if (ratingElement) {
      const ratingText = ratingElement.textContent;
      const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
      if (ratingMatch) {
        this.productInfo.rating = parseFloat(ratingMatch[1]);
      }
      
      const reviewsMatch = ratingText.match(/(\d+)\s*reviews?/i);
      if (reviewsMatch) {
        this.productInfo.reviews = parseInt(reviewsMatch[1]);
      }
    }
    
    // Default values if not found
    if (!this.productInfo.rating) {
      this.productInfo.rating = 4.2;
      this.productInfo.reviews = 42;
    }
  }

  async testConnection() {
    try {
      console.log('🔍 [DEBUG] Current server URL:', this.serverUrl);
      console.log('🔍 [DEBUG] Attempting to connect to:', `${this.serverUrl}/health`);
      
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      console.log('🔍 [DEBUG] Response status:', response.status);
      
      if (response.ok) {
        const healthData = await response.json();
        this.addLog('✅ Backend connection successful');
        this.addLog(`📊 API Status: ${healthData.status}`);
        console.log('✅ [DEBUG] Backend health check successful:', healthData);
      } else {
        const errorText = await response.text();
        console.error('❌ [DEBUG] Response error:', errorText);
        this.addLog('⚠️ Backend connection failed');
        console.warn('⚠️ [DEBUG] Backend health check failed:', response.status);
      }
    } catch (error) {
      this.addLog('❌ Backend connection error');
      console.error('❌ [DEBUG] Backend connection error:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        this.addLog('🔒 SSL Certificate Error: Please accept the certificate first');
        this.showNotification(
          `SSL Certificate Error. <a href="${this.serverUrl}/health" target="_blank" style="color:#fff;text-decoration:underline;">Click here</a> to accept the certificate, then reload this page.`,
          'error'
        );
      }
    }
  }

  autoSelectClothImage() {
    const productImage = document.querySelector('.product__media img, .product-image img, .featured-image img');
    if (productImage) {
      this.convertImageToFile(productImage.src, 'product-image.jpg').then(file => {
        this.clothImage = file;
        this.clothImageData = productImage.src;
        this.addLog('✅ Product image automatically selected as garment');
        console.log('✅ [DEBUG] Product image auto-selected as garment:', productImage.src);
      }).catch(error => {
        this.addLog('⚠️ Could not auto-select product image');
        console.error('⚠️ [DEBUG] Could not auto-select product image:', error);
      });
    }
  }

  async convertImageToFile(imageUrl, filename) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      console.error('Error converting image to file:', error);
      throw error;
    }
  }

  createTryOnInterface() {
    const tryOnHTML = `
      <div id="vitron-try-on-panel" class="vitron-try-on-panel" style="display: none;">
        <div class="vitron-try-on-overlay" onclick="vitronTryOn.closePanel()"></div>
        <div class="vitron-try-on-content">
          
          <!-- Header -->
          <div class="vitron-try-on-header">
            <div class="vitron-try-on-brand">
              <div class="vitron-try-on-logo">
                <svg width="48" height="40" viewBox="0 0 640 531" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M116.418 5.9701L43.7731 36.2141C2.75829 53.2895 -12.0078 103.878 13.3812 140.336L264.225 500.542C292.015 540.447 351.103 540.323 378.725 500.301L627.52 139.819C652.594 103.489 637.987 53.2963 597.334 36.0942L527.048 6.35272C499.679 -5.22834 467.977 1.82813 448.105 23.9245L373.445 106.939C345.77 137.712 297.528 137.712 269.852 106.939L194.989 23.6984C175.216 1.71236 143.717 -5.3949 116.418 5.9701Z" fill="url(#paint0_radial_645_1340)"/>
                  <defs>
                    <radialGradient id="paint0_radial_645_1340" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(485.104 16.358) rotate(109.29) scale(544.324 650.361)">
                      <stop stop-color="#EAA327"/>
                      <stop offset="0.291974" stop-color="#E48F74"/>
                      <stop offset="0.63998" stop-color="#A64AE6"/>
                      <stop offset="0.997875" stop-color="#2860D4"/>
                    </radialGradient>
                  </defs>
                </svg>
              </div>
              <div class="vitron-try-on-brand-text">
                <h3>Vitron</h3>
                <p>"See how it looks on you before buying"</p>
              </div>
            </div>
            <button class="vitron-try-on-close" onclick="vitronTryOn.closePanel()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <!-- Upload Screen -->
          <div class="vitron-screen vitron-upload-screen active" id="vitron-upload-screen">
            <div class="vitron-upload-left">
                <div class="vitron-upload-area" id="person-upload-area">
                  <div class="vitron-upload-placeholder">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M24 4L44 24L24 44L4 24L24 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>Click to upload</p>
                  <p>Or</p>
                  <p>drop image here</p>
                  </div>
                  <input type="file" id="person-image-input" accept="image/*" style="display: none;">
                </div>
              </div>

            <div class="vitron-upload-right">
              <div class="vitron-combined-info" id="vitron-combined-info">
                <!-- Combined instructions and product info will be populated here -->
              </div>
            </div>
          </div>

          <!-- Processing Screen -->
          <div class="vitron-screen vitron-processing-screen" id="vitron-processing-screen">
            <div class="vitron-processing-content">
              <div class="vitron-processing-logo">
                <div class="vitron-try-on-logo" style="margin: 0 auto;">
                  <svg width="48" height="40" viewBox="0 0 640 531" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M116.418 5.9701L43.7731 36.2141C2.75829 53.2895 -12.0078 103.878 13.3812 140.336L264.225 500.542C292.015 540.447 351.103 540.323 378.725 500.301L627.52 139.819C652.594 103.489 637.987 53.2963 597.334 36.0942L527.048 6.35272C499.679 -5.22834 467.977 1.82813 448.105 23.9245L373.445 106.939C345.77 137.712 297.528 137.712 269.852 106.939L194.989 23.6984C175.216 1.71236 143.717 -5.3949 116.418 5.9701Z" fill="url(#paint0_radial_645_1340)"/>
                    <defs>
                      <radialGradient id="paint0_radial_645_1340" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(485.104 16.358) rotate(109.29) scale(544.324 650.361)">
                        <stop stop-color="#EAA327"/>
                        <stop offset="0.291974" stop-color="#E48F74"/>
                        <stop offset="0.63998" stop-color="#A64AE6"/>
                        <stop offset="0.997875" stop-color="#2860D4"/>
                      </radialGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              
              <div class="loading-animation-widget" id="vitron-loading-widget">
                <div class="loading-dots-container">
                  <div class="loading-dot blue"></div>
                  <div class="loading-dot pink"></div>
                  <div class="loading-dot overlap"></div>
                </div>
              </div>
              <div class="vitron-progress-text">Processing...</div>
              <h2 class="vitron-processing-title" id="vitron-processing-title">Please wait your try on is getting ready</h2>
              <p class="vitron-processing-message" id="vitron-processing-message">Usually, it doesn't take this much time, please wait...</p>
              <div class="vitron-privacy-footer">
                <div class="vitron-privacy-left">
                  <span class="vitron-privacy-icon">🔒</span>
                  <span>Your data & photos are private and secure</span>
                </div>
                <div class="vitron-privacy-right">
                  <a href="#" onclick="return false;">Learn more about how Vitron works</a>
                </div>
              </div>
            </div>
          </div>

                    <!-- Result Screen -->
          <div class="vitron-screen vitron-result-screen" id="vitron-result-screen">
            <div class="vitron-result-left">
              <div class="vitron-result-image-container" id="vitron-result-container">
                <img src="" alt="Result image" class="vitron-result-image" id="vitron-result-image" style="display: none;">
                <div class="vitron-result-overlay">
                  <button class="vitron-result-action" id="vitron-zoom-btn" onclick="vitronTryOn.zoomImage()">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="2"/>
                      <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
                </div>
                <div class="vitron-result-placeholder" style="display: flex;">
                  <p>Result image</p>
                </div>
          </div>

              <!-- Action Buttons Row -->
              <div class="vitron-result-action-row">
                <button class="vitron-action-icon-btn vitron-download-btn" id="vitron-download-btn" title="Download">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <polyline points="8,10 12,14 16,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="12" y1="14" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                </button>
                
                <button class="vitron-action-icon-btn vitron-like-btn" id="vitron-like-btn" title="Like">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.5487 7.041 1.5487 8.5C1.5487 9.959 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39467C21.7563 5.72723 21.351 5.1208 20.84 4.61V4.61Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                
                <button class="vitron-action-icon-btn vitron-share-btn" id="vitron-share-btn" title="Share">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <polyline points="16,6 12,2 8,6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="vitron-result-right">
              <div class="vitron-result-product-info">
                <h2 class="vitron-product-title">REGULAR FIT BLACK T-SHIRT</h2>
                
                <div class="vitron-product-rating">
                  <div class="vitron-rating-stars">
                    ${this.generateStars(4.2)}
                  </div>
                  <span class="vitron-rating-text">42 reviews</span>
          </div>

                <div class="vitron-product-price">
                  <span class="vitron-current-price">Rs.1,250.00</span>
                  <span class="vitron-original-price">Rs.1,450</span>
                </div>
                
                <div class="vitron-product-description">
                  <h4>Description</h4>
                  <p>Soft, breathable cotton henley perfect for everyday wear. Features classic three-button design.</p>
                </div>
                
                <div class="vitron-product-layout">
                  <div class="vitron-product-details">
                    <div class="vitron-variant-section">
                      <label class="vitron-variant-label">
                        Size <span class="vitron-size-text">EU Men</span>
                        <span class="vitron-size-guide">Size guide</span>
                      </label>
                      <div class="vitron-size-options">
                        <button class="vitron-size-option" data-size="36">36</button>
                        <button class="vitron-size-option" data-size="38">38</button>
                        <button class="vitron-size-option selected" data-size="40">40</button>
                        <button class="vitron-size-option" data-size="42">42</button>
                        <button class="vitron-size-option" data-size="44">44</button>
                      </div>
                    </div>
                    
                    <div class="vitron-variant-section">
                      <label class="vitron-variant-label">Select Color : Green</label>
                      <div class="vitron-color-options">
                        <button class="vitron-color-option vitron-color-black selected" data-color="Black" title="Black"></button>
                        <button class="vitron-color-option vitron-color-blue" data-color="Blue" title="Blue"></button>
                        <button class="vitron-color-option vitron-color-pink" data-color="Pink" title="Pink"></button>
                        <button class="vitron-color-option vitron-color-purple" data-color="Purple" title="Purple"></button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="vitron-result-main-actions">
                  <button class="vitron-action-button vitron-exit-button" id="vitron-exit-btn">
                    Exit Try on
            </button>
                  
                  <button class="vitron-action-button vitron-cart-button" id="vitron-cart-btn">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="9" cy="21" r="1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="20" cy="21" r="1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M1 1H5L7.68 14.39C7.77144 14.8504 8.02191 15.264 8.38755 15.5583C8.75318 15.8526 9.2107 16.009 9.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
                    Add to cart
            </button>
                </div>
              </div>
          </div>

          </div>

            </div>
        
        <!-- Privacy Notice (outside container, below all screens) -->
        <div class="vitron-privacy-notice">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L3 3V8C3 10.5 5.5 13.5 8 14C10.5 13.5 13 10.5 13 8V3L8 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 8L7.5 9.5L10 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Your data & photos are private and secure <a href="#" onclick="alert('Learn more about Vitron privacy policy'); return false;">Learn more about how Vitron works</a></span>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', tryOnHTML);
    
    // Populate product info
    this.populateProductInfo();
  }

  populateProductInfo() {
    const combinedInfo = document.getElementById('vitron-combined-info');
    const resultProductInfo = document.getElementById('vitron-result-product-info');
    
    const combinedInfoHTML = `
      <div class="vitron-upload-instructions">
        <h3>Upload Image Instructions :</h3>
        <ul>
          <li>Upload a clear full-body photos in good lighting.</li>
          <li>Stand straight, avoid busy backgrounds for best results.</li>
          <li>For better result make sure the upload image has in good quality.</li>
        </ul>
      </div>
      
      <div class="vitron-product-section">
        <h2 class="vitron-product-title">REGULAR FIT BLACK T-SHIRT</h2>
        
        <div class="vitron-product-rating">
          <div class="vitron-rating-stars">
            ${this.generateStars(4.2)}
          </div>
          <span class="vitron-rating-text">42 reviews</span>
        </div>
        
        <div class="vitron-product-price">
          <span class="vitron-current-price">Rs.1,250.00</span>
          <span class="vitron-original-price">Rs.1,450</span>
        </div>
        
        <div class="vitron-product-layout">
          <div class="vitron-product-details">
            <div class="vitron-variant-section">
              <label class="vitron-variant-label">
                Size <span class="vitron-size-text">EU Men</span>
                <span class="vitron-size-guide">Size guide</span>
              </label>
              <div class="vitron-size-options">
                <button class="vitron-size-option" data-size="36">36</button>
                <button class="vitron-size-option" data-size="38">38</button>
                <button class="vitron-size-option selected" data-size="40">40</button>
                <button class="vitron-size-option" data-size="42">42</button>
                <button class="vitron-size-option" data-size="44">44</button>
              </div>
            </div>
            
            <div class="vitron-variant-section">
              <label class="vitron-variant-label">Select Color : Green</label>
              <div class="vitron-color-options">
                <button class="vitron-color-option vitron-color-black selected" data-color="Black" title="Black"></button>
                <button class="vitron-color-option vitron-color-blue" data-color="Blue" title="Blue"></button>
                <button class="vitron-color-option vitron-color-pink" data-color="Pink" title="Pink"></button>
                <button class="vitron-color-option vitron-color-purple" data-color="Purple" title="Purple"></button>
              </div>
            </div>
          </div>
          
          <div class="vitron-product-image-container">
            ${this.productInfo.image ? `<img src="${this.productInfo.image}" alt="REGULAR FIT BLACK T-SHIRT" class="vitron-product-image">` : ''}
          </div>
        </div>
        
        <button class="vitron-try-on-button" id="vitron-start-tryon-btn" ${!this.personImage || !this.clothImage ? 'disabled' : ''}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 2L18 10L10 18L2 10L10 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Try on
        </button>
      </div>
    `;
    
    if (combinedInfo) {
      combinedInfo.innerHTML = combinedInfoHTML;
    }
    if (resultProductInfo) {
      resultProductInfo.innerHTML = combinedInfoHTML.replace('Try on', 'Try Again');
    }
  }

  generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let starsHTML = '';
    
    for (let i = 0; i < fullStars; i++) {
      starsHTML += '<svg width="16" height="16" viewBox="0 0 16 16" fill="#fbbf24" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L10.09 5.26L15 6L11.5 9.42L12.18 15L8 12.74L3.82 15L4.5 9.42L1 6L5.91 5.26L8 1Z"/></svg>';
    }
    
    if (hasHalfStar) {
      starsHTML += '<svg width="16" height="16" viewBox="0 0 16 16" fill="#fbbf24" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L10.09 5.26L15 6L11.5 9.42L12.18 15L8 12.74V1Z"/></svg>';
    }
    
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      starsHTML += '<svg width="16" height="16" viewBox="0 0 16 16" fill="#e5e7eb" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L10.09 5.26L15 6L11.5 9.42L12.18 15L8 12.74L3.82 15L4.5 9.42L1 6L5.91 5.26L8 1Z"/></svg>';
    }
    
    return starsHTML;
  }

  bindEvents() {
    // File upload events
    this.setupFileUpload('person-image-input', 'person-upload-area', true);
    
    // Variant selection events
    this.setupVariantEvents();
    
    // Action button events
    this.setupActionEvents();
  }

  setupFileUpload(inputId, areaId, isPerson) {
    const input = document.getElementById(inputId);
    const area = document.getElementById(areaId);

    if (!input || !area) return;

    // Click to upload
    area.addEventListener('click', () => {
      input.click();
    });

    // Drag and drop
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('vitron-upload-area--dragover');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('vitron-upload-area--dragover');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('vitron-upload-area--dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0], isPerson);
      }
    });

    // File input change
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelect(e.target.files[0], isPerson);
      }
    });
  }

  handleFileSelect(file, isPerson) {
    if (!file.type.startsWith('image/')) {
      this.showNotification('Please select an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target.result;
      if (isPerson) {
        this.personImage = file;
        this.personImageData = imageData;
        this.updateUploadArea('person-upload-area', imageData);
        console.log('✅ [DEBUG] Person image uploaded:', file.name);
      }
      this.updateTryOnButtonState();
    };
    reader.readAsDataURL(file);
  }

  updateUploadArea(areaId, imageData) {
    const area = document.getElementById(areaId);
    if (!area) return;
    
    area.innerHTML = `
      <img src="${imageData}" alt="Uploaded image" class="vitron-uploaded-image">
      <div class="vitron-upload-overlay">
        <button class="vitron-upload-remove" onclick="vitronTryOn.removeImage('${areaId}')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;
  }

  removeImage(areaId) {
    const area = document.getElementById(areaId);
    const isPerson = areaId === 'person-upload-area';
    
    if (isPerson) {
      this.personImage = null;
      this.personImageData = null;
    }

    area.innerHTML = `
      <div class="vitron-upload-placeholder">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4L44 24L24 44L4 24L24 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Click to upload</p>
        <p>Or</p>
        <p>drop image here</p>
      </div>
    `;
    
    this.updateTryOnButtonState();
  }

  setupVariantEvents() {
    // Size selection
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('vitron-size-option')) {
        document.querySelectorAll('.vitron-size-option').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
        this.productInfo.selectedSize = e.target.dataset.size;
        
        // Update labels
        document.querySelectorAll('.vitron-variant-label').forEach(label => {
          if (label.textContent.includes('Size:')) {
            label.innerHTML = `Size: ${this.productInfo.selectedSize} <span class="vitron-size-guide">Size guide</span>`;
      }
    });
  }
    });

    // Color selection
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('vitron-color-option')) {
        document.querySelectorAll('.vitron-color-option').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
        this.productInfo.selectedColor = e.target.dataset.color;
        
        // Update labels
        document.querySelectorAll('.vitron-variant-label').forEach(label => {
          if (label.textContent.includes('Select Color:')) {
            label.textContent = `Select Color: ${this.productInfo.selectedColor}`;
          }
        });
      }
    });

    // Try on button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'vitron-start-tryon-btn' || e.target.closest('#vitron-start-tryon-btn')) {
        this.startTryOn();
      }
    });
  }

  setupActionEvents() {
    // Download button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'vitron-download-btn' || e.target.closest('#vitron-download-btn')) {
        this.downloadImage();
      }
    });

    // Like button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'vitron-like-btn' || e.target.closest('#vitron-like-btn')) {
        this.toggleLike();
      }
    });

    // Share button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'vitron-share-btn' || e.target.closest('#vitron-share-btn')) {
        this.shareResult();
      }
    });

    // Add to cart button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'vitron-cart-btn' || e.target.closest('#vitron-cart-btn')) {
        this.addToCart();
      }
    });

    // Exit button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'vitron-exit-btn' || e.target.closest('#vitron-exit-btn')) {
        this.exitTryOn();
      }
    });
  }

  updateTryOnButtonState() {
    const tryOnBtn = document.getElementById('vitron-start-tryon-btn');
    if (tryOnBtn) {
      const canTryOn = this.personImage && this.clothImage;
      tryOnBtn.disabled = !canTryOn;
      
      if (!canTryOn) {
        tryOnBtn.title = 'Please upload your photo to continue';
      } else {
        tryOnBtn.title = '';
      }
    }
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.vitron-screen').forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(`vitron-${screenName}-screen`);
    if (targetScreen) {
      targetScreen.classList.add('active');
      this.currentScreen = screenName;
    }
  }

  startTryOn() {
    if (!this.personImage || !this.clothImage) {
      this.showNotification('Please upload your photo to continue', 'error');
      return;
    }

    this.showScreen('processing');
    this.startProcessing();
  }

  startProcessing() {
    this.isProcessing = true;
    this.progressPercentage = 0;
    this.messageIndex = 0;
    
    // Initialize loading animation widget
    const loadingWidget = document.getElementById('vitron-loading-widget');
    if (loadingWidget) {
      // Reset any completion state
      loadingWidget.classList.remove('completed');
    }
    
    // Update progress and messages
    this.progressInterval = setInterval(() => {
      this.updateProgress();
    }, 150); // Slightly slower for smoother animation
    
    // Change messages every 3 seconds
    this.messageInterval = setInterval(() => {
      this.updateProcessingMessage();
    }, 3000);
    
    // Start actual upload and processing
    this.uploadAndProcess();
  }

  updateProgress() {
    // Animate progress from 0 to 100% for better visual appeal
    this.progressPercentage = Math.min(this.progressPercentage + 1, 100);
    
    // The gradient loader handles its own animation, no need for manual updates
  }

  updateProcessingMessage() {
    const messageElement = document.getElementById('vitron-processing-message');
    if (messageElement && this.messageIndex < this.processingMessages.length) {
      messageElement.textContent = this.processingMessages[this.messageIndex];
      this.messageIndex = (this.messageIndex + 1) % this.processingMessages.length;
    }
  }

  async uploadAndProcess() {
    try {
      const formData = new FormData();
      formData.append('person', this.personImage);
      formData.append('cloth', this.clothImage);

      const headers = {
        'Accept': 'application/json, image/*',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      console.log('🔍 [DEBUG] Sending request to:', `${this.serverUrl}/upload`);

      const response = await fetch(`${this.serverUrl}/upload`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        headers: headers
      });

      console.log('🔍 [DEBUG] Response status:', response.status);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.startsWith('image/')) {
          // Direct image stream
          const imageBlob = await response.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          this.resultImage = imageUrl;
          this.resultImageBlob = imageBlob;
          
          this.finishProcessing();
          
        } else {
          // JSON response
            const result = await response.json();
            
            if (result.success) {
              if (result.image_data) {
              // Base64 image data
                  const byteCharacters = atob(result.image_data);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: result.image_format || 'image/jpeg' });
                  
                  const blobUrl = URL.createObjectURL(blob);
                  this.resultImage = blobUrl;
                  this.resultImageBlob = blob;
                  
              this.finishProcessing();
                
              } else if (result.result_url) {
              // URL approach
                this.resultImage = result.result_url;
              this.finishProcessing();
                    } else {
              throw new Error('No image data received');
            }
              } else {
            throw new Error(result.error || 'Processing failed');
          }
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ [DEBUG] Upload error:', error);
      this.showNotification('Processing failed. Please try again.', 'error');
      this.stopProcessing();
      this.showScreen('upload');
    }
  }

  finishProcessing() {
    // Complete the loading animation widget
    const loadingWidget = document.getElementById('vitron-loading-widget');
    if (loadingWidget) {
      // Add completion class for the new gradient loader
      loadingWidget.classList.add('completed');
    }
    
    // Complete progress
    this.progressPercentage = 100;
    
    setTimeout(() => {
      this.stopProcessing();
      this.displayResult();
      this.showScreen('result');
      this.showNotification('Virtual try-on completed successfully!', 'success');
      
      // Fetch AI recommendations if enabled
      if (this.aiModelEnabled && this.resultImage) {
        this.fetchAIRecommendations();
      } else {
        // Create containers with static data if AI is disabled
        this.createPostProcessingContainers();
      }
    }, 1000);
  }

  stopProcessing() {
    this.isProcessing = false;
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
  }

  createPostProcessingContainers() {
    // Remove existing containers if they exist
    const existingContainers = document.querySelectorAll('.vitron-post-processing-container');
    existingContainers.forEach(container => container.remove());

    // Generate AI pants recommendations based on the try-on result
    const pantsRecommendations = this.generateAIPantsRecommendations();

    // Create AI pants recommendations container only
    const containerHTML = `
      <div class="vitron-post-processing-containers">
        <!-- AI Product Recommendations Container -->
        <div class="vitron-post-processing-container vitron-ai-pants-container">
          <div class="vitron-container-header">
            <h3>View similar products</h3>
          </div>
          <div class="vitron-container-content">
            <div class="vitron-recommendation-header">
              <h4 class="vitron-recommendation-title">View similar products</h4>
            </div>
            <div class="vitron-recommendation-items">
              ${pantsRecommendations.map(pants => `
                <div class="vitron-recommendation-item" onclick="vitronTryOn.previewPantsRecommendation('${pants.id}')">
                  <div class="vitron-rec-image-placeholder">
                    ${pants.imageUrl ? 
                      `<img src="${pants.imageUrl}" alt="${pants.title}" class="vitron-ai-pants-image" />` : 
                      `<div class="vitron-pants-icon">👕</div>`
                    }
                  </div>
                  <div class="vitron-rec-details">
                    <span class="vitron-rec-title">${pants.title}</span>
                    <span class="vitron-rec-price">
                      ${pants.price}
                      <span class="vitron-rec-heart" onclick="event.stopPropagation(); vitronTryOn.toggleLike('${pants.id}')">🤍</span>
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Append containers inside the Vitron content area for visibility
    const vitronContent = document.querySelector('.vitron-try-on-content');
    if (vitronContent) {
      const containersDiv = document.createElement('div');
      containersDiv.innerHTML = containerHTML;
      
      // Insert at the end of the vitron content, inside the scrollable area
      vitronContent.appendChild(containersDiv.firstElementChild);
      
      // Add slide-in animation
      setTimeout(() => {
        const containers = document.querySelectorAll('.vitron-post-processing-container');
        containers.forEach((container, index) => {
          setTimeout(() => {
            container.classList.add('vitron-container-visible');
          }, index * 200);
        });
      }, 500);
      
      // Debug log to confirm containers are created
      console.log('🤖 AI Pants Recommendation containers created and appended inside Vitron content');
    }
  }

  toggleLike(productId) {
    const heartElement = document.querySelector(`[onclick*="${productId}"] .vitron-rec-heart`);
    if (heartElement) {
      heartElement.classList.toggle('liked');
      if (heartElement.classList.contains('liked')) {
        heartElement.textContent = '❤️';
        heartElement.style.color = '#ef4444';
      } else {
        heartElement.textContent = '🤍';
        heartElement.style.color = '#d1d5db';
      }
    }
  }

  animateProgressBars() {
    const progressBars = document.querySelectorAll('.vitron-progress-fill-multiple');
    if (progressBars.length === 0) return;

    // Animate each bar with different speeds
    progressBars.forEach((bar, index) => {
      const baseWidth = parseInt(bar.style.width) || 15;
      let currentWidth = baseWidth;
      
      const animate = () => {
        currentWidth += (Math.random() * 2 - 1) * 0.5; // Random small increment/decrement
        currentWidth = Math.max(0, Math.min(100, currentWidth)); // Keep between 0-100
        
        bar.style.width = currentWidth + '%';
        
        // Continue animation
        setTimeout(animate, 100 + Math.random() * 200);
      };
      
      animate();
    });
  }

  displayResult() {
    const resultImage = document.getElementById('vitron-result-image');
    const placeholder = document.querySelector('#vitron-result-container .vitron-result-placeholder');
    
    if (resultImage && this.resultImage) {
      resultImage.src = this.resultImage;
      resultImage.style.display = 'block';
      
      // Make result image clickable for preview
      resultImage.onclick = () => this.previewResult();
      resultImage.title = 'Click to preview in full size';
      
      if (placeholder) {
        placeholder.style.display = 'none';
      }
    }
  }

  previewResult() {
    if (!this.resultImage) return;

    const modal = document.createElement('div');
    modal.className = 'vitron-preview-modal';
    modal.innerHTML = `
      <div class="vitron-preview-overlay" onclick="this.parentElement.remove()"></div>
      <div class="vitron-preview-content">
        <button class="vitron-preview-close" onclick="this.parentElement.parentElement.remove()" title="Close preview">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          </button>
        <img src="${this.resultImage}" alt="Virtual Try-On Result Preview" class="vitron-preview-image">
        <div style="margin-top: 16px; text-align: center; color: #64748b; font-size: 14px;">
          <p>Virtual Try-On Result</p>
        </div>
      </div>
    `;
    
    // Add ESC key handler to close modal
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(modal);
    
    // Focus the modal for accessibility
    modal.focus();
  }

  // Action methods
  zoomImage() {
    if (!this.resultImage) return;

    const modal = document.createElement('div');
    modal.className = 'vitron-preview-modal';
    modal.innerHTML = `
      <div class="vitron-preview-overlay" onclick="this.parentElement.remove()"></div>
      <div class="vitron-preview-content">
        <button class="vitron-preview-close" onclick="this.parentElement.parentElement.remove()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <img src="${this.resultImage}" alt="Preview" class="vitron-preview-image">
      </div>
    `;

    document.body.appendChild(modal);
  }

  toggleLike() {
    this.isLiked = !this.isLiked;
    const likeBtn = document.getElementById('vitron-like-btn');
    if (likeBtn) {
      if (this.isLiked) {
        likeBtn.classList.add('liked');
        this.showNotification('Added to favorites!', 'success');
      } else {
        likeBtn.classList.remove('liked');
        this.showNotification('Removed from favorites', 'info');
      }
    }
  }

  shareResult() {
    if (!this.resultImage) {
      this.showNotification('No image to share', 'error');
      return;
    }

    // Create sharing options modal
    const modal = document.createElement('div');
    modal.className = 'vitron-share-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%;">
        <h3 style="margin: 0 0 20px 0; text-align: center;">Share your try-on result</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button onclick="vitronTryOn.shareToWhatsApp(); this.parentElement.parentElement.parentElement.remove();" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: none; border-radius: 8px; background: #25d366; color: white; cursor: pointer;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.6 2.4C12.1 0.9 10.1 0 8 0C3.6 0 0 3.6 0 8C0 9.4 0.4 10.8 1.1 12L0 16L4.1 14.9C5.3 15.5 6.6 15.8 8 15.8C12.4 15.8 16 12.2 16 7.8C16 5.7 15.1 3.7 13.6 2.4Z"/></svg>
            Share on WhatsApp
          </button>
          <button onclick="vitronTryOn.shareToFacebook(); this.parentElement.parentElement.parentElement.remove();" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: none; border-radius: 8px; background: #1877f2; color: white; cursor: pointer;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 11.993 2.92547 15.3027 6.75 15.9028V10.3125H4.71875V8H6.75V6.2375C6.75 4.2325 7.94438 3.125 9.77172 3.125C10.6467 3.125 11.5625 3.28125 11.5625 3.28125V5.25H10.5538C9.56 5.25 9.25 5.86672 9.25 6.5V8H11.4688L11.1141 10.3125H9.25V15.9028C13.0745 15.3027 16 11.993 16 8Z"/></svg>
            Share on Facebook
          </button>
          <button onclick="vitronTryOn.copyLink(); this.parentElement.parentElement.parentElement.remove();" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: none; border-radius: 8px; background: #6b7280; color: white; cursor: pointer;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.5 2H6.5C5.67157 2 5 2.67157 5 3.5V4H4C3.17157 4 2.5 4.67157 2.5 5.5V12.5C2.5 13.3284 3.17157 14 4 14H11C11.8284 14 12.5 13.3284 12.5 12.5V12H13.5C14.3284 12 15 11.3284 15 10.5V3.5C15 2.67157 14.3284 2 13.5 2Z"/></svg>
            Copy Link
        </button>
        </div>
        <button onclick="this.parentElement.parentElement.remove();" style="position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  downloadImage() {
    if (!this.resultImage) {
      this.showNotification('No image to download', 'error');
      return;
    }

      const link = document.createElement('a');
      link.href = this.resultImage;
      link.download = `vitron_tryon_${Date.now()}.jpg`;
    
    if (this.resultImage.startsWith('blob:')) {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    this.showNotification('Image download started!', 'success');
  }

  addToCart() {
    // Navigate to Shopify cart with the selected product variant
    const form = document.querySelector('form[action*="/cart/add"]');
    if (form) {
      // Update form with selected variant
      this.updateCartForm();
      
      // Close try-on panel
      this.closePanel();
      
      // Submit form or navigate to cart
      if (window.Shopify && window.Shopify.routes) {
        window.location.href = window.Shopify.routes.cart_url || '/cart';
      } else {
        window.location.href = '/cart';
      }
    } else {
      this.showNotification('Unable to add to cart', 'error');
    }
  }

  updateCartForm() {
    // Update the main product form with selected variants
    const sizeInputs = document.querySelectorAll('[name*="Size"], [name*="size"]');
    const colorInputs = document.querySelectorAll('[name*="Color"], [name*="color"]');
    
    sizeInputs.forEach(input => {
      if (input.value === this.productInfo.selectedSize) {
        input.checked = true;
        input.selected = true;
      }
    });
    
    colorInputs.forEach(input => {
      if (input.value === this.productInfo.selectedColor) {
        input.checked = true;
        input.selected = true;
      }
    });
  }

  exitTryOn() {
    this.showScreen('upload');
    this.resetTryOn();
  }

  resetTryOn() {
    // Reset result data
    if (this.resultImage && this.resultImage.startsWith('blob:')) {
      URL.revokeObjectURL(this.resultImage);
    }
    this.resultImage = null;
    this.resultImageBlob = null;
    this.isLiked = false;
    
    // Reset result display
    const resultImage = document.getElementById('vitron-result-image');
    const placeholder = document.querySelector('#vitron-result-container .vitron-result-placeholder');
    
    if (resultImage) {
      resultImage.style.display = 'none';
      resultImage.src = '';
    }
    if (placeholder) {
      placeholder.style.display = 'flex';
    }
  }

  shareToWhatsApp() {
    if (!this.resultImage) {
      this.showNotification('No image to share', 'error');
      return;
    }

    // Share the virtual try-on result image directly
    this.uploadResultImageForSharing()
      .then(shareableUrl => {
        const text = `Check out my virtual try-on result! ${this.productInfo.title || 'Product'}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareableUrl)}`;
        window.open(whatsappUrl, '_blank');
        this.showNotification('Opening WhatsApp...', 'success');
      })
      .catch(error => {
        console.error('Error sharing to WhatsApp:', error);
        // Fallback: share the image URL directly
        const text = `Check out my virtual try-on result! ${this.productInfo.title || 'Product'}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + this.resultImage)}`;
        window.open(whatsappUrl, '_blank');
        this.showNotification('Opening WhatsApp...', 'success');
      });
  }

  shareToFacebook() {
    if (!this.resultImage) {
      this.showNotification('No image to share', 'error');
      return;
    }

    // Share the virtual try-on result image directly
    this.uploadResultImageForSharing()
      .then(shareableUrl => {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
        window.open(facebookUrl, '_blank');
        this.showNotification('Opening Facebook...', 'success');
      })
      .catch(error => {
        console.error('Error sharing to Facebook:', error);
        // Fallback: share the image URL directly
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.resultImage)}`;
        window.open(facebookUrl, '_blank');
        this.showNotification('Opening Facebook...', 'success');
      });
  }

  async copyLink() {
    if (!this.resultImage) {
      this.showNotification('No image to share', 'error');
      return;
    }

    try {
      // Get shareable URL for the virtual try-on result image
      const shareableUrl = await this.uploadResultImageForSharing();
      await navigator.clipboard.writeText(shareableUrl);
      this.showNotification('Virtual try-on image link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying link:', error);
      try {
        // Fallback: copy the image URL directly
        await navigator.clipboard.writeText(this.resultImage);
        this.showNotification('Image link copied to clipboard!', 'success');
      } catch (fallbackError) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = this.resultImage;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showNotification('Image link copied to clipboard!', 'success');
      }
    }
  }

  async uploadResultImageForSharing() {
    try {
      console.log('🔍 [DEBUG] Uploading result image for sharing...');
      
      // If result image is already a URL (like Cloudinary), return it directly
      if (this.resultImage.startsWith('http')) {
        console.log('✅ [DEBUG] Result image is already a shareable URL:', this.resultImage);
        return this.resultImage;
      }
      
      // Convert result image to blob for upload
      const response = await fetch(this.resultImage);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('image', blob, 'vitron-result.jpg');
      formData.append('type', 'share');
      
      // Upload to server for sharing
      const uploadResponse = await fetch(`${this.serverUrl}/share`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`HTTP error! status: ${uploadResponse.status}`);
      }

      const result = await uploadResponse.json();
      
      if (result.share_url) {
        console.log('✅ [DEBUG] Image uploaded for sharing:', result.share_url);
        return result.share_url;
      } else {
        throw new Error('No share URL in response');
      }
      
    } catch (error) {
      console.error('❌ [DEBUG] Error uploading for sharing:', error);
      // Return the original image URL as fallback
      return this.resultImage;
    }
  }

  // Utility methods
  addLog(message) {
    this.logs += message + '\n';
    console.log(message);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `vitron-notification vitron-notification--${type}`;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('vitron-notification--show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('vitron-notification--show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
        document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  openPanel() {
    document.getElementById('vitron-try-on-panel').style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Update try-on button state
    this.updateTryOnButtonState();
  }

  closePanel() {
    document.getElementById('vitron-try-on-panel').style.display = 'none';
    document.body.style.overflow = '';
    
    // Stop processing if active
    if (this.isProcessing) {
      this.stopProcessing();
    }
    
    // Remove post-processing containers
    this.removePostProcessingContainers();
    
    // Show upload screen by default
    this.showScreen('upload');
  }

  removePostProcessingContainers() {
    const containers = document.querySelector('.vitron-post-processing-containers');
    if (containers) {
      containers.remove();
    }
  }

  // Generate AI pants recommendations based on the try-on result
  generateAIPantsRecommendations() {
    // Use real AI recommendations from Flask FashionCLIP model if available
    if (this.aiRecommendations && this.aiRecommendations.length > 0) {
      console.log('🤖 Using real AI recommendations from Flask FashionCLIP model');
      console.log(`📊 Found ${this.aiRecommendations.length} AI-generated recommendations`);
      
      // Use the already processed recommendations from fetchAIRecommendations
      return this.aiRecommendations.slice(0, 5);
    }

    // Fallback to static data if no AI recommendations
    return [
      {
        id: 'ai-pants-1',
        title: 'AI Recommended Jeans',
        price: 'Rs.2,499',
        match: 95,
        style: 'slim-fit',
        color: 'dark-blue'
      },
      {
        id: 'ai-pants-2',
        title: 'Smart Chinos',
        price: 'Rs.1,899',
        match: 88,
        style: 'regular-fit',
        color: 'khaki'
      },
      {
        id: 'ai-pants-3',
        title: 'Premium Trousers',
        price: 'Rs.3,299',
        match: 92,
        style: 'tailored',
        color: 'charcoal'
      },
      {
        id: 'ai-pants-4',
        title: 'Casual Joggers',
        price: 'Rs.1,599',
        match: 78,
        style: 'relaxed',
        color: 'gray'
      },
      {
        id: 'ai-pants-5',
        title: 'Designer Pants',
        price: 'Rs.4,199',
        match: 89,
        style: 'contemporary',
        color: 'black'
      }
    ];
  }

  // Preview pants recommendation in modal
  previewPantsRecommendation(pantsId) {
    const recommendations = this.generateAIPantsRecommendations();
    const pants = recommendations.find(p => p.id === pantsId);
    
    if (pants && pants.imageUrl) {
      this.showPantsRecommendationPopup(pants);
    } else {
      this.showNotification(`Selected: ${pants.title} - ${pants.match}% match`, 'info');
    }
  }

  // Show pants recommendation popup with add to cart and Try Full buttons
  showPantsRecommendationPopup(pants) {
    // Remove existing popup if any
    const existingPopup = document.getElementById('vitron-pants-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup HTML
    const popupHTML = `
      <div id="vitron-pants-popup" class="vitron-pants-popup-overlay">
        <div class="vitron-pants-popup-content">
          <div class="vitron-pants-popup-header">
            <h3>${pants.title}</h3>
            <button class="vitron-pants-popup-close" onclick="vitronTryOn.closePantsPopup()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          
          <div class="vitron-pants-popup-body">
            <div class="vitron-pants-image-container">
              <img src="${pants.imageUrl}" alt="${pants.title}" class="vitron-pants-popup-image">
              <div class="vitron-pants-match-badge">${pants.match}% match</div>
            </div>
            
            <div class="vitron-pants-info">
              <div class="vitron-pants-price">${pants.price}</div>
              <div class="vitron-pants-description">
                Perfect match for your style! This ${pants.title.toLowerCase()} complements your look beautifully.
              </div>
            </div>
          </div>
          
          <div class="vitron-pants-popup-actions">
            <button class="vitron-add-to-cart-btn" onclick="vitronTryOn.addPantsToCart('${pants.id}')">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 18C7.55228 18 8 17.5523 8 17C8 16.4477 7.55228 16 7 16C6.44772 16 6 16.4477 6 17C6 17.5523 6.44772 18 7 18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 18C16.5523 18 17 17.5523 17 17C17 16.4477 16.5523 16 16 16C15.4477 16 15 16.4477 15 17C15 17.5523 15.4477 18 16 18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M1 1H4L6.68 11.39C6.77144 11.8504 7.02191 12.264 7.38755 12.5583C7.75318 12.8526 8.2107 13.009 8.68 13H15.4C15.8693 13.009 16.3268 12.8526 16.6925 12.5583C17.0581 12.264 17.3086 11.8504 17.4 11.39L19 5H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Add to Cart
            </button>
            
            <button class="vitron-try-full-btn" onclick="vitronTryOn.startFullBodyTryOn('${pants.id}')">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2C11.1046 2 12 2.89543 12 4C12 5.10457 11.1046 6 10 6C8.89543 6 8 5.10457 8 4C8 2.89543 8.89543 2 10 2Z" stroke="currentColor" stroke-width="2"/>
                <path d="M10 6V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M6 8L10 6L14 8V12L10 10L6 12V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6 18L10 18L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              Try Full Body
            </button>
          </div>
        </div>
      </div>
    `;

    // Add popup to body
    document.body.insertAdjacentHTML('beforeend', popupHTML);

    // Add CSS styles for the popup
    this.addPantsPopupStyles();

    // Show popup with animation
    setTimeout(() => {
      const popup = document.getElementById('vitron-pants-popup');
      if (popup) {
        popup.classList.add('show');
      }
    }, 10);
  }

  // Close pants recommendation popup
  closePantsPopup() {
    const popup = document.getElementById('vitron-pants-popup');
    if (popup) {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.remove();
      }, 300);
    }
  }

  // Add CSS styles for pants popup
  addPantsPopupStyles() {
    // Check if styles already exist
    if (document.getElementById('vitron-pants-popup-styles')) {
      return;
    }

    const styles = `
      <style id="vitron-pants-popup-styles">
        .vitron-pants-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .vitron-pants-popup-overlay.show {
          opacity: 1;
        }

        .vitron-pants-popup-content {
          background: white;
          border-radius: 16px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          transform: scale(0.9);
          transition: transform 0.3s ease;
        }

        .vitron-pants-popup-overlay.show .vitron-pants-popup-content {
          transform: scale(1);
        }

        .vitron-pants-popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #eee;
        }

        .vitron-pants-popup-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .vitron-pants-popup-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background-color 0.2s;
          color: #666;
        }

        .vitron-pants-popup-close:hover {
          background-color: #f5f5f5;
          color: #333;
        }

        .vitron-pants-popup-body {
          padding: 24px;
        }

        .vitron-pants-image-container {
          position: relative;
          margin-bottom: 20px;
          border-radius: 12px;
          overflow: hidden;
          background: #f8f9fa;
        }

        .vitron-pants-popup-image {
          width: 100%;
          height: 300px;
          object-fit: cover;
          display: block;
        }

        .vitron-pants-match-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .vitron-pants-info {
          text-align: center;
        }

        .vitron-pants-price {
          font-size: 24px;
          font-weight: 700;
          color: #333;
          margin-bottom: 8px;
        }

        .vitron-pants-description {
          color: #666;
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .vitron-pants-popup-actions {
          display: flex;
          gap: 12px;
          padding: 0 24px 24px;
        }

        .vitron-add-to-cart-btn,
        .vitron-try-full-btn {
          flex: 1;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s ease;
          text-transform: none;
        }

        .vitron-add-to-cart-btn {
          background: #333;
          color: white;
        }

        .vitron-add-to-cart-btn:hover {
          background: #555;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .vitron-try-full-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          position: relative;
          overflow: hidden;
        }

        .vitron-try-full-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .vitron-try-full-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .vitron-try-full-btn:hover::before {
          left: 100%;
        }

        @media (max-width: 600px) {
          .vitron-pants-popup-content {
            width: 95%;
            margin: 20px;
          }

          .vitron-pants-popup-actions {
            flex-direction: column;
          }

          .vitron-add-to-cart-btn,
          .vitron-try-full-btn {
            width: 100%;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Start full body try-on process
  async startFullBodyTryOn(pantsId) {
    try {
      // Close the pants popup
      this.closePantsPopup();

      // Get the selected pants data
      const recommendations = this.generateAIPantsRecommendations();
      const selectedPants = recommendations.find(p => p.id === pantsId);
      
      if (!selectedPants) {
        this.showNotification('Selected pants not found', 'error');
        return;
      }

      // Check if we have the required data
      if (!this.resultImage) {
        this.showNotification('No half body image available for full body generation', 'error');
        return;
      }

      this.showNotification('Starting full body generation...', 'info');
      
      // Store the selected pants for full body processing
      this.selectedPantsForFullBody = selectedPants;
      
      // Show full body processing screen
      this.showFullBodyProcessingScreen();
      
      // Start the full body generation process
      await this.processFullBodyTryOn();
      
    } catch (error) {
      console.error('❌ Error starting full body try-on:', error);
      this.showNotification('Failed to start full body try-on', 'error');
    }
  }

  // Show full body processing screen
  showFullBodyProcessingScreen() {
    // Remove existing full body screen if any
    const existingScreen = document.getElementById('vitron-full-body-screen');
    if (existingScreen) {
      existingScreen.remove();
    }

    // Create full body processing screen HTML
    const fullBodyScreenHTML = `
      <div id="vitron-full-body-screen" class="vitron-full-body-overlay">
        <div class="vitron-full-body-content">
          <div class="vitron-full-body-header">
            <h2>Full Body Generation</h2>
            <button class="vitron-full-body-close" onclick="vitronTryOn.closeFullBodyScreen()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          
          <div class="vitron-full-body-processing">
            <div class="vitron-full-body-logo">
              <div class="vitron-try-on-logo">
                <svg width="48" height="40" viewBox="0 0 640 531" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M116.418 5.9701L43.7731 36.2141C2.75829 53.2895 -12.0078 103.878 13.3812 140.336L264.225 500.542C292.015 540.447 351.103 540.323 378.725 500.301L627.52 139.819C652.594 103.489 637.987 53.2963 597.334 36.0942L527.048 6.35272C499.679 -5.22834 467.977 1.82813 448.105 23.9245L373.445 106.939C345.77 137.712 297.528 137.712 269.852 106.939L194.989 23.6984C175.216 1.71236 143.717 -5.3949 116.418 5.9701Z" fill="url(#paint0_radial_645_1340)"/>
                  <defs>
                    <radialGradient id="paint0_radial_645_1340" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(485.104 16.358) rotate(109.29) scale(544.324 650.361)">
                      <stop stop-color="#EAA327"/>
                      <stop offset="0.291974" stop-color="#E48F74"/>
                      <stop offset="0.63998" stop-color="#A64AE6"/>
                      <stop offset="0.997875" stop-color="#2860D4"/>
                    </radialGradient>
                  </defs>
                </svg>
              </div>
            </div>
            
            <div class="loading-animation-widget" id="vitron-full-body-loading">
              <div class="loading-dots-container">
                <div class="loading-dot blue"></div>
                <div class="loading-dot pink"></div>
                <div class="loading-dot overlap"></div>
              </div>
            </div>
            
            <h3 class="vitron-full-body-title">Generating Full Body Try-On</h3>
            <p class="vitron-full-body-message" id="vitron-full-body-message">
              Processing your half body image with selected pants...
            </p>
            
            <div class="vitron-full-body-progress">
              <div class="vitron-full-body-progress-bar">
                <div class="vitron-full-body-progress-fill" id="vitron-full-body-progress"></div>
              </div>
              <div class="vitron-full-body-progress-text">
                <span id="vitron-full-body-percent">0%</span>
              </div>
            </div>
            
            <div class="vitron-privacy-footer">
              <div class="vitron-privacy-left">
                <span class="vitron-privacy-icon">🔒</span>
                <span>Your data & photos are private and secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to body
    document.body.insertAdjacentHTML('beforeend', fullBodyScreenHTML);

    // Add CSS styles for full body screen
    this.addFullBodyScreenStyles();

    // Show with animation
    setTimeout(() => {
      const screen = document.getElementById('vitron-full-body-screen');
      if (screen) {
        screen.classList.add('show');
      }
    }, 10);
  }

  // Close full body processing screen
  closeFullBodyScreen() {
    const screen = document.getElementById('vitron-full-body-screen');
    if (screen) {
      screen.classList.remove('show');
      setTimeout(() => {
        screen.remove();
      }, 300);
    }
  }

  // Add CSS styles for full body processing screen
  addFullBodyScreenStyles() {
    // Check if styles already exist
    if (document.getElementById('vitron-full-body-styles')) {
      return;
    }

    const styles = `
      <style id="vitron-full-body-styles">
        .vitron-full-body-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10001;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .vitron-full-body-overlay.show {
          opacity: 1;
        }

        .vitron-full-body-content {
          background: white;
          border-radius: 20px;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
          transform: scale(0.9);
          transition: transform 0.3s ease;
        }

        .vitron-full-body-overlay.show .vitron-full-body-content {
          transform: scale(1);
        }

        .vitron-full-body-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 30px 20px;
          border-bottom: 1px solid #eee;
        }

        .vitron-full-body-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .vitron-full-body-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background-color 0.2s;
          color: #666;
        }

        .vitron-full-body-close:hover {
          background-color: #f5f5f5;
          color: #333;
        }

        .vitron-full-body-processing {
          padding: 40px 30px;
          text-align: center;
        }

        .vitron-full-body-logo {
          margin-bottom: 30px;
        }

        .vitron-full-body-title {
          font-size: 22px;
          font-weight: 600;
          color: #333;
          margin: 30px 0 15px;
        }

        .vitron-full-body-message {
          color: #666;
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 30px;
        }

        .vitron-full-body-progress {
          margin: 30px 0;
        }

        .vitron-full-body-progress-bar {
          width: 100%;
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .vitron-full-body-progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 4px;
          width: 0%;
          transition: width 0.3s ease;
        }

        .vitron-full-body-progress-text {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }

        @media (max-width: 600px) {
          .vitron-full-body-content {
            width: 95%;
            margin: 20px;
          }

          .vitron-full-body-processing {
            padding: 30px 20px;
          }

          .vitron-full-body-header {
            padding: 20px 20px 16px;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Process full body try-on with the Flask model
  async processFullBodyTryOn() {
    try {
      console.log('🚀 Starting full body try-on process...');
      console.log('📷 Half body image URL:', this.resultImage);
      console.log('👖 Selected pants:', this.selectedPantsForFullBody);

      // Update progress and message
      this.updateFullBodyProgress(10, 'Preparing URLs for full body generation...');

      // The full body model URL - use the /upload_tryon endpoint
      const fullBodyApiUrl = `${this.fullBodyApiUrl}/upload_tryon`; // Use the upload_tryon endpoint
      
      this.updateFullBodyProgress(30, 'Downloading images for full body processing...');

      // Download the Cloudinary images and convert to files
      const personFile = await this.convertImageToFile(this.resultImage, 'person.jpg');
      const pantsFile = await this.convertImageToFile(this.selectedPantsForFullBody.imageUrl, 'pants.jpg');

      this.updateFullBodyProgress(50, 'Sending files to full body model...');

      // Create FormData with files as your Flask API expects
      const formData = new FormData();
      formData.append('person', personFile);  // Half-body result as file
      formData.append('pants', pantsFile);    // Selected pants as file

      console.log('📤 Sending request to full body model:', fullBodyApiUrl);
      console.log('📋 Request data:');
      console.log('   👤 Person file (Half Body):', personFile.name, personFile.size, 'bytes');
      console.log('   👖 Pants file:', pantsFile.name, pantsFile.size, 'bytes');

      // Send request to your Flask full body model with files
      const response = await fetch(fullBodyApiUrl, {
        method: 'POST',
        body: formData,
      });

      this.updateFullBodyProgress(60, 'Full body model is processing...');

      console.log('🔍 [DEBUG] Full body response status:', response.status);
      console.log('🔍 [DEBUG] Full body response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // Get detailed error information from the server
        let errorMessage = `Full body API error: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error('❌ [DEBUG] Server error response:', errorText);
          
          // Try to parse as JSON for structured error
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage += ` - ${errorJson.error || errorJson.message || errorText}`;
          } catch (e) {
            errorMessage += ` - ${errorText}`;
          }
        } catch (e) {
          console.error('❌ [DEBUG] Could not read error response:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Full body result received:', result);

      this.updateFullBodyProgress(90, 'Finalizing full body result...');

      if (result.success && result.result_url) {
        // Store the full body result
        this.fullBodyResultImage = result.result_url;
        
        this.updateFullBodyProgress(100, 'Full body generation complete!');
        
        // Show success and display result
        setTimeout(() => {
          this.showFullBodyResult();
        }, 1000);
      } else {
        throw new Error('Invalid response from full body model');
      }

    } catch (error) {
      console.error('❌ Error processing full body try-on:', error);
      this.updateFullBodyProgress(0, 'Full body generation failed');
      this.showNotification('Full body generation failed. Please try again.', 'error');
      
      // Close the processing screen after a delay
      setTimeout(() => {
        this.closeFullBodyScreen();
      }, 2000);
    }
  }

  // Update full body processing progress
  updateFullBodyProgress(percentage, message) {
    const progressFill = document.getElementById('vitron-full-body-progress');
    const progressPercent = document.getElementById('vitron-full-body-percent');
    const progressMessage = document.getElementById('vitron-full-body-message');

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
    
    if (progressPercent) {
      progressPercent.textContent = `${percentage}%`;
    }
    
    if (progressMessage) {
      progressMessage.textContent = message;
    }
  }

  // Show full body result
  showFullBodyResult() {
    // Close the processing screen
    this.closeFullBodyScreen();

    // Remove existing result screen if any
    const existingResult = document.getElementById('vitron-full-body-result');
    if (existingResult) {
      existingResult.remove();
    }

    // Create full body result screen HTML
    const resultScreenHTML = `
      <div id="vitron-full-body-result" class="vitron-full-body-result-overlay">
        <div class="vitron-full-body-result-content">
          <div class="vitron-full-body-result-header">
            <h2>Full Body Try-On Result</h2>
            <button class="vitron-full-body-result-close" onclick="vitronTryOn.closeFullBodyResult()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          
          <div class="vitron-full-body-result-body">
            <div class="vitron-full-body-image-container">
              <img src="${this.fullBodyResultImage}" alt="Full Body Try-On Result" class="vitron-full-body-result-image">
              <div class="vitron-result-badge">✨ Full Body</div>
            </div>
            
            <div class="vitron-full-body-result-info">
              <h3>Your Complete Look!</h3>
              <p>Here's how you look with the selected pants in full body view. The AI has generated a complete outfit based on your half body try-on.</p>
              
              <div class="vitron-full-body-result-actions">
                <button class="vitron-download-full-btn" onclick="vitronTryOn.downloadFullBodyResult()">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 11V15C17 15.5304 16.7893 16.0391 16.4142 16.4142C16.0391 16.7893 15.5304 17 15 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <polyline points="7,9 10,12 13,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="10" y1="12" x2="10" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Download Image
                </button>
                
                <button class="vitron-share-full-btn" onclick="vitronTryOn.shareFullBodyResult()">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 6L9 12L4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Share Result
                </button>
                
                <button class="vitron-try-another-btn" onclick="vitronTryOn.tryAnotherFullBody()">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4V10C1 10.5304 1.21071 11.0391 1.58579 11.4142C1.96086 11.7893 2.46957 12 3 12H19M19 12L15 8M19 12L15 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Try Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to body
    document.body.insertAdjacentHTML('beforeend', resultScreenHTML);

    // Add CSS styles for result screen
    this.addFullBodyResultStyles();

    // Show with animation
    setTimeout(() => {
      const screen = document.getElementById('vitron-full-body-result');
      if (screen) {
        screen.classList.add('show');
      }
    }, 10);

    // Show success notification
    this.showNotification('Full body try-on completed successfully!', 'success');
  }

  // Close full body result screen
  closeFullBodyResult() {
    const screen = document.getElementById('vitron-full-body-result');
    if (screen) {
      screen.classList.remove('show');
      setTimeout(() => {
        screen.remove();
      }, 300);
    }
  }

  // Add CSS styles for full body result screen
  addFullBodyResultStyles() {
    // Check if styles already exist
    if (document.getElementById('vitron-full-body-result-styles')) {
      return;
    }

    const styles = `
      <style id="vitron-full-body-result-styles">
        .vitron-full-body-result-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10002;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .vitron-full-body-result-overlay.show {
          opacity: 1;
        }

        .vitron-full-body-result-content {
          background: white;
          border-radius: 20px;
          max-width: 800px;
          width: 95%;
          max-height: 95vh;
          overflow-y: auto;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.5);
          transform: scale(0.9);
          transition: transform 0.3s ease;
        }

        .vitron-full-body-result-overlay.show .vitron-full-body-result-content {
          transform: scale(1);
        }

        .vitron-full-body-result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 30px 20px;
          border-bottom: 1px solid #eee;
          background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
          border-radius: 20px 20px 0 0;
        }

        .vitron-full-body-result-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .vitron-full-body-result-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background-color 0.2s;
          color: #666;
        }

        .vitron-full-body-result-close:hover {
          background-color: rgba(255, 255, 255, 0.8);
          color: #333;
        }

        .vitron-full-body-result-body {
          display: flex;
          gap: 30px;
          padding: 30px;
        }

        .vitron-full-body-image-container {
          flex: 1;
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          background: #f8f9fa;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }

        .vitron-full-body-result-image {
          width: 100%;
          height: auto;
          min-height: 400px;
          object-fit: cover;
          display: block;
        }

        .vitron-result-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 25px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
        }

        .vitron-full-body-result-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .vitron-full-body-result-info h3 {
          font-size: 22px;
          font-weight: 700;
          color: #333;
          margin: 0 0 16px;
        }

        .vitron-full-body-result-info p {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
          flex: 1;
        }

        .vitron-full-body-result-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .vitron-download-full-btn,
        .vitron-share-full-btn,
        .vitron-try-another-btn {
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s ease;
          text-transform: none;
        }

        .vitron-download-full-btn {
          background: #333;
          color: white;
        }

        .vitron-download-full-btn:hover {
          background: #555;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .vitron-share-full-btn {
          background: #28a745;
          color: white;
        }

        .vitron-share-full-btn:hover {
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
        }

        .vitron-try-another-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .vitron-try-another-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 768px) {
          .vitron-full-body-result-content {
            width: 98%;
            margin: 10px;
          }

          .vitron-full-body-result-body {
            flex-direction: column;
            gap: 20px;
            padding: 20px;
          }

          .vitron-full-body-result-header {
            padding: 20px 20px 16px;
          }

          .vitron-full-body-result-actions {
            flex-direction: row;
            flex-wrap: wrap;
          }

          .vitron-download-full-btn,
          .vitron-share-full-btn,
          .vitron-try-another-btn {
            flex: 1;
            min-width: 120px;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Download full body result
  downloadFullBodyResult() {
    if (this.fullBodyResultImage) {
      const link = document.createElement('a');
      link.href = this.fullBodyResultImage;
      link.download = 'full-body-tryon-result.jpg';
      link.click();
      this.showNotification('Full body image downloaded!', 'success');
    }
  }

  // Share full body result
  shareFullBodyResult() {
    if (navigator.share && this.fullBodyResultImage) {
      navigator.share({
        title: 'My Full Body Try-On Result',
        text: 'Check out my virtual try-on result!',
        url: this.fullBodyResultImage
      }).then(() => {
        this.showNotification('Full body result shared!', 'success');
      }).catch((error) => {
        console.log('Error sharing:', error);
        this.copyToClipboard();
      });
    } else {
      this.copyToClipboard();
    }
  }

  // Copy full body result URL to clipboard
  copyToClipboard() {
    if (this.fullBodyResultImage) {
      navigator.clipboard.writeText(this.fullBodyResultImage).then(() => {
        this.showNotification('Full body result URL copied to clipboard!', 'success');
      }).catch((error) => {
        console.log('Error copying to clipboard:', error);
        this.showNotification('Unable to copy URL', 'error');
      });
    }
  }

  // Try another full body combination
  tryAnotherFullBody() {
    this.closeFullBodyResult();
    // Reset and show AI recommendations again
    this.createPostProcessingContainers();
    this.showNotification('Select another pants to try full body generation', 'info');
  }

  // Show pants preview modal
  showPantsPreview(pants) {
    const modal = document.createElement('div');
    modal.className = 'vitron-pants-preview-modal';
    modal.innerHTML = `
      <div class="vitron-preview-overlay" onclick="this.parentElement.remove()"></div>
      <div class="vitron-preview-content">
        <button class="vitron-preview-close" onclick="this.parentElement.parentElement.remove()" title="Close preview">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <img src="${pants.imageUrl}" alt="${pants.title}" class="vitron-preview-image" />
        <div class="vitron-preview-details">
          <h3>${pants.title}</h3>
          <p class="vitron-preview-price">${pants.price}</p>
          <p class="vitron-preview-match">${pants.match}% AI Match</p>
          <button class="vitron-preview-action" onclick="vitronTryOn.addPantsToCart('${pants.id}')">
            Add to Cart
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add animation
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector('.vitron-preview-content').style.transform = 'scale(1) translateY(0)';
    }, 10);
  }

  // Handle add to cart for pants
  addPantsToCart(pantsId) {
    const recommendations = this.generateAIPantsRecommendations();
    const pants = recommendations.find(p => p.id === pantsId);
    
    if (pants) {
      this.showNotification(`${pants.title} would be added to cart`, 'success');
      // Here you could integrate with actual Shopify cart API
      console.log('🛒 Adding to cart:', pants);
    }
  }

  // Test function to manually create containers for debugging
  testCreateContainers() {
    console.log('🧪 Testing AI Pants Recommendation containers...');
    this.createPostProcessingContainers();
  }

  // Test Flask AI integration with sample data
  async testFlaskAI() {
    console.log('🧪 Testing Flask AI integration...');
    console.log('🌐 Flask AI URL:', this.aiModelUrl);
    
    // Test with a sample Cloudinary URL (you can replace with actual result URL)
    const sampleImageUrl = 'https://res.cloudinary.com/dgcpvkbmw/image/upload/v1/vitron_results/sample_result.jpg';
    
    try {
      this.showNotification('Testing Flask AI connection...', 'info');
      
      const response = await fetch(`${this.aiModelUrl}/recommend_from_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: sampleImageUrl
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Flask AI test successful:', data);
        this.showNotification('Flask AI connection successful!', 'success');
        
        if (data.recommendations) {
          console.log(`📊 Received ${data.recommendations.length} recommendations from Flask`);
        }
      } else {
        console.log('❌ Flask AI test failed:', response.status);
        this.showNotification(`Flask AI test failed: ${response.status}`, 'error');
      }
    } catch (error) {
      console.error('❌ Flask AI test error:', error);
      this.showNotification('Flask AI connection failed', 'error');
    }
  }

  // Fetch AI recommendations from Flask model
  async fetchAIRecommendations() {
    try {
      console.log('🤖 Fetching AI pants recommendations from Flask backend...');
      console.log('🔗 Using result image URL:', this.resultImage);
      console.log('🌐 AI Model URL:', this.aiModelUrl);
      
      this.showNotification('Getting AI recommendations...', 'info');
      
      const response = await fetch(`${this.aiModelUrl}/recommend_from_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: this.resultImage
        })
      });

      if (!response.ok) {
        throw new Error(`Flask AI API responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Flask AI Recommendations received:', data);

      // Handle Flask backend response format
      if (data.success && data.recommendations && Array.isArray(data.recommendations)) {
        // Map Flask response to our expected format
        this.aiRecommendations = data.recommendations.map((item, index) => ({
          id: `ai_pants_${index + 1}`,
          title: this.extractPantsTitle(item.path),
          price: this.generatePrice(),
          imageUrl: item.image_url, // Use Cloudinary URL from Flask
          match: Math.round(item.score * 100), // Convert similarity score to percentage
          path: item.path,
          score: item.score
        }));
        
        console.log('🎯 Processed AI recommendations:', this.aiRecommendations);
        this.showNotification(`AI found ${this.aiRecommendations.length} matching pants!`, 'success');
        
        // Create containers with AI data
        this.createPostProcessingContainers();
      } else if (data.recommendations && Array.isArray(data.recommendations)) {
        // Handle response without success flag
        this.aiRecommendations = data.recommendations.map((item, index) => ({
          id: `ai_pants_${index + 1}`,
          title: this.extractPantsTitle(item.path),
          price: this.generatePrice(),
          imageUrl: item.image_url,
          match: Math.round(item.score * 100),
          path: item.path,
          score: item.score
        }));
        
        console.log('🎯 Processed AI recommendations (no success flag):', this.aiRecommendations);
        this.showNotification(`AI found ${this.aiRecommendations.length} matching pants!`, 'success');
        this.createPostProcessingContainers();
      } else {
        throw new Error('Invalid response format from Flask AI model');
      }

    } catch (error) {
      console.error('❌ Error fetching AI recommendations:', error);
      this.showNotification('AI recommendations unavailable, showing sample data', 'info');
      
      // Fallback to static data if AI fails
      this.aiRecommendations = [];
      this.createPostProcessingContainers();
    }
  }

  // Extract pants title from file path
  extractPantsTitle(filePath) {
    if (!filePath) return 'Stylish Pants';
    
    const filename = filePath.split('/').pop().split('\\').pop();
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '');
    
    // Convert filename to readable title
    return nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim() || 'Stylish Pants';
  }

  // Generate realistic prices
  generatePrice() {
    const prices = ['₹1,299', '₹1,899', '₹2,199', '₹2,599', '₹2,999', '₹3,299', '₹3,899'];
    return prices[Math.floor(Math.random() * prices.length)];
  }
}

// Global instance
let vitronTryOn;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  vitronTryOn = new VitronTryOn();
});

// Global function for opening the panel
function openVitronTryOn() {
  if (vitronTryOn) {
    vitronTryOn.openPanel();
  }
}

// Test function to show AI recommendations immediately
function testAIRecommendations() {
  if (vitronTryOn) {
    console.log('🧪 Creating AI Pants Recommendations for testing...');
    vitronTryOn.testCreateContainers();
  } else {
    console.log('❌ Vitron not initialized yet');
  }
}

// Test function to simulate AI recommendation fetch
function testAIFetch() {
  if (vitronTryOn) {
    // Set a sample result image for testing
    vitronTryOn.resultImage = 'https://via.placeholder.com/400x600/000000/FFFFFF/?text=Sample+Try-On';
    vitronTryOn.fetchAIRecommendations();
  } else {
    console.log('❌ Vitron not initialized yet');
  }
}

// Test function with mock AI data
function testAIWithMockData() {
  if (vitronTryOn) {
    console.log('🧪 Testing with mock AI data...');
    
    // Simulate AI response data
    vitronTryOn.aiRecommendations = [
      {
        path: "mock_pants_1.jpg",
        score: 0.95,
        image_data: "mock_base64_data",
        result_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        optimized_url: "https://res.cloudinary.com/demo/image/upload/c_limit,w_400/sample.jpg"
      },
      {
        path: "mock_pants_2.jpg", 
        score: 0.88,
        image_data: "mock_base64_data",
        result_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        optimized_url: "https://res.cloudinary.com/demo/image/upload/c_limit,w_400/sample.jpg"
      },
      {
        path: "mock_pants_3.jpg",
        score: 0.92,
        image_data: "mock_base64_data", 
        result_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        optimized_url: "https://res.cloudinary.com/demo/image/upload/c_limit,w_400/sample.jpg"
      },
      {
        path: "mock_pants_4.jpg",
        score: 0.78,
        image_data: "mock_base64_data",
        result_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", 
        optimized_url: "https://res.cloudinary.com/demo/image/upload/c_limit,w_400/sample.jpg"
      },
      {
        path: "mock_pants_5.jpg",
        score: 0.89,
        image_data: "mock_base64_data",
        result_url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        optimized_url: "https://res.cloudinary.com/demo/image/upload/c_limit,w_400/sample.jpg"
      }
    ];
    
    vitronTryOn.createPostProcessingContainers();
    console.log('✅ Mock AI recommendations created!');
  } else {
    console.log('❌ Vitron not initialized yet');
  }
}

// Setup guide for dual ngrok configuration
function showNgrokSetupGuide() {
  console.log(`
🚀 DUAL NGROK SETUP GUIDE:

📋 STEP 1: Start Your Models
   Terminal 1:
   cd /path/to/your/virtual-tryon-api
   python app.py  # Should run on port specified in your try-on API

   Terminal 2:
   cd /path/to/your/ai-recommendation-flask
   python app.py  # Should run on port 5001

📋 STEP 2: Setup Ngrok Tunnels
   Terminal 3 (Try-On API):
   ngrok http [your-tryon-port]  # e.g., ngrok http 8000
   Copy the https URL → Update vitron_api_url

   Terminal 4 (AI Recommendation):
   ngrok http 5001
   Copy the https URL → Update vitron_ai_model_url

📋 STEP 3: Update Shopify Settings
   Current Configuration:
   • Try-On API (Ngrok #1): ${vitronTryOn?.serverUrl || 'Not configured'}
   • AI Model API (Ngrok #2): ${vitronTryOn?.aiModelUrl || 'Not configured'}

📋 STEP 4: Test Both APIs
   testTryOnAPI()     // Test virtual try-on
   testAIFetch()      // Test AI recommendations
   testAIWithMockData() // Test with sample data
  `);
}

// Test the try-on API connection
function testTryOnAPI() {
  if (vitronTryOn) {
    console.log('🧪 Testing Try-On API (Ngrok #1)...');
    vitronTryOn.testConnection();
  } else {
    console.log('❌ Vitron not initialized yet');
  }
}