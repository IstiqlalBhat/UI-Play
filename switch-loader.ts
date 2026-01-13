// Canvas sizing with devicePixelRatio for crisp rendering
(async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;

    const onResize = () => {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
    };

    onResize();
    new ResizeObserver(onResize).observe(document.body);

    // Execute the switch demo
    // @ts-expect-error
    const example = await import('./src/switch/index.ts');

    // Create controls panel
    createControlsPanel(example, 'switch');
})();

function createControlsPanel(example: Record<string, unknown>, theme: 'switch' | 'slider') {
    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .controls-panel {
            position: fixed;
            top: 1.25rem;
            right: 1.25rem;
            z-index: 100;
            background: linear-gradient(135deg, rgba(15, 15, 30, 0.95) 0%, rgba(30, 30, 50, 0.9) 100%);
            backdrop-filter: blur(20px);
            padding: 0;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow:
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset,
                0 0 80px rgba(102, 126, 234, 0.15);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 0.875rem;
            color: white;
            min-width: 260px;
            max-width: 300px;
            overflow: hidden;
            animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .controls-header {
            padding: 1.25rem 1.25rem 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.1) 100%);
        }
        .controls-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 0.25rem;
        }
        .controls-subtitle {
            font-size: 1.1rem;
            font-weight: 600;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .controls-body {
            padding: 1rem 1.25rem 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .control-row {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            animation: fadeIn 0.4s ease backwards;
        }
        .control-row:nth-child(1) { animation-delay: 0.1s; }
        .control-row:nth-child(2) { animation-delay: 0.15s; }
        .control-row:nth-child(3) { animation-delay: 0.2s; }
        .control-row:nth-child(4) { animation-delay: 0.25s; }
        .control-row:nth-child(5) { animation-delay: 0.3s; }
        .control-label {
            font-weight: 500;
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.7);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .control-label-icon {
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
            border-radius: 6px;
            font-size: 0.7rem;
        }

        /* Custom Range Slider */
        .custom-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: linear-gradient(90deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
            outline: none;
            transition: all 0.2s ease;
        }
        .custom-slider:hover {
            background: linear-gradient(90deg, rgba(102, 126, 234, 0.5) 0%, rgba(118, 75, 162, 0.5) 100%);
        }
        .custom-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.2s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        .custom-slider::-webkit-slider-thumb:hover {
            transform: scale(1.15);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .custom-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            border: 2px solid rgba(255, 255, 255, 0.2);
        }

        /* Custom Select */
        .custom-select {
            padding: 0.65rem 1rem;
            border-radius: 10px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            outline: none;
        }
        .custom-select:hover {
            border-color: rgba(102, 126, 234, 0.5);
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%);
        }
        .custom-select:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        .custom-select option {
            background: #1a1a2e;
            color: white;
            padding: 0.5rem;
        }

        /* Custom Color Picker */
        .color-picker-wrapper {
            position: relative;
            width: 100%;
            height: 40px;
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.2s ease;
        }
        .color-picker-wrapper:hover {
            border-color: rgba(102, 126, 234, 0.5);
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.2);
        }
        .custom-color {
            width: 100%;
            height: 100%;
            border: none;
            cursor: pointer;
            padding: 0;
        }
        .custom-color::-webkit-color-swatch-wrapper {
            padding: 0;
        }
        .custom-color::-webkit-color-swatch {
            border: none;
            border-radius: 8px;
        }

        /* Custom Toggle */
        .toggle-wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .custom-toggle {
            position: relative;
            width: 48px;
            height: 26px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 13px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .custom-toggle::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .custom-toggle.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-color: transparent;
        }
        .custom-toggle.active::after {
            transform: translateX(22px);
            box-shadow: 0 2px 12px rgba(102, 126, 234, 0.5);
        }
        .toggle-hidden {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }
    `;
    document.head.appendChild(styleSheet);

    // Create panel
    const controlsPanel = document.createElement('div');
    controlsPanel.className = 'controls-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'controls-header';
    header.innerHTML = `
        <div class="controls-title">Settings</div>
        <div class="controls-subtitle">Jelly Switch</div>
    `;
    controlsPanel.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'controls-body';

    const icons: Record<string, string> = {
        'Quality': '✨',
        'Light dir': '☀️',
        'Jelly Color': '🎨',
        'Dark Mode': '🌙',
        'Blur': '💫',
    };

    for (const controls of Object.values(example)) {
        if (typeof controls === 'function' || !controls) continue;

        for (const [label, params] of Object.entries(controls as Record<string, ControlParam>)) {
            const row = document.createElement('div');
            row.className = 'control-row';

            const labelEl = document.createElement('label');
            labelEl.className = 'control-label';
            labelEl.innerHTML = `<span class="control-label-icon">${icons[label] || '⚙️'}</span>${label}`;
            row.appendChild(labelEl);

            if ('onSliderChange' in params) {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'custom-slider';
                slider.min = `${params.min ?? 0}`;
                slider.max = `${params.max ?? 1}`;
                slider.step = `${params.step ?? 0.01}`;
                slider.value = `${params.initial ?? 0}`;
                slider.addEventListener('input', () => params.onSliderChange(parseFloat(slider.value)));
                row.appendChild(slider);
                params.onSliderChange(parseFloat(slider.value));
            }

            if ('onSelectChange' in params) {
                const select = document.createElement('select');
                select.className = 'custom-select';
                select.innerHTML = params.options.map((opt: string) => `<option value="${opt}">${opt}</option>`).join('');
                select.value = params.initial ?? params.options[0];
                select.addEventListener('change', () => params.onSelectChange(select.value));
                row.appendChild(select);
                params.onSelectChange(select.value);
            }

            if ('onColorChange' in params) {
                const wrapper = document.createElement('div');
                wrapper.className = 'color-picker-wrapper';
                const input = document.createElement('input');
                input.type = 'color';
                input.className = 'custom-color';
                const initial = params.initial ?? [0, 0, 0];
                input.value = rgbToHex(initial);
                input.addEventListener('input', () => params.onColorChange(hexToRgb(input.value)));
                wrapper.appendChild(input);
                row.appendChild(wrapper);
                params.onColorChange(initial);
            }

            if ('onToggleChange' in params) {
                const wrapper = document.createElement('div');
                wrapper.className = 'toggle-wrapper';

                const toggleLabel = document.createElement('span');
                toggleLabel.style.cssText = 'font-size: 0.8rem; color: rgba(255,255,255,0.5);';
                toggleLabel.textContent = params.initial ? 'On' : 'Off';

                const toggle = document.createElement('div');
                toggle.className = `custom-toggle ${params.initial ? 'active' : ''}`;

                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'checkbox';
                hiddenInput.className = 'toggle-hidden';
                hiddenInput.checked = params.initial ?? false;

                toggle.addEventListener('click', () => {
                    hiddenInput.checked = !hiddenInput.checked;
                    toggle.classList.toggle('active', hiddenInput.checked);
                    toggleLabel.textContent = hiddenInput.checked ? 'On' : 'Off';
                    params.onToggleChange(hiddenInput.checked);
                });

                wrapper.appendChild(toggleLabel);
                wrapper.appendChild(toggle);
                row.appendChild(wrapper);
                params.onToggleChange(params.initial ?? false);
            }

            body.appendChild(row);
        }
    }

    controlsPanel.appendChild(body);
    document.body.appendChild(controlsPanel);
}

type ControlParam = {
    initial?: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    onSliderChange?: (v: number) => void;
    onSelectChange?: (v: string) => void;
    onColorChange?: (v: [number, number, number]) => void;
    onToggleChange?: (v: boolean) => void;
};

function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
    ];
}

function rgbToHex(rgb: readonly [number, number, number]): string {
    return '#' + rgb.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}
