import sys
import re

file_path = r'p:\TG2026\UI1\map\Index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update manifest link in head
content = re.sub(r'<title>StepBy[^\n]+地図</title>', r'<title>StepBy — バリアフリー地図</title>\n    <link rel="manifest" href="../manifest.webmanifest">\n    <meta name="theme-color" content="#2E9E8F">\n    <meta name="apple-mobile-web-app-capable" content="yes">\n    <meta name="apple-mobile-web-app-status-bar-style" content="default">\n    <link rel="apple-touch-icon" href="../assets/icon-192.png">', content)

# 2. Remove duplicate scripts in head (if any)
content = re.sub(r'<script src="../i18n\.js"></script><script src="../common\.js"></script>', '', content)

# 3. Update header-actions
old_header_actions = r'''            <div class="header-actions">
                <div class="settings-wrap">
                    <button class="header-action-btn" id="settings-toggle" aria-label="設定">
                        <i class="fas fa-cog"></i>
                    </button>
                    <div class="settings-dropdown" id="settings-dropdown">
                        <a href="../settings/display.html"><i class="fas fa-palette"></i> 表示設定</a>
                        <a href="#"><i class="fas fa-map-marked-alt"></i> 地図の設定</a>
                        <a href="../settings/language.html"><i class="fas fa-language"></i> 言語設定</a>
                        <a href="../help/Index.html"><i class="fas fa-circle-question"></i> ヘルプ</a>
                        <div class="version-label">StepBy UI1 v1.0.3</div>
                    </div>
                </div>
            </div>'''
new_header_actions = r'''            <div class="header-actions">
                <a href="../map/Index.html" class="header-action-btn" aria-label="マップ" style="background:rgba(255,255,255,0.28); border-color:rgba(255,255,255,0.4);">
                    <i class="fas fa-map"></i>
                </a>
                <div class="settings-wrap">
                    <button class="header-action-btn" id="settings-toggle" aria-label="設定">
                        <i class="fas fa-cog"></i>
                    </button>
                    <div class="settings-dropdown" id="settings-dropdown">
                        <a href="../settings/display.html"><i class="fas fa-palette"></i> 表示設定</a>
                        <a href="../settings/language.html"><i class="fas fa-language"></i> 言語設定</a>
                        <a href="../help/Index.html"><i class="fas fa-circle-question"></i> ヘルプ</a>
                    </div>
                </div>
                <a href="../profile/Index.html" class="header-action-btn" aria-label="プロフィール">
                    <i class="fas fa-user-circle"></i>
                </a>
            </div>'''
if old_header_actions in content:
    content = content.replace(old_header_actions, new_header_actions)
else:
    print("Warning: old_header_actions not found!")

# 4. Remove Quick nav chips
content = re.sub(r'        <!-- Quick nav chips -->.*?</div>\s+</div>', '', content, flags=re.DOTALL)

# 5. Remove search-float
content = re.sub(r'            <!-- Search \(narrower to leave room for GPS button\) -->.*?</div>\s+</div>', '', content, flags=re.DOTALL)

# 6. Remove Voice Nav button and toast
content = re.sub(r'            <!-- Voice Nav button -->.*?aria-live="polite\"></div>', '', content, flags=re.DOTALL)

# 7. Update drawer-cta
old_cta = r'''            <div class="drawer-cta">
                <button class="btn-record" id="btn-record-main" title="点字ブロック記録">
                    <i class="fas fa-circle-dot" id="record-icon"></i>
                    <span id="record-label">記録開始</span>
                </button>
                <button class="btn-cta-dream" style="flex:1" id="btn-post-road">
                    <i class="fas fa-camera"></i>
                    道の情報を投稿する
                </button>
            </div>'''
new_cta = r'''            <div class="drawer-cta" style="display:flex;gap:10px;">
                <button class="btn-record" id="btn-record-main" style="flex:1;">
                    <i class="fas fa-circle-dot" id="record-icon"></i>
                    <span id="record-label">記録開始/終了</span>
                </button>
                <button class="btn-record" id="btn-record-pause" style="flex:1; background:#fff; color:#2E9E8F; border:1.5px solid #2E9E8F;" disabled>
                    <i class="fas fa-pause-circle"></i>
                    <span>一時停止</span>
                </button>
            </div>'''
if old_cta in content:
    content = content.replace(old_cta, new_cta)
else:
    print("Warning: old_cta not found!")

# 8. Remove bottom nav
content = re.sub(r'        <!-- Bottom Nav -->\s*<nav class="bottom-nav">.*?</nav>', '', content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
