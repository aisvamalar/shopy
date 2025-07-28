// Vitron Virtual Try-On Plugin
class VitronTryOn {
  constructor() {
    this.personImage = null;
    this.clothImage = null;
    this.resultImage = null;
    this.isProcessing = false;
    this.isAIMode = false;
    this.logs = '';
    this.currentUploadId = '';
    this.pollAttempts = 0;
    this.maxPollAttempts = 30;
    this.resultCheckTimer = null;
    
    // Get API configuration from Shopify settings
    this.serverUrl = window.vitronConfig?.apiUrl || 'https://39ce9373b459.ngrok-free.app';
    this.apiKey = window.vitronConfig?.apiKey || '';
    this.isEnabled = window.vitronConfig?.enabled !== false;
    
    this.init();
  }

  init() {
    this.createTryOnInterface();
    this.bindEvents();
    this.testConnection();
    this.autoSelectClothImage();
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
        this.addLog(`📊 Upload folder: ${healthData.upload_folder}`);
        this.addLog(`📊 Results folder: ${healthData.results_folder}`);
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
      
      // Handle SSL certificate errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        this.addLog('🔒 SSL Certificate Error: Please accept the certificate first');
        this.addLog('💡 Click the link below to accept the SSL certificate:');
        this.addLog(`🔗 <a href="${this.serverUrl}/health" target="_blank" style="color: #007bff; text-decoration: underline;">Accept SSL Certificate</a>`);
        
        // Show a clickable notification
        this.showNotification(
          `SSL Certificate Error. <a href="${this.serverUrl}/health" target="_blank" style="color:#fff;text-decoration:underline;">Click here</a> to accept the certificate, then reload this page.`,
          'error'
        );
      }
    }
  }

  autoSelectClothImage() {
    // Automatically select the current product image as cloth image
    const productImage = document.querySelector('.product__media img');
    if (productImage) {
      // Convert the product image to a file object
      this.convertImageToFile(productImage.src, 'product-image.jpg').then(file => {
        this.clothImage = file;
        this.clothImageData = productImage.src;
        this.updateUploadArea('cloth-upload-area', productImage.src);
        this.addLog('✅ Product image automatically selected as garment');
        console.log('✅ [DEBUG] Product image auto-selected as garment:', productImage.src);
        this.checkGenerateButtonState();
      }).catch(error => {
        this.addLog('⚠️ Could not auto-select product image');
        this.showNotification('Could not auto-select product image. Please upload a garment image manually.', 'error');
        console.error('⚠️ [DEBUG] Could not auto-select product image:', error);
        this.checkGenerateButtonState();
      });
    } else {
      this.addLog('⚠️ No product image found for auto-selection');
      this.showNotification('No product image found. Please upload a garment image manually.', 'error');
      console.warn('⚠️ [DEBUG] No product image found for auto-selection');
      this.checkGenerateButtonState();
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
    // Create the main try-on interface
    const tryOnHTML = `
      <div id="vitron-try-on-panel" class="vitron-try-on-panel" style="display: none;">
        <div class="vitron-try-on-overlay" onclick="vitronTryOn.closePanel()"></div>
        <div class="vitron-try-on-content">
          <!-- Header -->
          <div class="vitron-try-on-header">
            <div class="vitron-try-on-brand">
              <div class="vitron-try-on-logo">
                <div class="vitron-logo-gradient"></div>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 1L19 10L10 19" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="vitron-try-on-brand-text">
                <h3>Vitron</h3>
                <p>Virtual Try-On</p>
              </div>
            </div>
            <button class="vitron-try-on-close" onclick="vitronTryOn.closePanel()">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <!-- Mode Selection -->
          <div class="vitron-mode-selector">
            <div class="vitron-mode-tabs">
              <button class="vitron-mode-tab vitron-mode-tab--active" data-mode="virtual">
                Virtual try on
              </button>
              <button class="vitron-mode-tab" data-mode="ai">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 1L17 9L9 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Try Vitron AI
              </button>
            </div>
          </div>

          <!-- Image Upload Section -->
          <div class="vitron-upload-section">
            <div class="vitron-upload-row">
              <!-- Person Image Upload -->
              <div class="vitron-upload-column">
                <h4>Upload person image</h4>
                <p>Upload your full body image</p>
                <div class="vitron-upload-area" id="person-upload-area">
                  <div class="vitron-upload-placeholder">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M24 4L44 24L24 44L4 24L24 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>Drop image here</p>
                    <p>- or -</p>
                    <p>Click to upload</p>
                  </div>
                  <input type="file" id="person-image-input" accept="image/*" style="display: none;">
                </div>
              </div>

              <!-- Cloth Image Upload -->
              <div class="vitron-upload-column">
                <h4>Upload garment image</h4>
                <p>Select the product/cloth image</p>
                <div class="vitron-upload-area" id="cloth-upload-area">
                  <div class="vitron-upload-placeholder">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M24 4L44 24L24 44L4 24L24 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>Drop image here</p>
                    <p>- or -</p>
                    <p>Click to upload</p>
                  </div>
                  <input type="file" id="cloth-image-input" accept="image/*" style="display: none;">
                </div>
              </div>
            </div>
          </div>

          <!-- Generate Button -->
          <div class="vitron-generate-section">
            <button class="vitron-generate-btn" id="vitron-generate-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L22 12L12 22L2 12L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Generate</span>
            </button>
          </div>

          <!-- Result Section -->
          <div class="vitron-result-section">
            <div class="vitron-result-container" id="vitron-result-container">
              <div class="vitron-result-placeholder">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32 4L60 32L32 60L4 32L32 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>Generated image will be shown here</p>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="vitron-action-buttons" id="vitron-action-buttons" style="display: none;">
            <button class="vitron-action-btn vitron-preview-btn" id="vitron-preview-btn">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 1L19 10L10 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Preview
            </button>
            <button class="vitron-action-btn vitron-download-btn" id="vitron-download-btn">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 1L19 10L10 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Download
            </button>
          </div>

          <!-- Clear Button -->
          <div class="vitron-clear-section">
            <button class="vitron-clear-btn" onclick="vitronTryOn.clearAll()">
              Clear All
            </button>
          </div>

          <!-- Logs Section -->
          <div class="vitron-logs-section" id="vitron-logs-section" style="display: none;">
            <div class="vitron-logs-header">
              <h4>Processing Logs</h4>
              <button class="vitron-logs-close" onclick="vitronTryOn.toggleLogs()">×</button>
            </div>
            <div class="vitron-logs-content" id="vitron-logs-content"></div>
          </div>
        </div>
      </div>
    `;

    // Append to body
    document.body.insertAdjacentHTML('beforeend', tryOnHTML);
  }

  bindEvents() {
    // Mode switching
    document.querySelectorAll('.vitron-mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.switchMode(mode);
      });
    });

    // File upload events
    this.setupFileUpload('person-image-input', 'person-upload-area', true);
    this.setupFileUpload('cloth-image-input', 'cloth-upload-area', false);

    // Generate button
    const generateBtn = document.getElementById('vitron-generate-btn');
    generateBtn.addEventListener('click', () => {
      this.uploadAndProcess();
    });
    // Disable generate button until both images are selected
    generateBtn.disabled = true;

    // Enable generate button only when both images are selected
    const personInput = document.getElementById('person-image-input');
    const clothInput = document.getElementById('cloth-image-input');
    personInput.addEventListener('change', () => this.checkGenerateButtonState());
    clothInput.addEventListener('change', () => this.checkGenerateButtonState());

    // Action buttons
    document.getElementById('vitron-preview-btn').addEventListener('click', () => {
      this.previewImage();
    });

    document.getElementById('vitron-download-btn').addEventListener('click', () => {
      this.downloadImage();
    });
  }

  setupFileUpload(inputId, areaId, isPerson) {
    const input = document.getElementById(inputId);
    const area = document.getElementById(areaId);

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
      } else {
        this.clothImage = file;
        this.clothImageData = imageData;
        this.updateUploadArea('cloth-upload-area', imageData);
        console.log('✅ [DEBUG] Cloth image uploaded:', file.name);
      }
      this.checkGenerateButtonState();
    };
    reader.readAsDataURL(file);
  }

  updateUploadArea(areaId, imageData) {
    const area = document.getElementById(areaId);
    area.innerHTML = `
      <img src="${imageData}" alt="Uploaded image" class="vitron-uploaded-image">
      <div class="vitron-upload-overlay">
        <button class="vitron-upload-remove" onclick="vitronTryOn.removeImage('${areaId}')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
    } else {
      this.clothImage = null;
      this.clothImageData = null;
    }

    area.innerHTML = `
      <div class="vitron-upload-placeholder">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4L44 24L24 44L4 24L24 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Drop image here</p>
        <p>- or -</p>
        <p>Click to upload</p>
      </div>
    `;
  }

  switchMode(mode) {
    this.isAIMode = mode === 'ai';
    
    document.querySelectorAll('.vitron-mode-tab').forEach(tab => {
      tab.classList.remove('vitron-mode-tab--active');
      if (tab.dataset.mode === mode) {
        tab.classList.add('vitron-mode-tab--active');
      }
    });
  }

  async uploadAndProcess() {
    if (!this.personImage || !this.clothImage) {
      this.showNotification('Please select both person and garment images', 'error');
      return;
    }

    this.setProcessingState(true);
    this.showLogs();
    this.addLog('🚀 Starting virtual try-on process...');

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
      console.log('🔍 [DEBUG] Response content-type:', response.headers.get('content-type'));

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // Check if response is an image (Direct Image Stream approach)
        if (contentType && contentType.startsWith('image/')) {
          this.addLog('📸 Received direct image stream from backend');
          
          // Handle direct image stream
          const imageBlob = await response.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          
          // Store the blob URL
          this.resultImage = imageUrl;
          this.resultImageBlob = imageBlob; // Store blob for cleanup
          
          // Display the result
          this.fetchAndDisplayImageAsBlob(this.resultImage);
          
          // Log success details
          this.addLog('✅ Virtual try-on completed successfully');
          this.addLog(`📸 Image received as direct stream (${imageBlob.size} bytes)`);
          this.addLog(`🔗 Blob URL created: ${imageUrl}`);
          
          // Show success notification
          this.showNotification('Virtual try-on completed successfully!', 'success');
          
        } else {
          // Handle JSON response (Base64 Image Data approach)
          try {
            const result = await response.json();
            console.log('🔍 [DEBUG] Response data:', result);
            
            if (result.success) {
              // Check if we have base64 image data
              if (result.image_data) {
                this.addLog('📸 Received base64 image data from backend');
                
                try {
                  // Convert base64 to blob (exactly as Flask suggested)
                  const byteCharacters = atob(result.image_data);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: result.image_format || 'image/jpeg' });
                  
                  // Create blob URL
                  const blobUrl = URL.createObjectURL(blob);
                  
                  // Store the blob URL and blob for cleanup
                  this.resultImage = blobUrl;
                  this.resultImageBlob = blob;
                  
                  this.addLog('✅ Successfully converted base64 to blob');
                  this.addLog(`📸 Image format: ${result.image_format || 'image/jpeg'}`);
                  this.addLog(`📸 Blob size: ${blob.size} bytes`);
                  
                  // Display the result directly (no need for fetchAndDisplayImageAsBlob)
                  this.displayResult();
                  
                  // Log success details
                  this.addLog('✅ Virtual try-on completed successfully');
                  
                  if (result.upload_id) {
                    this.addLog(`🆔 Upload ID: ${result.upload_id}`);
                  }
                  
                  // Show success notification
                  this.showNotification('Virtual try-on completed successfully!', 'success');
                  
                } catch (base64Error) {
                  this.addLog(`❌ Error converting base64 to blob: ${base64Error.message}`);
                  this.showNotification('Error processing image data', 'error');
                }
                
              } else if (result.result_url) {
                // Fallback to URL approach if base64 is not available
                this.addLog(' Received image URL from backend (fallback)');
                
                // Store the image URL
                this.resultImage = result.result_url;
                
                // Validate and clean the URL
                if (!this.resultImage.startsWith('http')) {
                  this.addLog('❌ Invalid image URL format');
                  this.showNotification('Invalid image URL received from server', 'error');
                  return;
                }
                
                // Ensure the URL is complete (handle truncated URLs)
                if (this.resultImage.includes('cloudinary.com')) {
                  this.addLog('🔍 Processing Cloudinary URL...');
                  
                  // Store the original URL for fallback
                  this.originalImageUrl = this.resultImage;
                  
                  // Check if URL ends with a file extension
                  if (!this.resultImage.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    this.addLog('⚠️ Cloudinary URL appears incomplete, attempting to fix...');
                    
                    // Try different approaches to complete the URL
                    let completedUrl = this.resultImage;
                    
                    // If URL ends with a transformation parameter, add file extension
                    if (completedUrl.includes('/v1/') || completedUrl.includes('/v1753687045/')) {
                      completedUrl = completedUrl + '.jpg';
                    } else if (completedUrl.includes('w_800')) {
                      // If it has width parameter, ensure it has proper format
                      if (!completedUrl.includes('.jpg') && !completedUrl.includes('.png')) {
                        completedUrl = completedUrl + '.jpg';
                      }
                    } else {
                      // Try to extract the base URL and add proper transformation
                      const baseUrl = completedUrl.split('/upload/')[0] + '/upload/';
                      const path = completedUrl.split('/upload/')[1];
                      if (path) {
                        completedUrl = baseUrl + 'c_limit,f_auto,h_800,q_auto,w_800/' + path + '.jpg';
                      }
                    }
                    
                    this.resultImage = completedUrl;
                    this.addLog(`🔄 Attempting with completed URL: ${this.resultImage}`);
                  }
                }
                
                // Log the complete URL for debugging
                console.log('🔍 [DEBUG] Complete result URL:', this.resultImage);
                this.addLog(`🔍 [DEBUG] Complete result URL: ${this.resultImage}`);
                
                // Display the result using blob approach
                this.fetchAndDisplayImageAsBlob(this.resultImage);
                
                // Log success details
                this.addLog('✅ Virtual try-on completed successfully');
                this.addLog(`📸 Result URL: ${result.result_url}`);
                
                if (result.upload_id) {
                  this.addLog(`🆔 Upload ID: ${result.upload_id}`);
                }
                
                // Show success notification
                this.showNotification('Virtual try-on completed successfully!', 'success');
                
                // Log additional details for debugging
                if (result.original_url) {
                  this.addLog(`📸 Original URL: ${result.original_url}`);
                }
                if (result.optimized_url) {
                  this.addLog(`🔧 Optimized URL: ${result.optimized_url}`);
                }
                
              } else {
                this.addLog(`❌ Processing failed: ${result.error || 'No image data received'}`);
                this.showNotification('Processing failed. See logs for details.', 'error');
              }
              
            } else {
              this.addLog(`❌ Processing failed: ${result.error || 'Unknown error'}`);
              this.showNotification('Processing failed. See logs for details.', 'error');
            }
          } catch (jsonError) {
            this.addLog(`❌ Failed to parse JSON response: ${jsonError.message}`);
            this.showNotification('Invalid response format from server', 'error');
          }
        }
      } else {
        const errorText = await response.text();
        this.addLog(`❌ Upload failed with status: ${response.status}`);
        this.addLog(`❌ Error: ${errorText}`);
        this.showNotification('Upload failed. See logs for details.', 'error');
      }
    } catch (error) {
      this.addLog(`❌ Upload error: ${error.message}`);
      console.error('❌ [DEBUG] Upload error:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        this.addLog('🔒 Network Error: Check if the server is running and accessible');
        this.addLog(`🌐 Server URL: ${this.serverUrl}`);
        this.showNotification('Network error. Check server connection.', 'error');
      } else if (error.message.includes('CORS')) {
        this.addLog('🌐 CORS Error: The server may not be configured to accept requests from this domain.');
        this.showNotification('CORS Error: Backend not configured for this domain.', 'error');
      } else {
        this.showNotification('Upload error. See logs for details.', 'error');
      }
    } finally {
      this.setProcessingState(false);
    }
  }

  displayResult() {
    const container = document.getElementById('vitron-result-container');
    const actionButtons = document.getElementById('vitron-action-buttons');

    if (!this.resultImage) {
      this.addLog('❌ No result image available');
      this.showNotification('No result image available', 'error');
      return;
    }

    // Log the full URL for debugging
    console.log('🔍 [DEBUG] Displaying image URL:', this.resultImage);
    this.addLog(`🔍 [DEBUG] Full image URL: ${this.resultImage}`);

    // Create the result display with better error handling and loading states
    container.innerHTML = `
      <div class="vitron-result-image">
        <div class="vitron-image-loading" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #888;">
          <div style="text-align: center;">
            <div class="vitron-spinner" style="margin: 0 auto 16px;"></div>
            <p>Loading generated image...</p>
          </div>
        </div>
        <img 
          src="${this.resultImage}" 
          alt="Generated result" 
          style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: none;"
          onload="vitronTryOn.handleImageLoad(this)"
          onerror="vitronTryOn.handleImageError(this)"
        >
        <div class="vitron-result-overlay" style="display: none;">
          <div class="vitron-result-success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 4L6 11L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Generated
          </div>
          <button class="vitron-result-preview" onclick="vitronTryOn.previewImage()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 21H3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 3L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 15H21V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Show action buttons
    actionButtons.style.display = 'flex';
    
    // Log success
    this.addLog('✅ Result image received and displayed');
    this.addLog(`🌐 Image URL: ${this.resultImage}`);
    
    // Skip accessibility test for blob URLs to avoid HEAD request errors
    if (this.resultImage.startsWith('blob:')) {
      this.addLog('✅ Blob URL - skipping accessibility test to avoid HEAD request errors');
    } else {
      // Only test accessibility for non-blob URLs
      this.testImageAccessibility(this.resultImage).then(isAccessible => {
        if (isAccessible) {
          this.addLog('✅ Image accessibility test passed');
        } else {
          this.addLog('⚠️ Image accessibility test failed');
          this.createAlternativeImageDisplay(this.resultImage);
        }
      });
    }
  }

  async fetchAndDisplayImageAsBlob(imageUrl) {
    try {
      this.addLog('🔄 Fetching image as blob to bypass CORS...');
      
      // Try multiple CORS strategies
      const strategies = [
        // Strategy 1: Standard CORS request
        {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'image/*',
          }
        },
        // Strategy 2: No-cors mode (for images that don't support CORS)
        {
          method: 'GET',
          mode: 'no-cors',
          headers: {
            'Accept': 'image/*',
          }
        },
        // Strategy 3: Simple request without custom headers
        {
          method: 'GET',
          mode: 'cors'
        }
      ];
      
      let success = false;
      let lastError = null;
      
      for (let i = 0; i < strategies.length; i++) {
        try {
          this.addLog(`🔄 Trying CORS strategy ${i + 1}...`);
          
          const response = await fetch(imageUrl, strategies[i]);
          
          if (response.ok || response.type === 'opaque') {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // Store the blob URL and blob for cleanup
            this.resultImage = blobUrl;
            this.resultImageBlob = blob;
            
            this.addLog(`✅ Successfully fetched image as blob using strategy ${i + 1}`);
            this.displayResult();
            success = true;
            break;
          } else {
            this.addLog(`❌ Strategy ${i + 1} failed with status: ${response.status}`);
          }
        } catch (error) {
          lastError = error;
          this.addLog(`❌ Strategy ${i + 1} failed: ${error.message}`);
        }
      }
      
      if (!success) {
        this.addLog(`❌ All CORS strategies failed. Last error: ${lastError?.message}`);
        
        // Try the original URL as fallback
        if (imageUrl !== this.originalImageUrl && this.originalImageUrl) {
          this.addLog('🔄 Trying original URL as fallback...');
          this.fetchAndDisplayImageAsBlob(this.originalImageUrl);
        } else {
          // If all else fails, try to display the image directly without blob conversion
          this.addLog('🔄 Attempting direct image display...');
          this.displayImageDirectly(imageUrl);
        }
      }
    } catch (error) {
      this.addLog(`❌ Error in fetchAndDisplayImageAsBlob: ${error.message}`);
      
      // Try the original URL as fallback
      if (imageUrl !== this.originalImageUrl && this.originalImageUrl) {
        this.addLog('🔄 Trying original URL as fallback...');
        this.fetchAndDisplayImageAsBlob(this.originalImageUrl);
      } else {
        // If all else fails, try to display the image directly without blob conversion
        this.addLog('🔄 Attempting direct image display...');
        this.displayImageDirectly(imageUrl);
      }
    }
  }

  displayImageDirectly(imageUrl) {
    this.addLog('🔄 Attempting direct image display without blob conversion...');
    
    // Store the original URL
    this.resultImage = imageUrl;
    
    // Display the image directly
    this.displayResult();
    
    // Add a timeout to check if the image loads
    setTimeout(() => {
      const img = document.querySelector('#vitron-result-container img');
      if (img && img.complete && img.naturalHeight !== 0) {
        this.addLog('✅ Direct image display successful');
      } else {
        this.addLog('❌ Direct image display failed, showing alternative display');
        this.createAlternativeImageDisplay(imageUrl);
      }
    }, 3000);
  }

  handleImageLoad(imgElement) {
    console.log('✅ Image loaded successfully');
    this.addLog('✅ Image loaded successfully');
    
    // Hide loading spinner and show image
    const loadingDiv = imgElement.parentElement.querySelector('.vitron-image-loading');
    const overlay = imgElement.parentElement.querySelector('.vitron-result-overlay');
    
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (imgElement) imgElement.style.display = 'block';
    if (overlay) overlay.style.display = 'flex';
  }

  handleImageError(imgElement) {
    console.log('❌ Image failed to load');
    this.addLog('❌ Image failed to load');
    
    // Hide loading spinner
    const loadingDiv = imgElement.parentElement.querySelector('.vitron-image-loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
    
    // Show error message and alternative display
    this.createAlternativeImageDisplay(this.resultImage);
  }

  async testImageAccessibility(imageUrl) {
    // Skip testing for blob URLs entirely to avoid HEAD request errors
    if (imageUrl.startsWith('blob:')) {
      this.addLog('✅ Blob URL - skipping accessibility test');
      return true; // Assume blob URLs are accessible
    }
    
    // For regular URLs, use fetch with HEAD method
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        this.addLog('✅ Image URL is accessible');
        return true;
      } else {
        this.addLog(`⚠️ Image URL returned status: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.addLog(`❌ Image URL accessibility test failed: ${error.message}`);
      return false;
    }
  }

  createAlternativeImageDisplay(imageUrl) {
    const container = document.getElementById('vitron-result-container');
    
    // Create a fallback display with a download link
    container.innerHTML = `
      <div class="vitron-result-image" style="text-align: center; padding: 20px;">
        <div style="background: #f5f5f5; border: 2px dashed #ccc; border-radius: 8px; padding: 40px; margin: 20px 0;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 16px;">
            <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="#666"/>
          </svg>
          <h3 style="margin: 0 0 16px 0; color: #333;">Image Generated Successfully</h3>
          <p style="margin: 0 0 20px 0; color: #666;">The image was generated but cannot be displayed directly due to CORS restrictions.</p>
          <a href="${imageUrl}" target="_blank" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View Image in New Tab
          </a>
          <button onclick="vitronTryOn.downloadImage()" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-weight: 500; margin-left: 12px; cursor: pointer;">
            Download Image
          </button>
        </div>
      </div>
    `;
    
    this.addLog('✅ Alternative display created with download options');
  }

  previewImage() {
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
        <button class="vitron-preview-download" onclick="vitronTryOn.downloadImage(); this.parentElement.parentElement.remove()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 1L19 10L10 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  downloadImage() {
    if (!this.resultImage) return;

    // Handle both blob URLs and regular URLs
    if (this.resultImage.startsWith('blob:')) {
      // For blob URLs, create a download link
      const link = document.createElement('a');
      link.href = this.resultImage;
      link.download = `vitron_tryon_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // For regular URLs, download directly
      const link = document.createElement('a');
      link.href = this.resultImage;
      link.download = `vitron_tryon_${Date.now()}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    this.showNotification('Image download started!', 'success');
  }

  clearAll() {
    // Clean up blob URL if it exists
    if (this.resultImage && this.resultImage.startsWith('blob:') && this.resultImageBlob) {
      URL.revokeObjectURL(this.resultImage);
      this.resultImageBlob = null;
    }
    
    this.personImage = null;
    this.clothImage = null;
    this.personImageData = null;
    this.clothImageData = null;
    this.resultImage = null;
    this.logs = '';
    this.currentUploadId = '';
    this.isProcessing = false;
    this.pollAttempts = 0;

    // Reset UI
    this.removeImage('person-upload-area');
    this.removeImage('cloth-upload-area');
    
    // Re-select the product image as cloth
    this.autoSelectClothImage();
    
    const container = document.getElementById('vitron-result-container');
    container.innerHTML = `
      <div class="vitron-result-placeholder">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 4L60 32L32 60L4 32L32 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Generated image will be shown here</p>
      </div>
    `;

    document.getElementById('vitron-action-buttons').style.display = 'none';
    this.hideLogs();

    this.resultCheckTimer && clearInterval(this.resultCheckTimer);
  }

  setProcessingState(processing) {
    this.isProcessing = processing;
    const btn = document.getElementById('vitron-generate-btn');
    
    if (processing) {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="vitron-spinner"></div>
        <span>Processing...</span>
      `;
    } else {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L22 12L12 22L2 12L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Generate</span>
      `;
    }
  }

  addLog(message) {
    this.logs += message + '\n';
    const logsContent = document.getElementById('vitron-logs-content');
    if (logsContent) {
      logsContent.textContent = this.logs;
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  }

  showLogs() {
    document.getElementById('vitron-logs-section').style.display = 'block';
  }

  hideLogs() {
    document.getElementById('vitron-logs-section').style.display = 'none';
  }

  toggleLogs() {
    const logsSection = document.getElementById('vitron-logs-section');
    logsSection.style.display = logsSection.style.display === 'none' ? 'block' : 'none';
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
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  openPanel() {
    document.getElementById('vitron-try-on-panel').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  closePanel() {
    document.getElementById('vitron-try-on-panel').style.display = 'none';
    document.body.style.overflow = '';
  }

  checkGenerateButtonState() {
    const generateBtn = document.getElementById('vitron-generate-btn');
    const personReady = !!this.personImage;
    const clothReady = !!this.clothImage;
    generateBtn.disabled = !(personReady && clothReady);
    if (!personReady || !clothReady) {
      generateBtn.title = 'Please upload both person and garment images.';
      console.log('[DEBUG] Generate button disabled. personReady:', personReady, 'clothReady:', clothReady);
    } else {
      generateBtn.title = '';
      console.log('[DEBUG] Generate button enabled. Ready to generate.');
    }
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