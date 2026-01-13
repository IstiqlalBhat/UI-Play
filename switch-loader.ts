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
    const example = await import('./src/switch/index.ts');

    // Create controls panel
    createControlsPanel(example);
})();

function createControlsPanel(example: Record<string, unknown>) {
    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        :root {
            --glass-bg: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.2);
            --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            --liquid-metal-gradient: linear-gradient(135deg, #e0e0e0 0%, #ffffff 50%, #a0a0a0 100%);
            --liquid-metal-shadow: 
                inset 2px 2px 5px rgba(255, 255, 255, 0.8),
                inset -2px -2px 5px rgba(0, 0, 0, 0.2),
                5px 5px 10px rgba(0, 0, 0, 0.2);
            --text-color: #ffffff;
            --accent-color: #00f0ff; /* Neon Cyan for contrast */
        }

        body {
            font-family: 'Inter', sans-serif;
        }

        @keyframes panelSlideIn {
            from {
                opacity: 0;
                transform: translateX(30px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
        }

        @keyframes panelSlideOut {
            from {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
            to {
                opacity: 0;
                transform: translateX(30px) scale(0.95);
            }
        }
        
        @keyframes liquidFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        /* Main Panel - Liquid Glass */
        .ctrl-panel {
            position: fixed;
            top: 2rem;
            right: 2rem;
            z-index: 100;
            width: 320px;
            animation: panelSlideIn 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .ctrl-panel.hidden {
            pointer-events: none;
        }

        .ctrl-panel.hidden .ctrl-panel-inner {
            animation: panelSlideOut 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .ctrl-panel-inner {
            background: rgba(20, 20, 30, 0.65);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 24px;
            padding: 1.5rem;
            box-shadow: 
                0 20px 50px rgba(0, 0, 0, 0.5),
                inset 0 0 0 1px rgba(255, 255, 255, 0.1);
            overflow: hidden;
            position: relative;
        }
        
        /* Subtle chromatic aberration border effect */
        .ctrl-panel-inner::before {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: 24px;
            padding: 1px;
            background: linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.5), rgba(255,255,255,0.1));
            -webkit-mask: 
                linear-gradient(#fff 0 0) content-box, 
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
            opacity: 0.5;
        }

        /* Header */
        .ctrl-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ctrl-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--text-color);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: linear-gradient(90deg, #fff, #aaa, #fff);
            background-size: 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: liquidFlow 3s linear infinite;
        }

        .ctrl-close-btn {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            transition: color 0.2s;
        }
        
        .ctrl-close-btn:hover {
            color: #fff;
        }

        /* Controls Body */
        .ctrl-body {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
        }

        .ctrl-row {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .ctrl-label {
            font-size: 0.8rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.7);
            margin-left: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        /* Liquid Metal Slider */
        .ctrl-slider-container {
            position: relative;
            height: 24px;
            display: flex;
            align-items: center;
        }

        .ctrl-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 3px;
            outline: none;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
        }

        .ctrl-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: linear-gradient(135deg, #e0e0e0, #ffffff);
            cursor: pointer;
            box-shadow: 
                0 2px 5px rgba(0,0,0,0.4),
                inset 1px 1px 2px rgba(255,255,255,0.8),
                inset -1px -1px 2px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.4);
            transition: transform 0.1s;
        }
        
        .ctrl-slider::-webkit-slider-thumb:hover {
            transform: scale(1.1);
        }

        /* Liquid Metal Select */
        .ctrl-select-wrap {
            position: relative;
        }

        .ctrl-select {
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: #fff;
            font-size: 0.9rem;
            outline: none;
            appearance: none;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 
                inset 0 2px 4px rgba(0,0,0,0.2);
        }

        .ctrl-select:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .ctrl-select-arrow {
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            color: rgba(255, 255, 255, 0.5);
        }
        
        .ctrl-select option {
            background: #1a1a2e;
            color: white;
        }

        /* Liquid Metal Toggle */
        .ctrl-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(0, 0, 0, 0.2);
            padding: 0.5rem 0.75rem;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ctrl-toggle-status {
            font-size: 0.8rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.6);
            transition: color 0.3s;
        }
        
        .ctrl-toggle-status.on {
            color: var(--accent-color);
            text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
        }

        .ctrl-toggle {
            position: relative;
            width: 48px;
            height: 26px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 13px;
            cursor: pointer;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
            transition: background 0.3s;
        }
        
        .ctrl-toggle.on {
            background: rgba(0, 240, 255, 0.2);
        }

        .ctrl-toggle::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 22px;
            height: 22px;
            background: linear-gradient(135deg, #e0e0e0, #fff);
            border-radius: 50%;
            box-shadow: 
                0 2px 4px rgba(0,0,0,0.3),
                inset 1px 1px 2px rgba(255,255,255,0.9);
            transition: transform 0.3s cubic-bezier(0.5, 1.6, 0.4, 0.7);
        }

        .ctrl-toggle.on::after {
            transform: translateX(22px);
            background: linear-gradient(135deg, #fff, #00f0ff);
            box-shadow: 
                0 2px 5px rgba(0,0,0,0.3),
                0 0 10px rgba(0, 240, 255, 0.6),
                inset 1px 1px 2px rgba(255,255,255,0.9);
        }

        /* Toggle Button (Fab) */
        .ctrl-toggle-btn {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 56px;
            height: 56px;
            border-radius: 28px;
            border: none;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            color: white;
            cursor: pointer;
            z-index: 101;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 
                0 8px 32px 0 rgba(0, 0, 0, 0.37),
                inset 0 0 0 1px rgba(255, 255, 255, 0.1);
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .ctrl-toggle-btn:hover {
            transform: scale(1.1) rotate(90deg);
            background: rgba(255, 255, 255, 0.2);
            box-shadow: 
                0 10px 40px 0 rgba(0, 0, 0, 0.4),
                inset 0 0 0 1px rgba(255, 255, 255, 0.2);
        }
        
        .ctrl-panel:not(.hidden) ~ .ctrl-toggle-btn {
            transform: scale(0);
            opacity: 0;
            pointer-events: none;
        }

        .ctrl-color-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.25rem;
        }

        .ctrl-color-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.2);
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
        }

        .ctrl-color-btn:hover {
            transform: scale(1.1);
            border-color: rgba(255,255,255,0.5);
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        }

        .ctrl-color-btn::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.1) 100%);
            pointer-events: none;
        }

        .ctrl-color-picker-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
        }

        .ctrl-color-input {
            position: absolute;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
            z-index: 2;
        }

        .ctrl-color-custom-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            transition: all 0.2s;
        }

        .ctrl-color-custom-btn:hover {
            transform: scale(1.1) rotate(45deg);
            border-color: rgba(255,255,255,0.6);
        }

    `;
    document.head.appendChild(styleSheet);

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ctrl-toggle-btn';
    toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    `;

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'ctrl-panel';

    const panelInner = document.createElement('div');
    panelInner.className = 'ctrl-panel-inner';

    // Header
    const header = document.createElement('div');
    header.className = 'ctrl-header';
    header.innerHTML = `
        <div class="ctrl-title">Liquid Control</div>
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ctrl-close-btn';
    closeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    `;
    header.appendChild(closeBtn);
    panelInner.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'ctrl-body';

    const icons: Record<string, string> = {
        'Quality': '✨',
        'Light dir': '☀️',
        'Jelly Color': '💧',
        'Dark Mode': '🌘',
        'Blur': '🌫️',
    };

    for (const controls of Object.values(example)) {
        if (typeof controls === 'function' || !controls) continue;

        for (const [label, params] of Object.entries(controls as Record<string, SwitchControlParam>)) {
            const row = document.createElement('div');
            row.className = 'ctrl-row';

            if ('onToggleChange' in params && params.onToggleChange) {
                // Special layout for toggles
                const wrapper = document.createElement('div');
                wrapper.className = 'ctrl-toggle-row';

                const labelDiv = document.createElement('div');
                labelDiv.className = 'ctrl-label';
                labelDiv.innerHTML = `${icons[label] || '⚙️'} ${label}`;

                const status = document.createElement('span');
                status.className = `ctrl-toggle-status ${params.initial ? 'on' : ''}`;
                status.textContent = params.initial ? 'ON' : 'OFF';

                const toggle = document.createElement('div');
                toggle.className = `ctrl-toggle ${params.initial ? 'on' : ''}`;

                toggle.addEventListener('click', () => {
                    if (params.onToggleChange) {
                        const isOn = toggle.classList.toggle('on');
                        status.classList.toggle('on', isOn);
                        status.textContent = isOn ? 'ON' : 'OFF';
                        params.onToggleChange(isOn);
                    }
                });

                wrapper.appendChild(labelDiv);
                wrapper.appendChild(status);
                wrapper.appendChild(toggle);
                row.appendChild(wrapper);
            } else {
                // Standard label for other controls
                const labelEl = document.createElement('label');
                labelEl.className = 'ctrl-label';
                labelEl.innerHTML = `${icons[label] || '⚙️'} ${label}`;
                row.appendChild(labelEl);

                if ('onSliderChange' in params && params.onSliderChange) {
                    const sliderContainer = document.createElement('div');
                    sliderContainer.className = 'ctrl-slider-container';

                    const slider = document.createElement('input');
                    slider.type = 'range';
                    slider.className = 'ctrl-slider';
                    slider.min = `${params.min ?? 0}`;
                    slider.max = `${params.max ?? 1}`;
                    slider.step = `${params.step ?? 0.01}`;
                    slider.value = `${params.initial ?? 0}`;
                    slider.addEventListener('input', () => {
                        if (params.onSliderChange) params.onSliderChange(parseFloat(slider.value));
                    });

                    sliderContainer.appendChild(slider);
                    row.appendChild(sliderContainer);
                    params.onSliderChange(parseFloat(slider.value));
                }

                if ('onSelectChange' in params && params.onSelectChange && params.options) {
                    const selectWrap = document.createElement('div');
                    selectWrap.className = 'ctrl-select-wrap';

                    const select = document.createElement('select');
                    select.className = 'ctrl-select';
                    select.innerHTML = params.options.map((opt: string) => `<option value="${opt}">${opt}</option>`).join('');
                    select.value = (params.initial as string) ?? params.options[0];
                    select.addEventListener('change', () => {
                        if (params.onSelectChange) params.onSelectChange(select.value);
                    });

                    const arrow = document.createElement('div');
                    arrow.className = 'ctrl-select-arrow';
                    arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

                    selectWrap.appendChild(select);
                    selectWrap.appendChild(arrow);
                    row.appendChild(selectWrap);
                    params.onSelectChange(select.value);
                }

                if ('onColorChange' in params && params.onColorChange) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'ctrl-color-grid';

                    // Create a row of curated preset colors
                    const presets = [
                        [0.08, 0.5, 1],    // Blue
                        [1, 0.2, 0.2],     // Red
                        [0, 1, 0.5],       // Green
                        [1, 0.45, 0.075],  // Orange
                        [0.6, 0.3, 1],     // Purple
                        [1, 0, 0.5],       // Pink
                        [0.8, 0.8, 0.8],   // Silver
                        [1, 0.84, 0],      // Gold
                    ];

                    presets.forEach(color => {
                        const btn = document.createElement('button');
                        btn.className = 'ctrl-color-btn';
                        btn.style.background = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`;

                        btn.onclick = () => {
                            if (params.onColorChange) params.onColorChange(color as [number, number, number]);
                        };

                        wrapper.appendChild(btn);
                    });

                    // Add Custom Color Picker
                    const pickerWrapper = document.createElement('div');
                    pickerWrapper.className = 'ctrl-color-picker-wrapper';
                    pickerWrapper.title = 'Custom Color';

                    const customBtn = document.createElement('div');
                    customBtn.className = 'ctrl-color-custom-btn';
                    customBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

                    const colorInput = document.createElement('input');
                    colorInput.type = 'color';
                    colorInput.className = 'ctrl-color-input';
                    const initialColor = (params.initial as [number, number, number]) ?? [0.08, 0.5, 1];
                    colorInput.value = rgbToHex(initialColor);

                    colorInput.oninput = () => {
                        const color = hexToRgb(colorInput.value);
                        if (params.onColorChange) params.onColorChange(color);
                        customBtn.style.background = colorInput.value;
                        customBtn.innerHTML = ''; // Hide the plus icon when a color is chosen
                    };

                    pickerWrapper.appendChild(customBtn);
                    pickerWrapper.appendChild(colorInput);
                    wrapper.appendChild(pickerWrapper);

                    row.appendChild(wrapper);
                    params.onColorChange((params.initial as [number, number, number]) ?? [0.08, 0.5, 1]);
                }
            }

            body.appendChild(row);
        }
    }

    panelInner.appendChild(body);
    panel.appendChild(panelInner);
    document.body.appendChild(panel);
    document.body.appendChild(toggleBtn);

    // Toggle functionality
    const hidePanel = () => {
        panel.classList.add('hidden');
    };

    const showPanel = () => {
        panel.classList.remove('hidden');
    };

    toggleBtn.addEventListener('click', showPanel);
    closeBtn.addEventListener('click', hidePanel);
}

type SwitchControlParam = {
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
