import codecs
import re

src = r'p:\TG2026\UI1\map\Index.html'
with codecs.open(src, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Replace the drawer handle div to fix garbled text
drawer_html_regex = r'<div class="drawer-handle" id="drawer-handle-btn">.*?</div><div class="drawer-content" style="position: relative;">'
new_drawer_html = '<div class="drawer-handle" id="drawer-handle-btn"><i class="fas fa-chevron-down" id="drawer-chevron" style="font-size:12px; color:#8A9BB0;"></i><span id="drawer-handle-label" style="font-size:11px; color:#8A9BB0; font-weight:600;">メニューを閉じる</span></div><div class="drawer-content" style="position: relative;">'
text = re.sub(drawer_html_regex, new_drawer_html, text, flags=re.DOTALL)

# Replace the script block for drawer handle
script_regex = r'<script>\s*// [^\n]*\s*\(function\(\) \{\s*(?:const|let|var) handle = document\.querySelector\(\'\.drawer-handle\'\);.*?\n\s*\}\)\(\);\s*</script>'

new_script = '''<script>
        // Drawer toggle
        (function() {
            const handle = document.getElementById('drawer-handle-btn');
            const content = document.querySelector('.drawer-content');
            if (!handle || !content) return;
            let _closed = false;
            handle.style.cursor = 'pointer';
            content.style.display = 'block';
            content.style.maxHeight = '500px';
            content.style.overflow = 'hidden';
            handle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                _closed = !_closed;
                const chevron = document.getElementById('drawer-chevron');
                const label = document.getElementById('drawer-handle-label');
                content.style.transition = 'max-height 0.35s ease, opacity 0.35s ease, padding 0.35s ease';
                if (_closed) {
                    content.style.maxHeight = '0px';
                    content.style.opacity = '0';
                    content.style.paddingTop = '0';
                    content.style.paddingBottom = '0';
                    setTimeout(() => { if (_closed) content.style.display = 'none'; }, 350);
                    if (chevron) chevron.className = 'fas fa-chevron-up';
                    if (label) label.textContent = 'メニューを開く';
                } else {
                    content.style.display = 'block';
                    // force layout calculation
                    content.offsetHeight;
                    content.style.maxHeight = '500px';
                    content.style.opacity = '1';
                    content.style.paddingTop = '';
                    content.style.paddingBottom = '';
                    if (chevron) chevron.className = 'fas fa-chevron-down';
                    if (label) label.textContent = 'メニューを閉じる';
                }
            });
        })();
    </script>'''

if re.search(script_regex, text, flags=re.DOTALL):
    text = re.sub(script_regex, new_script, text, flags=re.DOTALL)
    print('Script block replaced!')
else:
    print('Script block NOT FOUND! Trying simpler replace...')
    # simpler replace for the current state (it doesn't have the old string handle anymore, maybe it has getElementById now but the HTML has the ID?)
    script_regex_2 = r'<script>\s*// [^\n]*\s*\(function\(\) \{\s*const handle = document\.querySelector\(\'\.drawer-handle\'\);.*?\n\s*\}\)\(\);\s*</script>'
    if '<script>\n        // 繝峨Ο繝ｯ繝ｼ繝上Φ繝峨' in text:
        # Fallback to absolute split replace if regex fails
        start_idx = text.find('// 繝峨Ο繝ｯ繝ｼ繝上Φ繝峨')
        if start_idx > 0:
            start_script = text.rfind('<script>', 0, start_idx)
            end_script = text.find('</script>', start_idx) + 9
            text = text[:start_script] + new_script + text[end_script:]
            print("Force replaced by index!")
            
with codecs.open(src, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
