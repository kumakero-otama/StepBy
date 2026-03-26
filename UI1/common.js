// ==========================================
// StepBy - Common Javascript for all pages
// ==========================================

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
