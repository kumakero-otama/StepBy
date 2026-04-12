import re
import os

# 1. profile/Index.html - add onerror to fallback to fa-user
p_prof = r'p:\TG2026\UI1\profile\Index.html'
with open(p_prof, 'r', encoding='utf-8') as f:
    prof_html = f.read()
# Add onerror inside the created img in js
old_prof_js = r"const img = document.createElement('img');\s*img\.src = avatarUrl;\s*placeholder\.style\.display = 'none';"
new_prof_js = "const img = document.createElement('img');\n                    img.onerror = () => { img.style.display='none'; placeholder.style.display='flex'; };\n                    img.src = avatarUrl;\n                    placeholder.style.display = 'none';"
if 'img.onerror' not in prof_html:
    prof_html = re.sub(old_prof_js, new_prof_js, prof_html)
with open(p_prof, 'w', encoding='utf-8') as f:
    f.write(prof_html)

# 2. profile_edit/Index.html - load avatar on startup
p_prof_edit = r'p:\TG2026\UI1\profile_edit\Index.html'
with open(p_prof_edit, 'r', encoding='utf-8') as f:
    prof_edit = f.read()

avatar_logic_edit = r'''                    if (usernameInput && u.username) usernameInput.value = u.username;
                    // Add avatar loading
                    const avatarUrl = u.avatarUrl || u.avatar_url || u.photoURL || null;
                    if (avatarUrl) {
                        const iconPreviewImg = document.getElementById('icon-preview-img');
                        const iconDefaultIcon = document.getElementById('icon-default-icon');
                        const iconNoImageText = document.getElementById('icon-no-image-text');
                        if (iconPreviewImg) {
                            iconPreviewImg.onerror = () => { iconPreviewImg.style.display='none'; if(iconDefaultIcon) iconDefaultIcon.style.display='block'; };
                            iconPreviewImg.src = avatarUrl;
                            iconPreviewImg.style.display = 'block';
                            if(iconDefaultIcon) iconDefaultIcon.style.display = 'none';
                            if(iconNoImageText) iconNoImageText.style.display = 'none';
                        }
                    }'''
if 'Add avatar loading' not in prof_edit:
    prof_edit = prof_edit.replace('if (usernameInput && u.username) usernameInput.value = u.username;', avatar_logic_edit)
with open(p_prof_edit, 'w', encoding='utf-8') as f:
    f.write(prof_edit)

# 3. map.js - Update trace detail modal avatar to load if present, else fallback
p_map_js = r'p:\TG2026\UI1\map\map.js'
with open(p_map_js, 'r', encoding='utf-8') as f:
    map_js = f.read()

old_trace_user = r'''    if (userEl) userEl.textContent = path.owner_name || "ユーザー";'''
new_trace_user = r'''    if (userEl) userEl.textContent = path.owner_name || "ユーザー";
    const avatarContainer = document.querySelector('#trace-detail-modal .fa-user').parentElement;
    if (avatarContainer) {
        avatarContainer.innerHTML = '';
        const avatarUrl = path.owner_avatar_url || path.avatarUrl || path.avatar_url || null;
        if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onerror = () => { avatarContainer.innerHTML = '<i class="fas fa-user" style="color:#ccc;"></i>'; };
            avatarContainer.appendChild(img);
        } else {
            avatarContainer.innerHTML = '<i class="fas fa-user" style="color:#ccc;"></i>';
        }
    }'''

if 'avatarContainer.innerHTML' not in map_js:
    map_js = map_js.replace(old_trace_user, new_trace_user)
with open(p_map_js, 'w', encoding='utf-8') as f:
    f.write(map_js)

print("Avatars fixed!")
