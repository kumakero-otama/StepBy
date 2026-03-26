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
            // ドロップダウン内のクリックでは閉じさせないようにするが、
            // aタグのhref遷移は防がないため、stopPropagationのみ行う
            e.stopPropagation();
        });
    }
});
