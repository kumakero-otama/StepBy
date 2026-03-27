// ==========================================
// StepBy - Common Javascript for all pages
// ==========================================

// ===== テーマ・文字サイズを全ページに適用 =====
(function() {
    const theme = localStorage.getItem('UI1_theme') || 'light';
    const size = localStorage.getItem('UI1_fontSize') || 'medium';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
    }
    document.documentElement.setAttribute('data-font-size', size);
})();

// ===== Google翻訳ウィジェット（全ページ自動注入）=====
(function() {
    // ウィジェットを格納するdivを右下に作成
    const container = document.createElement('div');
    container.id = 'google_translate_element';
    container.style.cssText = [
        'position:fixed',
        'bottom:80px',
        'right:12px',
        'z-index:99999',
        'background:var(--primary,#2E9E8F)',
        'border-radius:50px',
        'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
        'overflow:hidden',
        'max-width:180px',
        'opacity:0.95',
    ].join(';');

    // Googleスタイル上書き（バナー非表示・フォント整理）
    const style = document.createElement('style');
    style.textContent = `
        #google_translate_element select {
            background: transparent;
            border: none;
            color: #fff;
            font-size: 13px;
            font-weight: 600;
            padding: 10px 12px;
            cursor: pointer;
            outline: none;
            font-family: inherit;
            -webkit-appearance: none;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23fff'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            padding-right: 28px;
        }
        #google_translate_element select option {
            color: #333;
            background: #fff;
        }
        /* Googleの翻訳バナーを非表示 */
        .goog-te-banner-frame, .skiptranslate { display: none !important; }
        body { top: 0 !important; }
        .goog-te-gadget { color: transparent !important; font-size: 0 !important; }
        .goog-te-gadget select { font-size: 13px !important; color: #fff !important; }
    `;

    window.googleTranslateElementInit = function() {
        new google.translate.TranslateElement({
            pageLanguage: 'ja',
            includedLanguages: 'en,hi,zh-CN,ko,es,fr,ar',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
        }, 'google_translate_element');
    };

    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';

    document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(style);
        document.body.appendChild(container);
        document.body.appendChild(script);
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    // ===== Settings dropdown (header) =====
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown');

    if (settingsToggle && settingsDropdown) {
        settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('open');
        });
    }

    document.addEventListener('click', () => {
        if (settingsDropdown) settingsDropdown.classList.remove('open');
    });

    if (settingsDropdown) {
        settingsDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
});
