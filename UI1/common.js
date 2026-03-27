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

// ===== Google翻訳 + カスタム言語ボタン =====
(function() {
    const LANGS = [
        { code: 'ja',    label: '🇯🇵 日本語' },
        { code: 'en',    label: '🇺🇸 English' },
        { code: 'hi',    label: '🇮🇳 हिंदी' },
        { code: 'zh-CN', label: '🇨🇳 中文' },
        { code: 'ko',    label: '🇰🇷 한국어' },
        { code: 'es',    label: '🇪🇸 Español' },
        { code: 'fr',    label: '🇫🇷 Français' },
        { code: 'ar',    label: '🇸🇦 العربية' },
    ];

    // Googleウィジェット用の非表示div
    window.googleTranslateElementInit = function() {
        new google.translate.TranslateElement({
            pageLanguage: 'ja',
            includedLanguages: 'en,hi,zh-CN,ko,es,fr,ar',
            autoDisplay: false
        }, 'google_translate_hidden');
    };

    // Google翻訳を起動する
    function triggerTranslate(langCode) {
        const tryTrigger = () => {
            const combo = document.querySelector('.goog-te-combo');
            if (combo) {
                combo.value = langCode;
                combo.dispatchEvent(new Event('change'));
            }
        };
        setTimeout(tryTrigger, 300);
        setTimeout(tryTrigger, 800);
        setTimeout(tryTrigger, 1500);
    }

    // カスタム言語ボタンを作成
    function createLangPicker() {
        const css = document.createElement('style');
        css.textContent = `
            /* Google翻訳のUIを完全非表示 */
            #google_translate_hidden, .goog-te-banner-frame,
            .goog-te-gadget-simple, .skiptranslate:not(#stepby-lang-picker):not(#stepby-lang-picker *) {
                display: none !important;
            }
            body { top: 0 !important; }

            /* カスタム言語ピッカー */
            #stepby-lang-picker {
                position: fixed;
                bottom: 80px;
                right: 12px;
                z-index: 99999;
            }
            #stepby-lang-btn {
                background: var(--primary, #2E9E8F);
                color: #fff;
                border: none;
                border-radius: 50px;
                padding: 10px 16px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 6px;
                font-family: inherit;
                transition: transform 0.15s;
            }
            #stepby-lang-btn:active { transform: scale(0.95); }
            #stepby-lang-dropdown {
                display: none;
                position: absolute;
                bottom: 48px;
                right: 0;
                background: #fff;
                border-radius: 14px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.18);
                overflow: hidden;
                min-width: 160px;
            }
            #stepby-lang-dropdown.open { display: block; }
            .stepby-lang-option {
                padding: 12px 16px;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                color: #333;
                transition: background 0.15s;
                font-family: inherit;
            }
            .stepby-lang-option:hover { background: #f5f5f5; }
            .stepby-lang-option.active { color: var(--primary, #2E9E8F); font-weight: 700; }
        `;
        document.head.appendChild(css);

        const picker = document.createElement('div');
        picker.id = 'stepby-lang-picker';

        const btn = document.createElement('button');
        btn.id = 'stepby-lang-btn';
        btn.innerHTML = '🌐 Language';

        const dropdown = document.createElement('div');
        dropdown.id = 'stepby-lang-dropdown';

        LANGS.forEach(lang => {
            const opt = document.createElement('div');
            opt.className = 'stepby-lang-option';
            opt.textContent = lang.label;
            opt.dataset.code = lang.code;
            opt.addEventListener('click', () => {
                dropdown.classList.remove('open');
                btn.innerHTML = '🌐 ' + lang.label;
                localStorage.setItem('UI1_language', lang.code);
                if (lang.code === 'ja') {
                    window.location.reload();
                } else {
                    triggerTranslate(lang.code);
                }
            });
            dropdown.appendChild(opt);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => dropdown.classList.remove('open'));

        picker.appendChild(dropdown);
        picker.appendChild(btn);
        document.body.appendChild(picker);

        // 保存済み言語を適用
        const saved = localStorage.getItem('UI1_language');
        if (saved && saved !== 'ja') {
            const found = LANGS.find(l => l.code === saved);
            if (found) btn.innerHTML = '🌐 ' + found.label;
            triggerTranslate(saved);
        }
    }

    // Google翻訳スクリプトを読み込む
    const hiddenDiv = document.createElement('div');
    hiddenDiv.id = 'google_translate_hidden';
    hiddenDiv.style.display = 'none';

    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';

    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(hiddenDiv);
        document.body.appendChild(script);
        createLangPicker();
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
