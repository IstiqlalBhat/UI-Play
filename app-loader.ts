/// <reference types="@webgpu/types" />
/**
 * App Loader - Unified settings page with embedded Jelly UI components
 * Handles theme switching and slider value display
 */

import { initSwitch } from './src/switch-embed.ts';

// State management
let isDarkMode = true;
let sliderValue = 50;
let switchController: Awaited<ReturnType<typeof initSwitch>> | null = null;

// DOM Elements
const themeStatusEl = document.getElementById('theme-status') as HTMLSpanElement;
const speedStatusEl = document.getElementById('speed-status') as HTMLSpanElement;
const sliderValueEl = document.getElementById('slider-value') as HTMLSpanElement;
const switchLoadingEl = document.getElementById('switch-loading') as HTMLDivElement;
const sliderLoadingEl = document.getElementById('slider-loading') as HTMLDivElement;
const switchCanvas = document.getElementById('switch-canvas') as HTMLCanvasElement;
const sliderCanvas = document.getElementById('slider-canvas') as HTMLCanvasElement;

// Update theme
function updateTheme(dark: boolean) {
    isDarkMode = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

    // Update meta theme color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', dark ? '#0f0f1a' : '#f5f7fa');
    }

    // Update status badge
    if (themeStatusEl) {
        themeStatusEl.textContent = dark ? 'Dark Mode' : 'Light Mode';
        themeStatusEl.classList.toggle('active', dark);
    }

    // Update switch controller dark mode
    switchController?.setDarkMode(dark);
}

// Update slider value display
function updateSliderValue(percent: number) {
    sliderValue = Math.round(percent * 100);

    if (speedStatusEl) {
        speedStatusEl.textContent = `${sliderValue}%`;
    }

    if (sliderValueEl) {
        sliderValueEl.textContent = `${sliderValue}%`;
    }
}

// Initialize canvas sizing for embedded components
function initCanvas(canvas: HTMLCanvasElement): boolean {
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    return canvas.width > 0 && canvas.height > 0;
}

// Setup resize observer for a canvas
function setupCanvasResize(canvas: HTMLCanvasElement) {
    const resizeObserver = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
    });
    resizeObserver.observe(canvas.parentElement!);
    return resizeObserver;
}

// Hide loading overlay
function hideLoading(el: HTMLElement | null) {
    if (el) {
        el.classList.add('hidden');
    }
}

// Show error state
function showError(container: HTMLElement, message: string) {
    container.innerHTML = `
        <div class="webgpu-error">
            <h3>⚠️ WebGPU Required</h3>
            <p>${message}</p>
        </div>
    `;
}

// Check WebGPU support
async function checkWebGPU(): Promise<boolean> {
    if (!navigator.gpu) {
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

// Initialize the app
async function initApp() {
    // Check WebGPU support
    const hasWebGPU = await checkWebGPU();

    if (!hasWebGPU) {
        const errorMsg = 'Your browser does not support WebGPU. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.';

        if (switchCanvas?.parentElement) {
            showError(switchCanvas.parentElement, errorMsg);
        }
        if (sliderCanvas?.parentElement) {
            showError(sliderCanvas.parentElement, errorMsg);
        }
        return;
    }

    // Initialize switch canvas and component
    if (switchCanvas && initCanvas(switchCanvas)) {
        try {
            setupCanvasResize(switchCanvas);

            switchController = await initSwitch(switchCanvas, {
                onToggle: (isOn) => {
                    // When switch toggles, update theme
                    updateTheme(!isOn); // Switch ON = Light mode, OFF = Dark mode
                },
                onReady: () => {
                    hideLoading(switchLoadingEl);
                    console.log('Switch component ready');
                },
            });

            // Set initial state
            switchController.setDarkMode(isDarkMode);

        } catch (error) {
            console.error('Failed to load switch component:', error);
            if (switchCanvas.parentElement) {
                showError(switchCanvas.parentElement, 'Failed to load the switch component.');
            }
        }
    }

    // Initialize slider - using the original component via dynamic import
    if (sliderCanvas && initCanvas(sliderCanvas)) {
        try {
            setupCanvasResize(sliderCanvas);

            // For the slider, we'll just show a message for now since it's more complex
            // The slider component has its own event handling which we can hook into
            // @ts-ignore - dynamically modifying document before import
            const originalQuerySelector = document.querySelector.bind(document);

            // Temporarily override querySelector to return our specific canvas
            document.querySelector = (selector: string) => {
                if (selector === 'canvas') {
                    return sliderCanvas;
                }
                return originalQuerySelector(selector);
            };

            // Import slider module
            await import('./src/slider/index.ts');

            // Restore original querySelector
            document.querySelector = originalQuerySelector;

            // Track slider value from mouse position
            let isDragging = false;

            sliderCanvas.addEventListener('mousedown', () => {
                isDragging = true;
            });

            sliderCanvas.addEventListener('mouseup', () => {
                isDragging = false;
            });

            sliderCanvas.addEventListener('mouseleave', () => {
                isDragging = false;
            });

            sliderCanvas.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const rect = sliderCanvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    // Map x to percentage (slider range is roughly -1 to 0.9 in normalized space)
                    const percent = Math.max(0, Math.min(1, (x - 0.05) / 0.9));
                    updateSliderValue(percent);
                }
            });

            sliderCanvas.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    const rect = sliderCanvas.getBoundingClientRect();
                    const x = (e.touches[0].clientX - rect.left) / rect.width;
                    const percent = Math.max(0, Math.min(1, (x - 0.05) / 0.9));
                    updateSliderValue(percent);
                }
            });

            hideLoading(sliderLoadingEl);
            console.log('Slider component ready');

        } catch (error) {
            console.error('Failed to load slider component:', error);
            if (sliderCanvas.parentElement) {
                showError(sliderCanvas.parentElement, 'Failed to load the slider component.');
            }
        }
    }

    // Set initial values
    updateTheme(isDarkMode);
    updateSliderValue(0.5);
}

// Start the app
initApp().catch(console.error);
