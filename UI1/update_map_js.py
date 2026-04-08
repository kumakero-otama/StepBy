import sys
import re

file_path = r'p:\TG2026\UI1\map\Index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make feature-scroll grid
old_css = '''        .feature-scroll {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding: 0 16px 20px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
        }'''
new_css = '''        .feature-scroll {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            padding: 0 16px 20px;
        }'''
content = content.replace(old_css, new_css)

content = content.replace("flex: 0 0 auto;\n            width: 100px;", "width: 100%;")

# Replace old record button logic
old_record_js = '''        // ===== Record button (prominent, outside panel) =====
        const btnRecordMain = document.getElementById('btn-record-main');
        const recordIcon = document.getElementById('record-icon');
        const recordLabel = document.getElementById('record-label');
        const toggleRecord = document.getElementById('toggle-record');
        let recordState = 'idle'; // idle → recording → paused

        if (btnRecordMain) {
            btnRecordMain.addEventListener('click', () => {
                if (recordState === 'idle') {
                    recordState = 'recording';
                    btnRecordMain.classList.add('recording');
                    btnRecordMain.classList.remove('paused');
                    recordIcon.className = 'fas fa-stop-circle';
                    recordLabel.textContent = '記録中';
                    if (toggleRecord) { toggleRecord.checked = true; toggleRecord.dispatchEvent(new Event('change')); }
                } else if (recordState === 'recording') {
                    recordState = 'paused';
                    btnRecordMain.classList.remove('recording');
                    btnRecordMain.classList.add('paused');
                    recordIcon.className = 'fas fa-pause-circle';
                    recordLabel.textContent = '一時停止';
                } else {
                    recordState = 'idle';
                    btnRecordMain.classList.remove('recording', 'paused');
                    recordIcon.className = 'fas fa-circle-dot';
                    recordLabel.textContent = '記録開始';
                    if (toggleRecord) { toggleRecord.checked = false; toggleRecord.dispatchEvent(new Event('change')); }
                }
            });
        }'''
new_record_js = '''        // ===== Record button =====
        const btnRecordMain = document.getElementById('btn-record-main');
        const btnRecordPause = document.getElementById('btn-record-pause');
        const recordIcon = document.getElementById('record-icon');
        const recordLabel = document.getElementById('record-label');
        const toggleRecord = document.getElementById('toggle-record');
        let recordState = 'idle';

        if (btnRecordMain && btnRecordPause) {
            btnRecordMain.addEventListener('click', () => {
                if (recordState === 'idle') {
                    recordState = 'recording';
                    btnRecordMain.classList.add('recording', 'active');
                    btnRecordMain.style.background = '#FF4B4B';
                    recordIcon.className = 'fas fa-stop-circle';
                    recordLabel.textContent = '記録終了';
                    btnRecordPause.disabled = false;
                    if (toggleRecord) { toggleRecord.checked = true; toggleRecord.dispatchEvent(new Event('change')); }
                } else {
                    recordState = 'idle';
                    btnRecordMain.classList.remove('recording', 'active');
                    btnRecordMain.style.background = '';
                    btnRecordPause.classList.remove('recording', 'active');
                    btnRecordPause.style.background = '';
                    btnRecordPause.style.color = '#2E9E8F';
                    recordIcon.className = 'fas fa-circle-dot';
                    recordLabel.textContent = '記録開始';
                    btnRecordPause.disabled = true;
                    btnRecordPause.querySelector('i').className = 'fas fa-pause-circle';
                    btnRecordPause.querySelector('span').textContent = '一時停止';
                    if (toggleRecord) { toggleRecord.checked = false; toggleRecord.dispatchEvent(new Event('change')); }
                }
            });

            btnRecordPause.addEventListener('click', () => {
                if (recordState === 'recording') {
                    recordState = 'paused';
                    btnRecordPause.classList.add('recording', 'active');
                    btnRecordPause.style.background = '#F5A623';
                    btnRecordPause.style.color = 'white';
                    btnRecordPause.querySelector('i').className = 'fas fa-play-circle';
                    btnRecordPause.querySelector('span').textContent = '再開';
                    if (toggleRecord) { toggleRecord.checked = false; toggleRecord.dispatchEvent(new Event('change')); }
                } else if (recordState === 'paused') {
                    recordState = 'recording';
                    btnRecordPause.classList.remove('recording', 'active');
                    btnRecordPause.style.background = '#fff';
                    btnRecordPause.style.color = '#2E9E8F';
                    btnRecordPause.querySelector('i').className = 'fas fa-pause-circle';
                    btnRecordPause.querySelector('span').textContent = '一時停止';
                    if (toggleRecord) { toggleRecord.checked = true; toggleRecord.dispatchEvent(new Event('change')); }
                }
            });
        }'''
content = content.replace(old_record_js, new_record_js)

# Splash session storage
old_splash_js = '''        // ===== Splash screen =====
        (function () {
            const splash = document.getElementById('splash');
            const particlesContainer = document.getElementById('splash-particles');

            for (let i = 0; i < 20; i++) {'''
new_splash_js = '''        // ===== Splash screen =====
        (function () {
            const splsh = sessionStorage.getItem('stepby_splash_done');
            if (splsh === 'true') {
                const s = document.getElementById('splash');
                if (s) s.remove();
                return;
            }
            sessionStorage.setItem('stepby_splash_done', 'true');
            
            const splash = document.getElementById('splash');
            const particlesContainer = document.getElementById('splash-particles');

            for (let i = 0; i < 20; i++) {'''
content = content.replace(old_splash_js, new_splash_js)

# Remove btn-post-road JS
content = re.sub(r'        // 投稿ボタン: マップ中心座標を渡す.*?_postBtn.*?}', '', content, flags=re.DOTALL)
content = re.sub(r'        // ドロワーハンドル: タップで開閉', r'        // ドロワーハンドル: タップで開閉', content)
content = re.sub(r'            // ボトムナビの「投稿」リンクにもピン座標を渡す.*?_navPostLink.*?}\);.*?}', '', content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
