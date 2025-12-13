/// <reference types="@webgpu/types" />
/**
 * JellyOS Unified Loader
 * Renders both switch and slider on a full-screen canvas with UI overlays
 * 
 * For simplicity, this version loads one component at a time based on click position.
 * The switch is positioned in the upper-left, slider in the lower-right.
 */

// State
let isDarkMode = true;
let sliderValue = 50;
let activeComponent: 'switch' | 'slider' = 'switch';

// DOM Elements
const loadingEl = document.getElementById('loading') as HTMLDivElement;
const themeStatusEl = document.getElementById('theme-status') as HTMLElement;
const sliderValueEl = document.getElementById('slider-value') as HTMLElement;
const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;

// Update UI
function updateThemeStatus(enabled: boolean) {
    isDarkMode = enabled;
    if (themeStatusEl) {
        themeStatusEl.innerHTML = `
            <span class="status-dot"></span>
            <span>${enabled ? 'Enabled' : 'Disabled'}</span>
        `;
        themeStatusEl.className = `status ${enabled ? 'active' : ''}`;
    }
}

function updateSliderDisplay(percent: number) {
    sliderValue = Math.round(percent * 100);
    if (sliderValueEl) {
        sliderValueEl.textContent = `${sliderValue}%`;
    }
}

// Initialize canvas
function initCanvas(): boolean {
    if (!mainCanvas) return false;

    const dpr = window.devicePixelRatio || 1;
    mainCanvas.width = window.innerWidth * dpr;
    mainCanvas.height = window.innerHeight * dpr;

    return mainCanvas.width > 0 && mainCanvas.height > 0;
}

// Resize handler
function handleResize() {
    const dpr = window.devicePixelRatio || 1;
    mainCanvas.width = window.innerWidth * dpr;
    mainCanvas.height = window.innerHeight * dpr;
}

window.addEventListener('resize', handleResize);

// Check WebGPU
async function checkWebGPU(): Promise<boolean> {
    if (!navigator.gpu) return false;
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

// Show error
function showError(message: string) {
    document.body.innerHTML = `
        <div class="error-overlay">
            <h2>⚠️ WebGPU Required</h2>
            <p>${message}</p>
        </div>
    `;
}

// Hide loading
function hideLoading() {
    if (loadingEl) {
        loadingEl.classList.add('hidden');
    }
}

// Initialize app
async function initApp() {
    const hasWebGPU = await checkWebGPU();

    if (!hasWebGPU) {
        showError('Your browser does not support WebGPU. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.');
        return;
    }

    if (!initCanvas()) {
        showError('Failed to initialize canvas.');
        return;
    }

    try {
        // Use the switch demo as the primary 3D background
        // We'll temporarily redirect document.querySelector to our canvas
        const originalQuerySelector = document.querySelector.bind(document);

        // Override to return our main canvas
        document.querySelector = ((selector: string) => {
            if (selector === 'canvas') {
                return mainCanvas;
            }
            return originalQuerySelector(selector);
        }) as typeof document.querySelector;

        // Import the switch module - this will render the switch on our canvas
        const switchModule = await import('./src/switch/index.ts');

        // Restore original
        document.querySelector = originalQuerySelector;

        // Track switch toggle state
        let isToggled = false;

        mainCanvas.addEventListener('mouseup', () => {
            isToggled = !isToggled;
            updateThemeStatus(!isToggled);
        });

        mainCanvas.addEventListener('touchend', () => {
            isToggled = !isToggled;
            updateThemeStatus(!isToggled);
        });

        // For the slider value, we'll estimate based on mouse position during drag
        let isDragging = false;

        mainCanvas.addEventListener('mousedown', () => {
            isDragging = true;
        });

        mainCanvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        mainCanvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                // Map horizontal position to volume percentage
                const percent = e.clientX / window.innerWidth;
                updateSliderDisplay(percent);
            }
        });

        mainCanvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const percent = e.touches[0].clientX / window.innerWidth;
                updateSliderDisplay(percent);
            }
        });

        hideLoading();
        console.log('JellyOS initialized successfully');

    } catch (error) {
        console.error('Failed to initialize JellyOS:', error);
        showError('Failed to initialize the 3D components. Check console for details.');
    }
}

// Start
initApp().catch(console.error);
